-- Add attachment_url column to sustainability_credentials table
ALTER TABLE public.sustainability_credentials
ADD COLUMN attachment_url TEXT DEFAULT NULL;