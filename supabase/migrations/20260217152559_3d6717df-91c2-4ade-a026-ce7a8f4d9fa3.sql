-- Add JSONB column to store Scope 3 sub-category breakdown
-- Each key is a category code, value is an object: { value: number | null, status: 'calculated' | 'not_applicable' | 'not_calculated' }
ALTER TABLE public.emissions_data
ADD COLUMN scope3_breakdown jsonb DEFAULT '{}'::jsonb;