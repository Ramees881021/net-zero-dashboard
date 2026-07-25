-- Allow users to insert their own user role during signup
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;

CREATE POLICY "Users can insert own user role or admins can insert any"
ON public.user_roles
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id AND role = 'user') 
  OR public.is_admin(auth.uid())
);

-- Update emissions insert policy to allow new users to copy data
DROP POLICY IF EXISTS "Admins can insert emissions data" ON public.emissions_data;
DROP POLICY IF EXISTS "Users can create emissions data" ON public.emissions_data;

CREATE POLICY "Users can create emissions data"
ON public.emissions_data
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
);

-- Update clients insert policy
DROP POLICY IF EXISTS "Users can create clients" ON public.clients;

CREATE POLICY "Users can create clients"
ON public.clients
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
);

-- Update netzero insert policy
DROP POLICY IF EXISTS "Users can create netzero targets" ON public.netzero_targets;

CREATE POLICY "Users can create netzero targets"
ON public.netzero_targets
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
);

-- Update carbon_budgets insert policy
DROP POLICY IF EXISTS "Users can create carbon budgets" ON public.carbon_budgets;

CREATE POLICY "Users can create carbon budgets"
ON public.carbon_budgets
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
);

-- Update sustainability_credentials insert policy
DROP POLICY IF EXISTS "Users can create credentials" ON public.sustainability_credentials;

CREATE POLICY "Users can create credentials"
ON public.sustainability_credentials
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
);