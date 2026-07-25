
-- Add is_approved column to profiles table
ALTER TABLE public.profiles ADD COLUMN is_approved boolean NOT NULL DEFAULT false;

-- Set master account as approved
UPDATE public.profiles SET is_approved = true WHERE user_id = '8fcfb509-05cc-4635-879b-85b06ebb5951';
