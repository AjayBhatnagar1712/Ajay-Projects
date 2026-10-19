-- Create feedback table for in-app feedback submissions
CREATE TABLE IF NOT EXISTS public.feedback (
  id           text PRIMARY KEY,
  message      text NOT NULL,
  rating       integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  category     text NOT NULL CHECK (category IN ('bug', 'feature', 'general', 'ux', 'other')),
  user_phone   text,
  user_role    text,
  page_url     text,
  user_email   text,
  ai_summary   text,
  ai_sentiment text,
  ai_tags      text,
  email_sent   boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);
