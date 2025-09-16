import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';

export function useAutoSave(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : initialValue;
    } catch (error) {
      console.error("Erro ao ler do localStorage:", error);
      return initialValue;
    }
  });

  const debouncedValue = useDebounce(value, 500); // Salva a cada 500ms de inatividade

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(debouncedValue));
    } catch (error) {
      console.error("Erro ao escrever no localStorage:", error);
    }
  }, [key, debouncedValue]);

  const clearSavedData = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Erro ao limpar o localStorage:", error);
    }
  }, [key]);

  return [value, setValue, clearSavedData];
}