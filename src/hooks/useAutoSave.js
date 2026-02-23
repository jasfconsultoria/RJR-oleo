import { useState, useEffect, useCallback } from 'react';

export const useAutoSave = (key, initialData, shouldLoadFromStorage = true) => {
  // ✅ CORREÇÃO: Remover a negação lógica que causava o problema
  const [data, setData] = useState(() => {
    if (typeof window === 'undefined' || !shouldLoadFromStorage) {
      return initialData;
    }
    
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    
    return initialData;
  });

  // ... resto do hook mantido igual
  const setDataWithSave = useCallback((newData) => {
    setData(prev => {
      const result = typeof newData === 'function' ? newData(prev) : newData;
      
      // Salva no localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, JSON.stringify(result));
        } catch (error) {
          console.error('Error saving to localStorage:', error);
        }
      }
      
      return result;
    });
  }, [key]);

  const clearSavedData = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
    setData(initialData);
  }, [key, initialData]);

  return [data, setDataWithSave, clearSavedData];
};