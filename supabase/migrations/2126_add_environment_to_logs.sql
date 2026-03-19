-- Migration: Add environment column to logs table
-- Date: 2026-03-19

ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS environment text;

-- Opção: Marcar logs antigos como 'producao' se desejar retroatividade parcial
-- UPDATE public.logs SET environment = 'producao' WHERE environment IS NULL;
