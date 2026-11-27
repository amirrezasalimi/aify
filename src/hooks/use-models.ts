import { useState, useEffect } from "react";

interface UseModelsReturn {
  models: string[];
  isLoading: boolean;
  error: string | null;
}

const emptyModels: UseModelsReturn = { models: [], isLoading: false, error: null };

export const useModels = (enabled: boolean, endpoint: string, apiKey: string): UseModelsReturn => {
  const baseURL = endpoint.trim();
  const [result, setResult] = useState<{
    baseURL: string;
    apiKey: string;
    data: UseModelsReturn;
  } | null>(null);

  useEffect(() => {
    setResult(null);
    if (!enabled || !baseURL) return;

    const controller = new AbortController();
    // Wait for provider settings to settle before requesting the model list.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${baseURL.replace(/\/+$/, "")}/models`, {
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
  }, [enabled, baseURL, apiKey]);

  if (!enabled || !baseURL) return emptyModels;
  if (result?.baseURL === baseURL && result.apiKey === apiKey) return result.data;
  return { ...emptyModels, isLoading: true };
};
