-- Fix netzero_targets RLS policies
DROP POLICY IF EXISTS "Org members can view netzero targets" ON public.netzero_targets;
DROP POLICY IF EXISTS "Org members can create netzero targets" ON public.netzero_targets;
DROP POLICY IF EXISTS "Org admins can update netzero targets" ON public.netzero_targets;
DROP POLICY IF EXISTS "Org admins can delete netzero targets" ON public.netzero_targets;

CREATE POLICY "Users can view netzero targets"
ON public.netzero_targets FOR SELECT
USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can create netzero targets"
ON public.netzero_targets FOR INSERT
WITH CHECK (auth.uid() = user_id AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can update netzero targets"
ON public.netzero_targets FOR UPDATE
USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can delete netzero targets"
ON public.netzero_targets FOR DELETE
USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_admin_or_owner(auth.uid(), organization_id)));

-- Fix carbon_budgets RLS policies
DROP POLICY IF EXISTS "Org members can view carbon budgets" ON public.carbon_budgets;
DROP POLICY IF EXISTS "Org members can create carbon budgets" ON public.carbon_budgets;
DROP POLICY IF EXISTS "Org admins can update carbon budgets" ON public.carbon_budgets;
DROP POLICY IF EXISTS "Org admins can delete carbon budgets" ON public.carbon_budgets;

CREATE POLICY "Users can view carbon budgets"
ON public.carbon_budgets FOR SELECT
USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can create carbon budgets"
ON public.carbon_budgets FOR INSERT
WITH CHECK (auth.uid() = user_id AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can update carbon budgets"
ON public.carbon_budgets FOR UPDATE
USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can delete carbon budgets"
ON public.carbon_budgets FOR DELETE
USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_admin_or_owner(auth.uid(), organization_id)));

-- Fix clients RLS policies
DROP POLICY IF EXISTS "Org members can view clients" ON public.clients;
DROP POLICY IF EXISTS "Org members can create clients" ON public.clients;
DROP POLICY IF EXISTS "Org members can update clients" ON public.clients;
DROP POLICY IF EXISTS "Org admins can delete clients" ON public.clients;

CREATE POLICY "Users can view clients"
ON public.clients FOR SELECT
USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can create clients"
ON public.clients FOR INSERT
WITH CHECK (auth.uid() = user_id AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can update clients"
ON public.clients FOR UPDATE
USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can delete clients"
ON public.clients FOR DELETE
USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_admin_or_owner(auth.uid(), organization_id)));