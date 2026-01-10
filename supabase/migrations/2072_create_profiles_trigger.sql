-- Create trigger to automatically create profile when user is created in auth.users
-- This ensures that every user in auth.users has a corresponding record in profiles

-- First, create a function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add a comment to document the trigger
COMMENT ON FUNCTION public.handle_new_user() IS 
'Automatically creates or updates a profile record in public.profiles when a user is created or updated in auth.users. Uses user_metadata for full_name and app_metadata for role, estado, and municipio.';

