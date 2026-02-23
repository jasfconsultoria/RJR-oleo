-- Fix foreign key constraint for coletas.user_id
-- This migration ensures that the user_id foreign key references auth.users(id) correctly
-- and allows NULL values with ON DELETE SET NULL for better data integrity

-- First, ensure the user_id column allows NULL (if it doesn't already)
ALTER TABLE public.coletas
ALTER COLUMN user_id DROP NOT NULL;

-- Drop existing constraint if it exists
ALTER TABLE public.coletas
DROP CONSTRAINT IF EXISTS coletas_user_id_fkey;

-- Add the correct foreign key constraint referencing auth.users(id)
ALTER TABLE public.coletas
ADD CONSTRAINT coletas_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add a comment to document the constraint
COMMENT ON CONSTRAINT coletas_user_id_fkey ON public.coletas IS 
'Foreign key constraint linking coletas to auth.users. Allows NULL values and sets to NULL on user deletion.';

