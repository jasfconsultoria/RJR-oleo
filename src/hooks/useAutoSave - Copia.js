import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for auto-saving form data to local storage.
 *
 * @param {string} key - The key to use for storing data in local storage.
 * @param {any} initialValue - The initial value for the state.
 * @param {boolean} [shouldLoad=true] - Whether to load data from local storage on mount.
 * @returns {[any, Function, Function]} - [state, setState, clearSavedData]
 */
export const useAutoSave = (key, initialValue, shouldLoad = true) => {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined' || !shouldLoad) {
      return initialValue;
    }
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : initialValue;
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      return initialValue;
    }
  });

  useEffect(() => {
    if (shouldLoad && typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.error("Error saving to localStorage:", error);
      }
    }
  }, [key, state, shouldLoad]);

  const clearSavedData = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error("Error clearing from localStorage:", error);
      }
    }
  }, [key]);

  return [state, setState, clearSavedData];
};