-- Fix get_all_users function to use profiles table as source of truth
-- This ensures that when we update profiles, the changes are reflected immediately

-- Drop the old function if it exists
DROP FUNCTION IF EXISTS public.get_all_users();

-- Create the new function that uses profiles as the primary source
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role user_role,
  estado text,
  municipio text,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    COALESCE(au.email, '')::text as email,
    COALESCE(p.full_name, '')::text as full_name,
    p.role,
    p.estado,
    p.municipio,
    COALESCE(au.created_at, NOW()) as created_at
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  ORDER BY 
    CASE WHEN p.role = 'administrador' THEN 0 ELSE 1 END,
    p.full_name;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.get_all_users() IS 
'Returns all users from profiles table (source of truth) with email from auth.users. Profiles table is the primary source for role, full_name, estado, and municipio.';

