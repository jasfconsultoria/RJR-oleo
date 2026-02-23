DROP FUNCTION IF EXISTS public.get_financeiro_detailed_report(date, date, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_financeiro_detailed_report(date, date, text, text, text, text, integer, integer, text, text);
DROP FUNCTION IF EXISTS public.get_financeiro_detailed_report(text, text, date, integer, integer, date, text, text);

DROP FUNCTION IF EXISTS public.get_financeiro_detailed_report_count(date, date, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_financeiro_detailed_report_count(date, date, text, text, text, text, text, text);

DROP FUNCTION IF EXISTS public.get_financeiro_summary(date, date, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_financeiro_summary(date, date, text, text, uuid, text);

DROP FUNCTION IF EXISTS public.get_financeiro_detailed_receipt(text, text, date, integer, integer, date, text, text);
DROP FUNCTION IF EXISTS public.get_financeiro_detailed_receipt_count(date, date, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_financeiro_summary_receipt(date, date, text, text, text, text);