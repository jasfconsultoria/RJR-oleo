import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';

export function useAutoSave(key, initialValue, enabled = true) {
  const [value, setValue] = useState(() => {
    if (!enabled) return initialValue;
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : initialValue;
    } catch (error) {
      console.error("Erro ao ler do localStorage:", error);
      return initialValue;
    }
  });

  const debouncedValue = useDebounce(value, 500);

  useEffect(() => {
    if (enabled) {
      try {
        localStorage.setItem(key, JSON.stringify(debouncedValue));
      } catch (error) {
        console.error("Erro ao escrever no localStorage:", error);
      }
    }
  }, [key, debouncedValue, enabled]);

  const clearSavedData = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Erro ao limpar o localStorage:", error);
    }
  }, [key]);

  // Limpa os dados quando o componente é desmontado
  useEffect(() => {
    return () => {
      if (enabled) {
        clearSavedData();
      }
    };
  }, [enabled, clearSavedData]);

  return [value, setValue, clearSavedData];
}