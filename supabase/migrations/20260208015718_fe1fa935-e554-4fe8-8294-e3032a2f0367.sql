-- Add location-based Scope 2 emissions column
-- The existing scope_2_emissions column will be used for market-based (used in calculations)
ALTER TABLE public.emissions_data 
ADD COLUMN scope_2_location_based numeric NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.emissions_data.scope_2_emissions IS 'Market-based Scope 2 emissions (used for calculations)';
COMMENT ON COLUMN public.emissions_data.scope_2_location_based IS 'Location-based Scope 2 emissions (for reporting only)';