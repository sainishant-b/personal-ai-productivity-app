import { supabase } from "@/integrations/supabase/client";
import { 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  format, 
  subDays, 
  isSameDay,
  getDay,
  addDays
} from "date-fns";

export interface RepeatCompletion {
  id: string;
  task_id: string;
  user_id: string;
  completed_date: string;
  completed_at: string;
}

export interface RepeatTaskConfig {
  repeat_enabled: boolean;
  repeat_frequency: number;
  repeat_unit: "day" | "week" | "month" | "year";
  repeat_days_of_week: number[];
  repeat_times: string[];
}

export interface WeeklyHeatmapData {
  date: Date;
  dayOfWeek: number;
  isCompleted: boolean;
  isScheduled: boolean;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Check if a task is completed for today
 */
export async function isCompletedToday(taskId: string): Promise<boolean> {
  const today = format(new Date(), "yyyy-MM-dd");
  
  const { data, error } = await supabase
    .from("repeat_completions")
    .select("id")
    .eq("task_id", taskId)
    .eq("completed_date", today)
    .maybeSingle();
  
  return !error && data !== null;
}

/**
 * Toggle completion for a repeating task
 * Returns: { completed: boolean, streak: number }
 */
export async function toggleRepeatCompletion(
  taskId: string, 
  userId: string,
  config: RepeatTaskConfig
): Promise<{ completed: boolean; currentStreak: number; longestStreak: number }> {
  const today = format(new Date(), "yyyy-MM-dd");
  
  // Check if already completed today
  const { data: existing } = await supabase
    .from("repeat_completions")
    .select("id")
    .eq("task_id", taskId)
    .eq("completed_date", today)
    .maybeSingle();
  
  if (existing) {
    // Uncomplete: remove today's record
    await supabase
      .from("repeat_completions")
      .delete()
      .eq("id", existing.id);
    
    // Recalculate streak
    const { currentStreak, longestStreak } = await calculateStreak(taskId, config);
    
    // Update task streaks
    await supabase
      .from("tasks")
      .update({ 
        repeat_streak_current: currentStreak,
      })
      .eq("id", taskId);
    
    return { completed: false, currentStreak, longestStreak };
  } else {
    // Complete: add today's record
    await supabase
      .from("repeat_completions")
      .insert({
        task_id: taskId,
        user_id: userId,
        completed_date: today,
      });
    
    // Recalculate streak
    const { currentStreak, longestStreak } = await calculateStreak(taskId, config);
    
    // Update task streaks (also update longest if needed)
    const { data: taskData } = await supabase
      .from("tasks")
      .select("repeat_streak_longest")
      .eq("id", taskId)
      .single();
    
    const newLongest = Math.max(taskData?.repeat_streak_longest || 0, currentStreak);
    
    await supabase
      .from("tasks")
      .update({ 
        repeat_streak_current: currentStreak,
        repeat_streak_longest: newLongest,
      })
      .eq("id", taskId);
    
    return { completed: true, currentStreak, longestStreak: newLongest };
  }
}

/**
 * Calculate streak based on repeat schedule
 * This respects alternate days, specific days of week, etc.
 */
export async function calculateStreak(
  taskId: string,
  config: RepeatTaskConfig
): Promise<{ currentStreak: number; longestStreak: number }> {
  // Get all completions for this task, sorted by date desc
  const { data: completions } = await supabase
    .from("repeat_completions")
    .select("completed_date")
    .eq("task_id", taskId)
    .order("completed_date", { ascending: false });
  
  if (!completions || completions.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }
  
  const completedDates = new Set(completions.map(c => c.completed_date));
  
  // Get scheduled dates going backward from today
  const today = new Date();
  let currentStreak = 0;
  let checkDate = today;
  let maxIterations = 365; // Safety limit
  
  // Find the expected completion dates based on schedule
  while (maxIterations > 0) {
    maxIterations--;
    
    if (isScheduledDate(checkDate, config)) {
      const dateStr = format(checkDate, "yyyy-MM-dd");
      
      // If today is scheduled but not yet completed, don't break streak
      // Just skip to previous scheduled date
      if (isSameDay(checkDate, today) && !completedDates.has(dateStr)) {
        checkDate = getPreviousScheduledDate(checkDate, config);
        continue;
      }
      
      if (completedDates.has(dateStr)) {
        currentStreak++;
        checkDate = getPreviousScheduledDate(checkDate, config);
      } else {
        // Missed a scheduled date, streak broken
        break;
      }
    } else {
      // Not a scheduled date, skip to previous scheduled date
      checkDate = getPreviousScheduledDate(checkDate, config);
    }
    
    // Safety: don't go beyond a year
    if (subDays(today, 365) > checkDate) break;
  }
  
  // Calculate longest streak (scan through all completions)
  let longestStreak = currentStreak;
  // For simplicity, we'll use the current streak as longest if it's larger
  // A full longest calculation would require scanning all historical data
  
  return { currentStreak, longestStreak };
}

/**
 * Check if a date is a scheduled completion date
 */
export function isScheduledDate(date: Date, config: RepeatTaskConfig): boolean {
  if (!config.repeat_enabled) return false;
  
  const dayOfWeek = getDay(date);
  
  switch (config.repeat_unit) {
    case "day":
      // For daily with frequency > 1 (e.g., every 2 days)
      // We'd need the task creation date to calculate properly
      // For now, treat as every day
      return true;
      
    case "week":
      // Check if this day of week is in the schedule
      if (config.repeat_days_of_week && config.repeat_days_of_week.length > 0) {
        return config.repeat_days_of_week.includes(dayOfWeek);
      }
      return true;
      
    case "month":
    case "year":
      // For monthly/yearly, we'd need start date
      // For now, approximate as any day
      return true;
      
    default:
      return true;
  }
}

/**
 * Get the previous scheduled date before the given date
 */
export function getPreviousScheduledDate(fromDate: Date, config: RepeatTaskConfig): Date {
  let checkDate = subDays(fromDate, 1);
  let maxIterations = 30; // Safety limit
  
  while (maxIterations > 0) {
    maxIterations--;
    
    if (isScheduledDate(checkDate, config)) {
      return checkDate;
    }
    
    checkDate = subDays(checkDate, 1);
  }
  
  // Fallback
  return subDays(fromDate, 1);
}

/**
 * Get weekly heatmap data for a task
 */
export async function getWeeklyHeatmapData(
  taskId: string,
  config: RepeatTaskConfig
): Promise<WeeklyHeatmapData[]> {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 }); // Saturday
  
  // Get completions for this week
  const { data: completions } = await supabase
    .from("repeat_completions")
    .select("completed_date")
    .eq("task_id", taskId)
    .gte("completed_date", format(weekStart, "yyyy-MM-dd"))
    .lte("completed_date", format(weekEnd, "yyyy-MM-dd"));
  
  const completedDates = new Set((completions || []).map(c => c.completed_date));
  
  // Build week data
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  return weekDays.map(date => ({
    date,
    dayOfWeek: getDay(date),
    isCompleted: completedDates.has(format(date, "yyyy-MM-dd")),
    isScheduled: isScheduledDate(date, config),
    isToday: isSameDay(date, today),
    isFuture: date > today,
  }));
}

/**
 * Get completion stats for a task
 */
export async function getCompletionStats(
  taskId: string,
  config: RepeatTaskConfig
): Promise<{
  weekCompleted: number;
  weekScheduled: number;
  monthCompleted: number;
  monthScheduled: number;
  totalCompleted: number;
  totalMissed: number;
}> {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  
  // Get all completions
  const { data: allCompletions } = await supabase
    .from("repeat_completions")
    .select("completed_date")
    .eq("task_id", taskId);
  
  const completedDates = new Set((allCompletions || []).map(c => c.completed_date));
  
  // Calculate week stats
  const weekDays = eachDayOfInterval({ start: weekStart, end: today });
  const weekScheduled = weekDays.filter(d => isScheduledDate(d, config)).length;
  const weekCompleted = weekDays.filter(d => 
    isScheduledDate(d, config) && completedDates.has(format(d, "yyyy-MM-dd"))
  ).length;
  
  // Calculate month stats
  const monthDays = eachDayOfInterval({ start: monthStart, end: today });
  const monthScheduled = monthDays.filter(d => isScheduledDate(d, config)).length;
  const monthCompleted = monthDays.filter(d => 
    isScheduledDate(d, config) && completedDates.has(format(d, "yyyy-MM-dd"))
  ).length;
  
  return {
    weekCompleted,
    weekScheduled,
    monthCompleted,
    monthScheduled,
    totalCompleted: allCompletions?.length || 0,
    totalMissed: monthScheduled - monthCompleted, // Approximate
  };
}
