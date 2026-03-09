-- Migration: Fix visibility of logs for Super Admin and Administrador
-- Date: 2026-03-08

-- 1. Ensure the logs table exists with the correct structure
CREATE TABLE IF NOT EXISTS public.logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    user_email text,
    action text NOT NULL,
    details jsonb,
    CONSTRAINT logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Enable RLS
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'logs'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.logs', pol.policyname);
    END LOOP;
END $$;

-- 4. Create new policies

-- Allow any authenticated user to insert logs (needed for auditing actions)
CREATE POLICY "Enable insert for authenticated users" 
ON public.logs 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow super_admin and administrador to view ALL logs
-- We use auth.jwt() to check the role from app_metadata to avoid profiles recursion
CREATE POLICY "Enable select for admins and super_admins" 
ON public.logs 
FOR SELECT 
TO authenticated 
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'administrador')
);

-- Deny UPDATE and DELETE to ensure logs are immutable
-- (RLS defaults to deny if no policy exists, but explicit is better if needed)

-- 5. Grant permissions
GRANT ALL ON public.logs TO authenticated;
GRANT ALL ON public.logs TO service_role;
