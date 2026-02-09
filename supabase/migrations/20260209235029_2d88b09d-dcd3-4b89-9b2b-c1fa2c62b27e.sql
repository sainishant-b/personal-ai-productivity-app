
-- Create task_proofs table for storing proof of completion
CREATE TABLE public.task_proofs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  ai_rating INTEGER CHECK (ai_rating >= 0 AND ai_rating <= 10),
  ai_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_proofs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own proofs"
  ON public.task_proofs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own proofs"
  ON public.task_proofs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proofs"
  ON public.task_proofs FOR DELETE
  USING (auth.uid() = user_id);

-- Add rating columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN total_ai_rating INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN total_proofs_submitted INTEGER NOT NULL DEFAULT 0;

-- Create storage bucket for proof images
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-images', 'proof-images', true);

-- Storage policies
CREATE POLICY "Users can upload proof images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'proof-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Proof images are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'proof-images');

CREATE POLICY "Users can delete their own proof images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'proof-images' AND auth.uid()::text = (storage.foldername(name))[1]);
