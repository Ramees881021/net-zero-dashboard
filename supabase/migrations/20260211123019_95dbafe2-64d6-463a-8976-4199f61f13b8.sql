
-- Business Units table
CREATE TABLE public.business_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  parent_bu_id UUID REFERENCES public.business_units(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their business units" ON public.business_units FOR SELECT
  USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));
CREATE POLICY "Users can create business units" ON public.business_units FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update business units" ON public.business_units FOR UPDATE
  USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_admin_or_owner(auth.uid(), organization_id)));
CREATE POLICY "Users can delete business units" ON public.business_units FOR DELETE
  USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_admin_or_owner(auth.uid(), organization_id)));

CREATE TRIGGER update_business_units_updated_at BEFORE UPDATE ON public.business_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sites table
CREATE TABLE public.sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_unit_id UUID REFERENCES public.business_units(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  country TEXT,
  grid_region TEXT,
  area_sqm NUMERIC,
  employee_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their sites" ON public.sites FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create sites" ON public.sites FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update sites" ON public.sites FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete sites" ON public.sites FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Carbon Calculator Entries - flexible emissions storage
CREATE TABLE public.carbon_calc_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  business_unit_id UUID REFERENCES public.business_units(id) ON DELETE SET NULL,
  reporting_year INTEGER NOT NULL,
  scope INTEGER NOT NULL CHECK (scope IN (1, 2, 3)),
  category TEXT NOT NULL,
  sub_category TEXT,
  description TEXT,
  activity_data JSONB DEFAULT '{}'::jsonb,
  emission_factor NUMERIC,
  emission_factor_source TEXT,
  amount_tco2e NUMERIC NOT NULL DEFAULT 0,
  data_quality TEXT DEFAULT 'estimated' CHECK (data_quality IN ('site_actual', 'bu_actual', 'global_actual', 'estimated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.carbon_calc_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their carbon entries" ON public.carbon_calc_entries FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create carbon entries" ON public.carbon_calc_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update carbon entries" ON public.carbon_calc_entries FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete carbon entries" ON public.carbon_calc_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_carbon_calc_entries_updated_at BEFORE UPDATE ON public.carbon_calc_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Scope 3 category configuration per user
CREATE TABLE public.scope3_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reporting_year INTEGER NOT NULL,
  category_code TEXT NOT NULL,
  collection_method TEXT DEFAULT 'global' CHECK (collection_method IN ('site_split', 'bu_split', 'global', 'hybrid')),
  is_relevant BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, reporting_year, category_code)
);

ALTER TABLE public.scope3_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their scope3 config" ON public.scope3_config FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create scope3 config" ON public.scope3_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update scope3 config" ON public.scope3_config FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete scope3 config" ON public.scope3_config FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_scope3_config_updated_at BEFORE UPDATE ON public.scope3_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_carbon_calc_entries_user_year ON public.carbon_calc_entries(user_id, reporting_year);
CREATE INDEX idx_carbon_calc_entries_scope ON public.carbon_calc_entries(scope, category);
CREATE INDEX idx_sites_user ON public.sites(user_id);
CREATE INDEX idx_business_units_user ON public.business_units(user_id);
