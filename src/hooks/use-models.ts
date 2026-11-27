import { useState, useEffect } from "react";
import { parseApiEndpoint } from "../utils/api";

interface UseModelsReturn {
  models: string[];
  isLoading: boolean;
  error: string | null;
}

const emptyModels: UseModelsReturn = { models: [], isLoading: false, error: null };

export const useModels = (endpoint: string, key: string): UseModelsReturn => {
  const baseURL = parseApiEndpoint(endpoint)?.href.replace(/\/+$/, "");
  const apiKey = key.trim();
  const [result, setResult] = useState<{
    baseURL: string;
    apiKey: string;
    data: UseModelsReturn;
  } | null>(null);

  useEffect(() => {
    setResult(null);
    if (!baseURL) return;

    const controller = new AbortController();
    // Wait for provider settings to settle before requesting the model list.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${baseURL}/models`, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not load models.");
        const { data } = await response.json() as { data: { id: string }[] };
        const models = [...new Set(data.map(({ id }) => id).filter((id) => typeof id === "string" && id))];
        if (!controller.signal.aborted) {
          setResult({ baseURL, apiKey, data: { models, isLoading: false, error: null } });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({ baseURL, apiKey, data: { ...emptyModels, error: "Could not load models from the custom API." } });
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [baseURL, apiKey]);

  if (!baseURL) return emptyModels;
  if (result?.baseURL === baseURL && result.apiKey === apiKey) return result.data;
  return { ...emptyModels, isLoading: true };
};
