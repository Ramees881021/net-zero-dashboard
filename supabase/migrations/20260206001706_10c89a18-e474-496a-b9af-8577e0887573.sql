-- Create storage bucket for organization assets
INSERT INTO storage.buckets (id, name, public) VALUES ('organization-assets', 'organization-assets', true);

-- Create policy for viewing organization assets (public)
CREATE POLICY "Organization assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-assets');

-- Create policy for uploading organization assets
CREATE POLICY "Users can upload organization assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'organization-assets' AND auth.uid() IS NOT NULL);

-- Create policy for updating organization assets
CREATE POLICY "Users can update their organization assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'organization-assets' AND auth.uid() IS NOT NULL);

-- Create policy for deleting organization assets
CREATE POLICY "Users can delete their organization assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'organization-assets' AND auth.uid() IS NOT NULL);

-- Add new columns to profiles table for organization details
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Create table for sustainability credentials
CREATE TABLE public.sustainability_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  credential_type TEXT NOT NULL,
  credential_name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  score_or_level TEXT,
  valid_until DATE,
  certificate_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sustainability_credentials
ALTER TABLE public.sustainability_credentials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sustainability_credentials
CREATE POLICY "Users can view credentials"
ON public.sustainability_credentials FOR SELECT
USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can create credentials"
ON public.sustainability_credentials FOR INSERT
WITH CHECK (auth.uid() = user_id AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can update credentials"
ON public.sustainability_credentials FOR UPDATE
USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can delete credentials"
ON public.sustainability_credentials FOR DELETE
USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_admin_or_owner(auth.uid(), organization_id)));

-- Add trigger for updated_at
CREATE TRIGGER update_sustainability_credentials_updated_at
BEFORE UPDATE ON public.sustainability_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();