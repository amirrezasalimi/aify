import { localExtStorage } from "@webext-core/storage";

const getStorageValue = async <T>(key: string, defaultValue: T): Promise<T> => {
  try {
    const value = await localExtStorage.getItem(key);

    return typeof value == "string" && value.trim() != ""
      ? JSON.parse(value)
      : defaultValue;
  } catch (error) {
    console.error(`Error getting storage value for key "${key}":`, error);
    return defaultValue;
  }
};

const setStorageValue = async <T>(key: string, value: T): Promise<void> => {
  try {
    await localExtStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting storage value for key "${key}":`, error);
  }
};

export { getStorageValue, setStorageValue };
