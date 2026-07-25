
-- Phase 1: Add confidence_score column to carbon_calc_entries
ALTER TABLE public.carbon_calc_entries
ADD COLUMN IF NOT EXISTS confidence_score integer DEFAULT NULL;

-- Phase 3: Audit Trail table
CREATE TABLE public.carbon_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  action text NOT NULL, -- 'create', 'update', 'delete'
  old_values jsonb DEFAULT NULL,
  new_values jsonb DEFAULT NULL,
  reason text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.carbon_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
ON public.carbon_audit_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own audit logs"
ON public.carbon_audit_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_audit_log_entry_id ON public.carbon_audit_log(entry_id);
CREATE INDEX idx_audit_log_user_id ON public.carbon_audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON public.carbon_audit_log(created_at DESC);

-- Phase 4: Source Document Linking table
CREATE TABLE public.carbon_entry_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  document_type text NOT NULL DEFAULT 'other', -- invoice, utility_bill, meter_reading, receipt, other
  notes text DEFAULT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.carbon_entry_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own entry documents"
ON public.carbon_entry_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own entry documents"
ON public.carbon_entry_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entry documents"
ON public.carbon_entry_documents FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_entry_documents_entry_id ON public.carbon_entry_documents(entry_id);

-- Phase 4: Storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public) VALUES ('carbon-evidence', 'carbon-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for carbon-evidence bucket
CREATE POLICY "Users can upload evidence files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'carbon-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their evidence files"
ON storage.objects FOR SELECT
USING (bucket_id = 'carbon-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their evidence files"
ON storage.objects FOR DELETE
USING (bucket_id = 'carbon-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Phase 5: Audit Report Config table
CREATE TABLE public.audit_report_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  reporting_year integer NOT NULL,
  boundary_approach text NOT NULL DEFAULT 'operational_control',
  exclusions_log text DEFAULT NULL,
  verification_status text NOT NULL DEFAULT 'unverified',
  methodology_notes text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_report_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their audit report config"
ON public.audit_report_config FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their audit report config"
ON public.audit_report_config FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their audit report config"
ON public.audit_report_config FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their audit report config"
ON public.audit_report_config FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_audit_report_config_updated_at
BEFORE UPDATE ON public.audit_report_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
