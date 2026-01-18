import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Flame, Check } from "lucide-react";
import { 
  WeeklyHeatmapData, 
  getWeeklyHeatmapData, 
  RepeatTaskConfig,
  getCompletionStats
} from "@/utils/repeatCompletionUtils";

interface RepeatHeatmapProps {
  taskId: string;
  config: RepeatTaskConfig;
  currentStreak: number;
  longestStreak: number;
  compact?: boolean;
}

const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

export function RepeatHeatmap({ 
  taskId, 
  config, 
  currentStreak, 
  longestStreak,
  compact = false 
}: RepeatHeatmapProps) {
  const [weekData, setWeekData] = useState<WeeklyHeatmapData[]>([]);
  const [stats, setStats] = useState({
    weekCompleted: 0,
    weekScheduled: 0,
    monthCompleted: 0,
    monthScheduled: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [heatmapData, statsData] = await Promise.all([
          getWeeklyHeatmapData(taskId, config),
          getCompletionStats(taskId, config),
        ]);
        setWeekData(heatmapData);
        setStats(statsData);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [taskId, config]);

  if (loading) {
    return (
      <div className="flex gap-1.5 animate-pulse">
        {Array(7).fill(0).map((_, i) => (
          <div key={i} className="w-6 h-6 rounded-full bg-muted" />
        ))}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {weekData.map((day, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                day.isCompleted 
                  ? "bg-primary" 
                  : day.isScheduled && !day.isFuture
                    ? "bg-destructive/40"
                    : "bg-muted"
              )}
            />
          ))}
        </div>
        {currentStreak > 0 && (
          <span className="flex items-center gap-0.5 text-xs font-medium text-orange-500">
            <Flame className="h-3 w-3" />
            {currentStreak}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Weekly heatmap */}
      <div className="flex justify-between gap-1">
        {weekData.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted-foreground font-medium">
              {dayLabels[day.dayOfWeek]}
            </span>
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                "border-2",
                day.isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                day.isCompleted 
                  ? "bg-primary border-primary text-primary-foreground" 
                  : day.isScheduled && !day.isFuture
                    ? "bg-destructive/10 border-destructive/30"
                    : day.isScheduled
                      ? "bg-muted/50 border-muted"
                      : "bg-transparent border-muted/30"
              )}
            >
              {day.isCompleted && <Check className="h-4 w-4" />}
            </div>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          {/* Current streak */}
          <div className="flex items-center gap-1">
            <Flame className={cn(
              "h-4 w-4",
              currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"
            )} />
            <span className={cn(
              "font-semibold",
              currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"
            )}>
              {currentStreak}
            </span>
            <span className="text-muted-foreground">streak</span>
          </div>
          
          {/* Best streak */}
          {longestStreak > 0 && (
            <div className="text-muted-foreground">
              Best: <span className="font-semibold text-foreground">{longestStreak}</span>
            </div>
          )}
        </div>

        {/* Weekly completion */}
        <div className="text-muted-foreground">
          <span className="font-semibold text-foreground">{stats.weekCompleted}</span>
          /{stats.weekScheduled} this week
        </div>
      </div>
    </div>
  );
}

/**
 * Mini version for task cards - just dots
 */
export function MiniRepeatHeatmap({ 
  taskId, 
  config, 
  currentStreak 
}: { 
  taskId: string; 
  config: RepeatTaskConfig;
  currentStreak: number;
}) {
  return (
    <RepeatHeatmap 
      taskId={taskId} 
      config={config} 
      currentStreak={currentStreak}
      longestStreak={0}
      compact={true}
    />
  );
}
