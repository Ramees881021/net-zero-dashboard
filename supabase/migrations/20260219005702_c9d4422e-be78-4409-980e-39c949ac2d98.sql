
CREATE TABLE public.emission_reduction_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  scope_type TEXT NOT NULL DEFAULT 'scope_1_2' CHECK (scope_type IN ('scope_1_2', 'scope_3')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  project_cost NUMERIC DEFAULT 0,
  annual_emission_savings NUMERIC DEFAULT 0,
  start_year INTEGER,
  end_year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.emission_reduction_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their reduction projects"
ON public.emission_reduction_projects FOR SELECT
USING ((auth.uid() = user_id) OR ((organization_id IS NOT NULL) AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can create reduction projects"
ON public.emission_reduction_projects FOR INSERT
WITH CHECK ((auth.uid() = user_id) AND ((organization_id IS NULL) OR is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can update reduction projects"
ON public.emission_reduction_projects FOR UPDATE
USING ((auth.uid() = user_id) OR ((organization_id IS NOT NULL) AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can delete reduction projects"
ON public.emission_reduction_projects FOR DELETE
USING ((auth.uid() = user_id) OR ((organization_id IS NOT NULL) AND is_org_admin_or_owner(auth.uid(), organization_id)));
