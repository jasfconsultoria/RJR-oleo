import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook para salvamento automático no localStorage, com segregação por ambiente (Supabase URL).
 */
export const useAutoSave = (key, initialData, shouldLoadFromStorage = true) => {
  // ✅ CORREÇÃO: Gerar uma chave única baseada no ambiente atual para evitar cross-contamination
  // Usamos a URL do Supabase como parte da chave
  const activeUrl = supabase.supabaseUrl || 'default';
  
  // Criar um hash simples ou sufixo da URL para a chave
  const environmentSuffix = useMemo(() => {
    try {
      const url = new URL(activeUrl);
      return url.hostname.split('.')[0]; // Pega o 'rnuqxwgnlukgdqxerwcu' da URL
    } catch (e) {
      return 'main';
    }
  }, [activeUrl]);

  const envKey = `${key}_${environmentSuffix}`;

  const [data, setData] = useState(() => {
    if (typeof window === 'undefined' || !shouldLoadFromStorage) {
      return initialData;
    }
    
    try {
      const saved = localStorage.getItem(envKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    
    return initialData;
  });

  const setDataWithSave = useCallback((newData) => {
    setData(prev => {
      const result = typeof newData === 'function' ? newData(prev) : newData;
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(envKey, JSON.stringify(result));
        } catch (error) {
          console.error('Error saving to localStorage:', error);
        }
      }
      
      return result;
    });
  }, [envKey]);

  const clearSavedData = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(envKey);
    }
    setData(initialData);
  }, [envKey, initialData]);

  return [data, setDataWithSave, clearSavedData];
};