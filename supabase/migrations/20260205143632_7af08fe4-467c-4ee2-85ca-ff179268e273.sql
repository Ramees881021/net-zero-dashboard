-- Update emissions_data INSERT policy to allow both org members AND individual users
DROP POLICY IF EXISTS "Org members can create emissions data" ON public.emissions_data;
CREATE POLICY "Users can create emissions data"
ON public.emissions_data
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    organization_id IS NULL OR
    is_org_member(auth.uid(), organization_id)
  )
);

-- Update emissions_data SELECT policy
DROP POLICY IF EXISTS "Org members can view emissions data" ON public.emissions_data;
CREATE POLICY "Users can view emissions data"
ON public.emissions_data
FOR SELECT
USING (
  auth.uid() = user_id OR
  (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
);

-- Update emissions_data UPDATE policy
DROP POLICY IF EXISTS "Org admins can update emissions data" ON public.emissions_data;
CREATE POLICY "Users can update emissions data"
ON public.emissions_data
FOR UPDATE
USING (
  auth.uid() = user_id OR
  (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
);

-- Update emissions_data DELETE policy
DROP POLICY IF EXISTS "Org admins can delete emissions data" ON public.emissions_data;
CREATE POLICY "Users can delete emissions data"
ON public.emissions_data
FOR DELETE
USING (
  auth.uid() = user_id OR
  (organization_id IS NOT NULL AND is_org_admin_or_owner(auth.uid(), organization_id))
);