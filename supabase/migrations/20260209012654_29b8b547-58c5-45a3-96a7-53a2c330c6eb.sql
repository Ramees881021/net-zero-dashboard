-- Create a separate table for credential type logos
-- This stores logo mappings without creating actual credentials
CREATE TABLE public.credential_type_logos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  credential_type text NOT NULL,
  logo_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, credential_type)
);

-- Enable RLS
ALTER TABLE public.credential_type_logos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their credential logos"
ON public.credential_type_logos
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their credential logos"
ON public.credential_type_logos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their credential logos"
ON public.credential_type_logos
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their credential logos"
ON public.credential_type_logos
FOR DELETE
USING (auth.uid() = user_id);