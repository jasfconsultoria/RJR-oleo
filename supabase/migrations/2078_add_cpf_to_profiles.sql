-- Migration: Adicionar campos CPF e telefone à tabela profiles
-- Este campo permite armazenar o CPF e telefone dos usuários (coletores e administradores)

-- Adicionar coluna CPF à tabela profiles (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'cpf'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN cpf text;
        
        -- Adicionar comentário à coluna
        COMMENT ON COLUMN public.profiles.cpf IS 'CPF do usuário (formato: apenas números)';
    END IF;
END $$;

-- Adicionar coluna telefone à tabela profiles (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'telefone'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN telefone text;
        
        -- Adicionar comentário à coluna
        COMMENT ON COLUMN public.profiles.telefone IS 'Telefone do usuário (formato: apenas números)';
    END IF;
END $$;

-- Atualizar a função handle_new_user para incluir CPF
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Use a BEGIN/EXCEPTION block to catch errors and prevent them from blocking auth
  BEGIN
    INSERT INTO public.profiles (id, full_name, role, estado, municipio, cpf, telefone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      COALESCE(NEW.raw_app_meta_data->>'role', 'coletor')::user_role,
      NEW.raw_app_meta_data->>'estado',
      NEW.raw_app_meta_data->>'municipio',
      NEW.raw_user_meta_data->>'cpf',
      NEW.raw_user_meta_data->>'telefone'
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      role = COALESCE(EXCLUDED.role::user_role, profiles.role),
      estado = COALESCE(EXCLUDED.estado, profiles.estado),
      municipio = COALESCE(EXCLUDED.municipio, profiles.municipio),
      cpf = COALESCE(EXCLUDED.cpf, profiles.cpf),
      telefone = COALESCE(EXCLUDED.telefone, profiles.telefone);
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the auth operation
      RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
      -- Return NEW anyway to allow auth to proceed
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar a função get_all_users para retornar CPF e telefone
-- Primeiro, remover a função existente para poder alterar o tipo de retorno
DROP FUNCTION IF EXISTS public.get_all_users();

-- Recriar a função com o novo tipo de retorno incluindo telefone
CREATE FUNCTION public.get_all_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role user_role,
  estado text,
  municipio text,
  cpf text,
  telefone text,
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
    p.cpf,
    p.telefone,
    COALESCE(au.created_at, NOW()) as created_at
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  ORDER BY 
    CASE WHEN p.role = 'administrador' THEN 0 ELSE 1 END,
    p.full_name;
END;
$$;

-- Adicionar comentário atualizado
COMMENT ON FUNCTION public.get_all_users() IS 
'Returns all users from profiles table (source of truth) with email from auth.users. Profiles table is the primary source for role, full_name, estado, municipio, cpf, and telefone.';
