import { useState, useEffect, useCallback } from "react";
import { 
  isCompletedToday, 
  toggleRepeatCompletion,
  RepeatTaskConfig 
} from "@/utils/repeatCompletionUtils";

interface UseRepeatCompletionOptions {
  taskId: string;
  userId: string;
  config: RepeatTaskConfig;
  onComplete?: (completed: boolean, streak: number) => void;
}

export function useRepeatCompletion({ 
  taskId, 
  userId, 
  config,
  onComplete 
}: UseRepeatCompletionOptions) {
  const [isCompletedForToday, setIsCompletedForToday] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  // Check initial completion status
  useEffect(() => {
    async function checkCompletion() {
      setIsLoading(true);
      try {
        const completed = await isCompletedToday(taskId);
        setIsCompletedForToday(completed);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (taskId && config.repeat_enabled) {
      checkCompletion();
    }
  }, [taskId, config.repeat_enabled]);

  // Toggle completion
  const toggle = useCallback(async () => {
    if (isToggling || !config.repeat_enabled) return;
    
    setIsToggling(true);
    try {
      const result = await toggleRepeatCompletion(taskId, userId, config);
      setIsCompletedForToday(result.completed);
      setCurrentStreak(result.currentStreak);
      setLongestStreak(result.longestStreak);
      onComplete?.(result.completed, result.currentStreak);
    } finally {
      setIsToggling(false);
    }
  }, [taskId, userId, config, isToggling, onComplete]);

  return {
    isCompletedForToday,
    isLoading,
    isToggling,
    currentStreak,
    longestStreak,
    toggle,
  };
}
