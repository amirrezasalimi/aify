import { useState, useEffect, useCallback } from "react";
import browser from "webextension-polyfill";

export async function getStorageValue<T>(
  key: string,
  defaultValue: T
): Promise<T> {
  try {
    const result = await browser.storage.local.get(key);
    const item = result[key];
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(
      `Error getting data from browser.storage.local for key "${key}":`,
      error
    );
    return defaultValue;
  }
}

export async function setStorageValue<T>(key: string, value: T) {
  try {
    await browser.storage.local.set({ [key]: JSON.stringify(value) });
  } catch (error) {
    console.error(
      `Error setting data to browser.storage.local for key "${key}":`,
      error
    );
  }
}

// Custom hook for localStorage
function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (newValue: T) => void] {
  const [value, setValue] = useState<T>(() => {
    let initialValue: T = defaultValue;
    getStorageValue(key, defaultValue).then((val) => {
      initialValue = val;
      setValue(val);
    });
    return initialValue;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return; // Handle server-side rendering
    }

    const handleStorageChange = (
      changes: { [key: string]: any },
      areaName: string
    ) => {
      if (areaName === "local" && changes[key]) {
        try {
          setValue(
            changes[key].newValue
              ? JSON.parse(changes[key].newValue as string)
              : defaultValue
          );
        } catch (error) {
          console.error(
            `Error parsing data from browser.storage.local for key "${key}":`,
            error
          );
        }
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [key, defaultValue]);

  const updateValue = useCallback(
    (newValue: T) => {
      try {
        // Save to browser.storage.local
        browser.storage.local.set({ [key]: JSON.stringify(newValue) });
        // Update state
        setValue(newValue);
      } catch (error) {
        console.error(
          `Error setting data to browser.storage.local for key "${key}":`,
          error
        );
      }
    },
    [key, setValue]
  );

  return [value, updateValue];
}

export default useLocalStorage;
