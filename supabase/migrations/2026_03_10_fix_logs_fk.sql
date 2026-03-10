-- Migration: Fix logs foreign key to profiles
-- Date: 2026-03-10

-- Change foreign key from auth.users to public.profiles to allow PostgREST joins
ALTER TABLE public.logs DROP CONSTRAINT IF EXISTS logs_user_id_fkey;

ALTER TABLE public.logs
ADD CONSTRAINT logs_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;
