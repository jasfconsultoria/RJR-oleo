-- Migration: Fix logs RPC and sync roles to app_metadata
-- Date: 2026-03-21

-- 1. Create RPC to get distinct log actions
CREATE OR REPLACE FUNCTION public.get_distinct_log_actions()
RETURNS TABLE (action text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT l.action
    FROM public.logs l
    ORDER BY l.action;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_distinct_log_actions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_log_actions() TO service_role;

-- 2. Sync roles from public.profiles to auth.users.raw_app_meta_data
-- This is necessary because RLS for logs depends on auth.jwt() claims
-- and some users might have been created without the role in app_metadata.
-- We also ensure 'estado' and 'municipio' are preserved.

DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT p.id, p.role::text as role_text, p.estado, p.municipio 
        FROM public.profiles p
    LOOP
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object(
                'role', user_record.role_text,
                'estado', COALESCE(user_record.estado, (raw_app_meta_data->>'estado')),
                'municipio', COALESCE(user_record.municipio, (raw_app_meta_data->>'municipio'))
            )
        WHERE id = user_record.id;
    END LOOP;
END $$;

COMMENT ON FUNCTION public.get_distinct_log_actions() IS 'Returns a list of unique actions from the logs table for filtering.';
