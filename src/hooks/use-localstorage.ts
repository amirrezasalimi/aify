import { localExtStorage } from "@webext-core/storage";
import { useState, useEffect, useCallback, useRef } from "react";

type StorageError = {
  key: string;
  operation: "read" | "write";
  error: unknown;
};

const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [
  T,
  (value: T | ((prevState: T) => T)) => void,
  StorageError | null
] => {
  // Use a ref to store the initial value to avoid dependency array issues
  const initialValueRef = useRef(initialValue);

  // Initialize state lazily from storage or with the initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    // Note: This synchronous read might not be ideal for extension storage,
    // but we'll fetch asynchronously in useEffect anyway.
    // This primarily sets the *initial* state before the effect runs.
    return initialValueRef.current;
  });
  const [error, setError] = useState<StorageError | null>(null);

  // Effect to fetch initial value and subscribe to changes
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component

    const fetchValue = async () => {
      try {
        const raw = await localExtStorage.getItem(key);
        if (isMounted) {
          if (raw !== null) {
            setStoredValue(JSON.parse(raw));
          } else {
            // Set the initial value in storage only if it doesn't exist
            await localExtStorage.setItem(
              key,
              JSON.stringify(initialValueRef.current)
            );
            // No need to setStoredValue here as it's already initialized
          }
          setError(null);
        }
      } catch (e) {
        console.error(`Error reading localStorage key “${key}”:`, e);
        if (isMounted) {
          setError({ key, operation: "read", error: e });
        }
      }
    };

    fetchValue();

    // Subscribe to changes from other tabs/windows/contexts
    const unsub = localExtStorage.onChange(key, (newValue, oldValue) => {
      if (isMounted && newValue !== null) {
        try {
          // Check if the new value is actually different from the current state
          // to avoid unnecessary re-renders if the change originated from this hook instance
          const parsedNewValue = JSON.parse(newValue);
          setStoredValue((currentValue) => {
            // Basic comparison, might need deep comparison for complex objects
            if (
              JSON.stringify(currentValue) !== JSON.stringify(parsedNewValue)
            ) {
              return parsedNewValue;
            }
            return currentValue;
          });
          setError(null);
        } catch (e) {
          console.error(`Error parsing storage change for key “${key}”:`, e);
          setError({ key, operation: "read", error: e });
        }
      } else if (isMounted && newValue === null) {
        // Handle item removal if necessary, maybe reset to initialValue?
        // setStoredValue(initialValueRef.current);
      }
    });

    // Cleanup function
    return () => {
      isMounted = false;
      unsub();
    };
  }, [key]); // Only depend on the key

  // Memoized setter function
  const setValue = useCallback(
    (value: T | ((prevState: T) => T)) => {
      try {
        // Update local state immediately first
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        
        // Then update storage asynchronously
        localExtStorage.setItem(key, JSON.stringify(valueToStore))
          .catch((e) => {
            console.error(`Error setting localStorage key "${key}":`, e);
            setError({ key, operation: "write", error: e });
          });
          
        setError(null);
      } catch (e) {
        console.error(`Error setting localStorage key "${key}":`, e);
        setError({ key, operation: "write", error: e });
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue, error];
};

export default useLocalStorage;
