/**
 * Intelligent Notification Decision Engine
 * Evaluates tasks and returns optimal notification schedules based on:
 * - Priority level
 * - Due date/time specificity
 * - Task duration
 * - Task category
 * - User energy patterns
 * - User notification preferences
 */

interface Task {
  id: string;
  title: string;
  due_date?: string | null;
  status: string;
  priority: string;
  estimated_duration?: number | null;
  category?: string;
}

interface UserProfile {
  work_hours_start: string;
  work_hours_end: string;
  peak_energy_time?: string; // e.g., "morning", "afternoon", "evening"
}

export interface UserNotificationPreferences {
  frequencyMultiplier: number; // 0.5 = less aggressive, 1 = normal, 2 = more aggressive
  minimumLeadTime: number; // Minimum minutes before task to notify
  disabledPriorities: ('high' | 'medium' | 'low')[]; // Priorities to disable notifications for
  quietHoursStart: string;
  quietHoursEnd: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  frequencyMultiplier: 1,
  minimumLeadTime: 5,
  disabledPriorities: [],
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

export interface ScheduledNotificationTime {
  time: Date;
  reason: string;
  type: 'advance-notice' | 'reminder' | 'final-reminder' | 'overdue' | 'daily-summary';
  priority: 'high' | 'medium' | 'low';
  content: NotificationContent;
}

export interface NotificationContent {
  title: string;
  body: string;
  urgencyLevel: 'urgent' | 'normal' | 'low' | 'overdue';
  timeRemaining?: string;
  actionText?: string;
}

export interface NotificationSchedule {
  taskId: string;
  taskTitle: string;
  notifications: ScheduledNotificationTime[];
}

/**
 * Determines if a due date includes a specific time (not just midnight)
 */
function hasSpecificTime(dueDate: Date): boolean {
  const hours = dueDate.getHours();
  const minutes = dueDate.getMinutes();
  // If time is exactly midnight, likely just a date without specific time
  return !(hours === 0 && minutes === 0);
}

/**
 * Gets the user's peak energy hours based on preference
 */
function getPeakEnergyHours(preference?: string): { start: number; end: number } {
  switch (preference) {
    case 'morning':
      return { start: 8, end: 12 };
    case 'afternoon':
      return { start: 12, end: 17 };
    case 'evening':
      return { start: 17, end: 21 };
    default:
      return { start: 9, end: 12 }; // Default to morning
  }
}

/**
 * Gets appropriate notification lead times based on task duration
 */
function getLeadTimeForDuration(durationMinutes: number | null | undefined): number {
  if (!durationMinutes) return 15; // Default 15 min
  
  if (durationMinutes >= 120) {
    // Long tasks (2+ hours): 30 min lead time
    return 30;
  } else if (durationMinutes >= 60) {
    // Medium tasks (1-2 hours): 20 min lead time
    return 20;
  } else if (durationMinutes <= 30) {
    // Short tasks: 10 min lead time
    return 10;
  }
  return 15;
}

/**
 * Checks if a time falls within work hours
 */
function isWithinWorkHours(date: Date, profile: UserProfile): boolean {
  const [startHour, startMin] = profile.work_hours_start.split(':').map(Number);
  const [endHour, endMin] = profile.work_hours_end.split(':').map(Number);
  
  const hour = date.getHours();
  const minute = date.getMinutes();
  const timeValue = hour * 60 + minute;
  const startValue = startHour * 60 + startMin;
  const endValue = endHour * 60 + endMin;
  
  return timeValue >= startValue && timeValue <= endValue;
}

/**
 * Checks if a time falls within quiet hours
 */
function isInQuietHours(date: Date, prefs: UserNotificationPreferences): boolean {
  const [startHour, startMin] = prefs.quietHoursStart.split(':').map(Number);
  const [endHour, endMin] = prefs.quietHoursEnd.split(':').map(Number);
  
  const hour = date.getHours();
  const minute = date.getMinutes();
  const timeValue = hour * 60 + minute;
  const quietStart = startHour * 60 + startMin;
  const quietEnd = endHour * 60 + endMin;
  
  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (quietStart > quietEnd) {
    return timeValue >= quietStart || timeValue <= quietEnd;
  }
  
  return timeValue >= quietStart && timeValue <= quietEnd;
}

/**
 * Adjusts notification time to fit within work hours for work tasks
 */
function adjustToWorkHours(date: Date, profile: UserProfile, isWorkTask: boolean): Date {
  if (!isWorkTask) return date;
  
  const [startHour, startMin] = profile.work_hours_start.split(':').map(Number);
  const [endHour, endMin] = profile.work_hours_end.split(':').map(Number);
  
  const adjusted = new Date(date);
  const hour = adjusted.getHours();
  
  if (hour < startHour) {
    adjusted.setHours(startHour, startMin, 0, 0);
  } else if (hour > endHour) {
    adjusted.setHours(endHour, endMin, 0, 0);
  }
  
  return adjusted;
}

/**
 * Format time remaining in human-readable format
 */
function formatTimeRemaining(targetDate: Date, fromDate: Date = new Date()): string {
  const diffMs = targetDate.getTime() - fromDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 0) {
    const overdueMins = Math.abs(diffMins);
    const overdueHours = Math.floor(overdueMins / 60);
    const overdueDays = Math.floor(overdueHours / 24);
    
    if (overdueDays > 0) {
      return `Due ${overdueDays} day${overdueDays > 1 ? 's' : ''} ago`;
    } else if (overdueHours > 0) {
      return `Due ${overdueHours} hour${overdueHours > 1 ? 's' : ''} ago`;
    } else {
      return `Due ${overdueMins} minute${overdueMins > 1 ? 's' : ''} ago`;
    }
  }
  
  if (diffDays > 0) {
    return `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `Due in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else if (diffMins > 0) {
    return `Due in ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  }
  
  return 'Due now';
}

/**
 * Generate notification content based on priority and urgency
 */
function generateNotificationContent(
  task: Task,
  type: ScheduledNotificationTime['type'],
  dueDate: Date | null,
  existingOverdueReminders: number = 0
): NotificationContent {
  const timeRemaining = dueDate ? formatTimeRemaining(dueDate) : undefined;
  
  // HIGH PRIORITY notifications - Urgent tone
  if (task.priority === 'high') {
    switch (type) {
      case 'advance-notice':
        return {
          title: `🔴 High priority task due soon!`,
          body: `"${task.title}" - ${timeRemaining}`,
          urgencyLevel: 'urgent',
          timeRemaining,
          actionText: 'Plan now',
        };
      case 'reminder':
        return {
          title: `⚠️ High priority: ${task.title}`,
          body: timeRemaining || 'Action required',
          urgencyLevel: 'urgent',
          timeRemaining,
          actionText: 'Start now',
        };
      case 'final-reminder':
        return {
          title: `🚨 Starting Soon: ${task.title}`,
          body: `${timeRemaining} - This needs your attention now!`,
          urgencyLevel: 'urgent',
          timeRemaining,
          actionText: 'Start immediately',
        };
      case 'overdue':
        return {
          title: `💪 Ready to tackle this?`,
          body: `"${task.title}" - ${timeRemaining}. Reminder ${existingOverdueReminders + 1} of 3.`,
          urgencyLevel: 'overdue',
          timeRemaining,
          actionText: 'Complete now',
        };
      case 'daily-summary':
        return {
          title: `🎯 High Priority: ${task.title}`,
          body: 'Consider tackling this during your peak energy time',
          urgencyLevel: 'urgent',
          actionText: 'View task',
        };
    }
  }
  
  // MEDIUM PRIORITY notifications - Gentle reminder tone
  if (task.priority === 'medium') {
    switch (type) {
      case 'reminder':
        return {
          title: `📋 Reminder: ${task.title}`,
          body: timeRemaining || 'Scheduled for today',
          urgencyLevel: 'normal',
          timeRemaining,
          actionText: 'View',
        };
      case 'overdue':
        return {
          title: `💪 Ready to tackle this?`,
          body: `"${task.title}" - ${timeRemaining}`,
          urgencyLevel: 'overdue',
          timeRemaining,
          actionText: 'Complete',
        };
      default:
        return {
          title: `📋 ${task.title}`,
          body: timeRemaining || 'Task reminder',
          urgencyLevel: 'normal',
          timeRemaining,
        };
    }
  }
  
  // LOW PRIORITY / default
  return {
    title: `📌 ${task.title}`,
    body: timeRemaining || 'Task reminder',
    urgencyLevel: 'low',
    timeRemaining,
  };
}

/**
 * Main decision engine: Calculates notification schedule for a task
 */
export function calculateNotificationSchedule(
  task: Task,
  profile: UserProfile,
  existingOverdueReminders: number = 0,
  preferences: UserNotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES
): NotificationSchedule {
  const notifications: ScheduledNotificationTime[] = [];
  const now = new Date();
  const isWorkTask = task.category === 'work';
  const priority = task.priority as 'high' | 'medium' | 'low';
  
  // No notifications for completed tasks
  if (task.status === 'completed') {
    return { taskId: task.id, taskTitle: task.title, notifications: [] };
  }

  // Check if priority is disabled by user
  if (preferences.disabledPriorities.includes(priority)) {
    return { taskId: task.id, taskTitle: task.title, notifications: [] };
  }

  // LOW PRIORITY: No automatic notifications
  if (task.priority === 'low') {
    return { taskId: task.id, taskTitle: task.title, notifications: [] };
  }

  // No due date handling
  if (!task.due_date) {
    // High priority without deadline: Include in daily AI recommendations
    if (task.priority === 'high') {
      const peakHours = getPeakEnergyHours(profile.peak_energy_time);
      const reminderTime = new Date(now);
      reminderTime.setDate(reminderTime.getDate() + 1);
      reminderTime.setHours(peakHours.start, 0, 0, 0);
      
      if (isWorkTask) {
        const adjustedTime = adjustToWorkHours(reminderTime, profile, true);
        if (adjustedTime > now && !isInQuietHours(adjustedTime, preferences)) {
          const content = generateNotificationContent(task, 'daily-summary', null);
          notifications.push({
            time: adjustedTime,
            reason: 'High priority task without deadline - peak energy reminder',
            type: 'daily-summary',
            priority: 'high',
            content,
          });
        }
      }
    }
    // Medium priority without deadline: No automatic notifications
    return { taskId: task.id, taskTitle: task.title, notifications };
  }

  const dueDate = new Date(task.due_date);
  const dueDateStart = new Date(dueDate);
  dueDateStart.setHours(0, 0, 0, 0);
  
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  const isOverdue = dueDateStart < todayStart;
  const isDueToday = dueDateStart.getTime() === todayStart.getTime();
  const specificTime = hasSpecificTime(dueDate);

  // Helper to add notification if valid
  const addNotification = (
    time: Date, 
    reason: string, 
    type: ScheduledNotificationTime['type'],
    priorityLevel: 'high' | 'medium' | 'low'
  ) => {
    const adjustedTime = adjustToWorkHours(time, profile, isWorkTask);
    
    // Skip if in quiet hours or before minimum lead time
    if (isInQuietHours(adjustedTime, preferences)) return;
    
    const minLeadTime = new Date(now.getTime() + preferences.minimumLeadTime * 60 * 1000);
    if (adjustedTime <= minLeadTime) return;
    
    const content = generateNotificationContent(task, type, dueDate, existingOverdueReminders);
    
    notifications.push({
      time: adjustedTime,
      reason,
      type,
      priority: priorityLevel,
      content,
    });
  };

  // OVERDUE TASK HANDLING
  if (isOverdue) {
    if (task.priority === 'high') {
      // High priority overdue: Every 4 hours, max 3 per day
      if (existingOverdueReminders < 3) {
        const baseInterval = 4 * 60 * 60 * 1000; // 4 hours
        const adjustedInterval = baseInterval / preferences.frequencyMultiplier;
        const nextReminder = new Date(now.getTime() + adjustedInterval);
        
        addNotification(
          nextReminder,
          `Overdue high priority - reminder ${existingOverdueReminders + 1} of 3`,
          'overdue',
          'high'
        );
      }
    } else if (task.priority === 'medium') {
      // Medium priority overdue: One reminder per day at 9am
      const reminderTime = new Date(now);
      reminderTime.setHours(9, 0, 0, 0);
      
      if (reminderTime <= now) {
        reminderTime.setDate(reminderTime.getDate() + 1);
      }
      
      addNotification(
        reminderTime,
        'Overdue medium priority - daily reminder',
        'overdue',
        'medium'
      );
    }
    
    return { taskId: task.id, taskTitle: task.title, notifications };
  }

  // Apply frequency multiplier to notification count
  const shouldAddExtraNotifications = preferences.frequencyMultiplier >= 1.5;
  const shouldReduceNotifications = preferences.frequencyMultiplier <= 0.5;

  // HIGH PRIORITY NOTIFICATIONS
  if (task.priority === 'high') {
    const leadTime = getLeadTimeForDuration(task.estimated_duration);
    
    if (specificTime) {
      // Task WITH specific time
      
      // 1. 24 hours before (skip if reduced)
      if (!shouldReduceNotifications) {
        const twentyFourHoursBefore = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
        if (twentyFourHoursBefore > now) {
          addNotification(
            twentyFourHoursBefore,
            '24hr advance notice for high priority',
            'advance-notice',
            'high'
          );
        }
      }
      
      // 2. 2 hours before
      const twoHoursBefore = new Date(dueDate.getTime() - 2 * 60 * 60 * 1000);
      if (twoHoursBefore > now) {
        addNotification(
          twoHoursBefore,
          '2hr reminder before scheduled time',
          'reminder',
          'high'
        );
      }
      
      // 3. Final reminder (adjusted for duration)
      const finalReminder = new Date(dueDate.getTime() - leadTime * 60 * 1000);
      if (finalReminder > now) {
        addNotification(
          finalReminder,
          `${leadTime}min final reminder`,
          'final-reminder',
          'high'
        );
      }

      // Extra notification for aggressive mode: 6 hours before
      if (shouldAddExtraNotifications) {
        const sixHoursBefore = new Date(dueDate.getTime() - 6 * 60 * 60 * 1000);
        if (sixHoursBefore > now) {
          addNotification(
            sixHoursBefore,
            '6hr early warning for high priority',
            'reminder',
            'high'
          );
        }
      }
    } else {
      // Task WITH date only (no specific time)
      // High: Notify at 9am, 2pm, 6pm on that day
      const times = shouldReduceNotifications
        ? [{ hour: 9, minute: 0, label: 'morning' }]
        : [
            { hour: 9, minute: 0, label: 'morning' },
            { hour: 14, minute: 0, label: 'afternoon' },
            { hour: 18, minute: 0, label: 'evening' },
          ];
      
      for (const { hour, minute, label } of times) {
        const notifTime = new Date(dueDate);
        notifTime.setHours(hour, minute, 0, 0);
        
        if (notifTime > now) {
          addNotification(
            notifTime,
            `High priority due date - ${label} reminder`,
            'reminder',
            'high'
          );
        }
      }
      
      // Also add 24hr advance if due date is tomorrow or later
      if (!shouldReduceNotifications) {
        const twentyFourHoursBefore = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
        twentyFourHoursBefore.setHours(9, 0, 0, 0);
        if (twentyFourHoursBefore > now && !isDueToday) {
          addNotification(
            twentyFourHoursBefore,
            '24hr advance notice for high priority',
            'advance-notice',
            'high'
          );
        }
      }
    }
  }

  // MEDIUM PRIORITY NOTIFICATIONS
  if (task.priority === 'medium') {
    if (specificTime) {
      // Task WITH specific time: Single notification 2 hours before
      const twoHoursBefore = new Date(dueDate.getTime() - 2 * 60 * 60 * 1000);
      if (twoHoursBefore > now) {
        addNotification(
          twoHoursBefore,
          '2hr reminder for medium priority task',
          'reminder',
          'medium'
        );
      }

      // Extra for aggressive mode: 15 min final reminder
      if (shouldAddExtraNotifications) {
        const fifteenMinBefore = new Date(dueDate.getTime() - 15 * 60 * 1000);
        if (fifteenMinBefore > now) {
          addNotification(
            fifteenMinBefore,
            '15min final reminder for medium priority',
            'final-reminder',
            'medium'
          );
        }
      }
    } else {
      // Task WITH date only: One reminder at 9am on due date
      const reminderTime = new Date(dueDate);
      reminderTime.setHours(9, 0, 0, 0);
      
      if (reminderTime > now) {
        addNotification(
          reminderTime,
          'Medium priority due date - morning reminder',
          'reminder',
          'medium'
        );
      }
    }
  }

  // Sort notifications by time
  notifications.sort((a, b) => a.time.getTime() - b.time.getTime());

  return { taskId: task.id, taskTitle: task.title, notifications };
}

/**
 * Batch calculate notification schedules for multiple tasks
 */
export function calculateAllNotificationSchedules(
  tasks: Task[],
  profile: UserProfile,
  overdueReminderCounts: Record<string, number> = {},
  preferences: UserNotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES
): NotificationSchedule[] {
  return tasks
    .filter(task => task.status !== 'completed')
    .map(task => calculateNotificationSchedule(
      task, 
      profile, 
      overdueReminderCounts[task.id] || 0,
      preferences
    ))
    .filter(schedule => schedule.notifications.length > 0);
}

/**
 * Get a summary of notifications to be scheduled
 */
export function getNotificationSummary(schedules: NotificationSchedule[]): {
  total: number;
  byPriority: { high: number; medium: number; low: number };
  byType: Record<string, number>;
} {
  const summary = {
    total: 0,
    byPriority: { high: 0, medium: 0, low: 0 },
    byType: {} as Record<string, number>,
  };

  for (const schedule of schedules) {
    for (const notif of schedule.notifications) {
      summary.total++;
      summary.byPriority[notif.priority]++;
      summary.byType[notif.type] = (summary.byType[notif.type] || 0) + 1;
    }
  }

  return summary;
}

/**
 * Check if a notification schedule needs updating based on task changes
 */
export function hasScheduleChanged(
  oldTask: Task | null,
  newTask: Task
): boolean {
  if (!oldTask) return true;
  
  return (
    oldTask.due_date !== newTask.due_date ||
    oldTask.priority !== newTask.priority ||
    oldTask.status !== newTask.status ||
    oldTask.estimated_duration !== newTask.estimated_duration ||
    oldTask.category !== newTask.category ||
    oldTask.title !== newTask.title
  );
}
