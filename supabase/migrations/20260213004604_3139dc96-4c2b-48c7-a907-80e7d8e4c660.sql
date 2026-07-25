
-- Suppliers master table
CREATE TABLE public.suppliers_master (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name_normalized TEXT NOT NULL,
  name_display TEXT NOT NULL,
  description TEXT,
  ai_category TEXT,
  ai_confidence DECIMAL(3,2),
  user_override_category TEXT,
  current_category TEXT NOT NULL DEFAULT 'review_queue',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_classified_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, name_normalized)
);

ALTER TABLE public.suppliers_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their suppliers" ON public.suppliers_master FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create suppliers" ON public.suppliers_master FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update suppliers" ON public.suppliers_master FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete suppliers" ON public.suppliers_master FOR DELETE USING (auth.uid() = user_id);

-- Supplier data for Purchased Goods
CREATE TABLE public.supplier_data_pg (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers_master(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reporting_year INT NOT NULL,
  spend_usd DECIMAL(12,2),
  quantity DECIMAL(12,2),
  unit TEXT,
  emission_factor_id TEXT,
  tco2e DECIMAL(12,4),
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_data_pg ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their pg data" ON public.supplier_data_pg FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create pg data" ON public.supplier_data_pg FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update pg data" ON public.supplier_data_pg FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete pg data" ON public.supplier_data_pg FOR DELETE USING (auth.uid() = user_id);

-- Supplier data for Capital Goods
CREATE TABLE public.supplier_data_cg (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers_master(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reporting_year INT NOT NULL,
  asset_value_usd DECIMAL(12,2),
  lifespan_years INT,
  purchase_date DATE,
  emission_factor_id TEXT,
  tco2e DECIMAL(12,4),
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_data_cg ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their cg data" ON public.supplier_data_cg FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create cg data" ON public.supplier_data_cg FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update cg data" ON public.supplier_data_cg FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete cg data" ON public.supplier_data_cg FOR DELETE USING (auth.uid() = user_id);
