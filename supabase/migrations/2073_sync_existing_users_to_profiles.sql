-- Sync existing users from auth.users to profiles table
-- This migration ensures that all existing users in auth.users have a corresponding record in profiles

INSERT INTO public.profiles (id, full_name, role, estado, municipio)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
  COALESCE(au.raw_app_meta_data->>'role', 'coletor')::user_role as role,
  au.raw_app_meta_data->>'estado' as estado,
  au.raw_app_meta_data->>'municipio' as municipio
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
  role = COALESCE(EXCLUDED.role::user_role, profiles.role),
  estado = COALESCE(EXCLUDED.estado, profiles.estado),
  municipio = COALESCE(EXCLUDED.municipio, profiles.municipio);

-- This migration syncs all existing users from auth.users to profiles
-- It will create profiles for users that don't have one yet

