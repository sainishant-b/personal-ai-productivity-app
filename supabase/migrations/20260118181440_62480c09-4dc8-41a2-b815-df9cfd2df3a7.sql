-- Create repeat_completions table to track individual completions
CREATE TABLE public.repeat_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  completed_date DATE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, completed_date)
);

-- Enable RLS
ALTER TABLE public.repeat_completions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own completions"
ON public.repeat_completions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own completions"
ON public.repeat_completions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own completions"
ON public.repeat_completions
FOR DELETE
USING (auth.uid() = user_id);

-- Add streak tracking columns to tasks table
ALTER TABLE public.tasks
ADD COLUMN repeat_streak_current INTEGER DEFAULT 0,
ADD COLUMN repeat_streak_longest INTEGER DEFAULT 0;

-- Create index for efficient queries
CREATE INDEX idx_repeat_completions_task_date ON public.repeat_completions(task_id, completed_date DESC);
CREATE INDEX idx_repeat_completions_user ON public.repeat_completions(user_id);

-- Drop columns that are no longer needed for the new model
ALTER TABLE public.tasks
DROP COLUMN IF EXISTS repeat_parent_id,
DROP COLUMN IF EXISTS repeat_series_id,
DROP COLUMN IF EXISTS repeat_completed_count;