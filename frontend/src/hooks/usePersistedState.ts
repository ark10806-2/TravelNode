import { useEffect, useState } from 'react';

export function usePersistedState<T>(
  storageKey: string,
  initialValue: T,
  isValidValue?: (value: unknown) => value is T
) {
  const [value, setValue] = useState<T>(() => {
    const storedValue = window.localStorage.getItem(storageKey);
    if (storedValue == null) return initialValue;

    try {
      const parsedValue = JSON.parse(storedValue) as unknown;
      return (isValidValue?.(parsedValue) ?? true) ? (parsedValue as T) : initialValue;
    } catch {
      return isValidValue?.(storedValue) ? storedValue : initialValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  }, [storageKey, value]);

  return [value, setValue] as const;
}
