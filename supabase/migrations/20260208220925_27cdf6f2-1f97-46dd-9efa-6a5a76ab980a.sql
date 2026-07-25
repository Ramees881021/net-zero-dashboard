-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Insert admin role for the master account (will be done after user exists)
-- We'll handle this via a trigger or manual insert

-- Allow admins to view all profiles
DROP POLICY IF EXISTS "Users can view own profile or org members" ON public.profiles;
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  OR public.is_admin(auth.uid())
);

-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Allow admins to view all emissions data
DROP POLICY IF EXISTS "Users can view emissions data" ON public.emissions_data;
CREATE POLICY "Users can view emissions data"
ON public.emissions_data
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  OR public.is_admin(auth.uid())
);

-- Allow admins to manage emissions data
CREATE POLICY "Admins can insert emissions data"
ON public.emissions_data
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()) OR (auth.uid() = user_id AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))));

CREATE POLICY "Admins can update emissions data"
ON public.emissions_data
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete emissions data"
ON public.emissions_data
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Allow admins to view all clients
DROP POLICY IF EXISTS "Users can view clients" ON public.clients;
CREATE POLICY "Users can view clients"
ON public.clients
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  OR public.is_admin(auth.uid())
);

-- Allow admins to view all netzero targets
DROP POLICY IF EXISTS "Users can view netzero targets" ON public.netzero_targets;
CREATE POLICY "Users can view netzero targets"
ON public.netzero_targets
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  OR public.is_admin(auth.uid())
);

-- Allow admins to view all carbon budgets
DROP POLICY IF EXISTS "Users can view carbon budgets" ON public.carbon_budgets;
CREATE POLICY "Users can view carbon budgets"
ON public.carbon_budgets
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  OR public.is_admin(auth.uid())
);

-- Allow admins to view all sustainability credentials
DROP POLICY IF EXISTS "Users can view credentials" ON public.sustainability_credentials;
CREATE POLICY "Users can view credentials"
ON public.sustainability_credentials
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  OR public.is_admin(auth.uid())
);