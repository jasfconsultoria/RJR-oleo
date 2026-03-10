-- Migration: Create RPC for distinct actions in logs
-- Date: 2026-03-10

CREATE OR REPLACE FUNCTION public.get_distinct_log_actions()
RETURNS TABLE (action text) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT l.action::text
  FROM public.logs l
  ORDER BY 1;
END;
$$;
