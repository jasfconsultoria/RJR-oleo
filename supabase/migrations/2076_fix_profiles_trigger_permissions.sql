-- Fix trigger permissions and ensure profiles table allows trigger operations
-- This fixes the "Database error granting user" error during login

-- 1. Ensure the function has proper permissions
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER;

-- 2. Grant necessary permissions to the function owner (postgres role)
-- The function runs as SECURITY DEFINER, so it should have permissions
-- But we need to ensure the function can insert/update in profiles

-- 3. Make sure the trigger only runs on INSERT, not on UPDATE (to avoid issues during login)
-- UPDATE triggers can cause issues during token refresh/login
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate trigger to only run on INSERT (new user creation)
-- This prevents the trigger from running during login/update operations
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Add error handling to the function to prevent failures from blocking auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Use a BEGIN/EXCEPTION block to catch errors and prevent them from blocking auth
  BEGIN
    INSERT INTO public.profiles (id, full_name, role, estado, municipio)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      COALESCE(NEW.raw_app_meta_data->>'role', 'coletor')::user_role,
      NEW.raw_app_meta_data->>'estado',
      NEW.raw_app_meta_data->>'municipio'
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      role = COALESCE(EXCLUDED.role::user_role, profiles.role),
      estado = COALESCE(EXCLUDED.estado, profiles.estado),
      municipio = COALESCE(EXCLUDED.municipio, profiles.municipio);
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the auth operation
      RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
      -- Return NEW anyway to allow auth to proceed
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ensure RLS policies allow the trigger to work
-- Check if profiles table has RLS enabled and create policy if needed
DO $$
BEGIN
  -- Check if RLS is enabled on profiles
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles'
  ) THEN
    -- Ensure authenticated users can read their own profile
    -- The trigger runs as SECURITY DEFINER, so it bypasses RLS
    -- But we should ensure users can read their profiles
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Users can read own profile'
    ) THEN
      CREATE POLICY "Users can read own profile" 
      ON public.profiles 
      FOR SELECT 
      TO authenticated 
      USING (auth.uid() = id);
    END IF;
  END IF;
END $$;

-- Add comment
COMMENT ON FUNCTION public.handle_new_user() IS 
'Automatically creates a profile record in public.profiles when a new user is created in auth.users. Uses user_metadata for full_name and app_metadata for role, estado, and municipio. Includes error handling to prevent auth failures.';

