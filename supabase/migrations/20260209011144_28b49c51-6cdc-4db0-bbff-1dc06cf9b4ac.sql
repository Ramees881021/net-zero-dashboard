-- Add logo_url column to sustainability_credentials for custom credential logos
ALTER TABLE public.sustainability_credentials 
ADD COLUMN logo_url text DEFAULT NULL;