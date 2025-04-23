import { useState, useEffect } from "react";
import { getOpenAI } from "../utils/openai";

interface UseModelsReturn {
  models: string[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useModels = (): UseModelsReturn => {
  const [models, setModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const openai = await getOpenAI();
      const response = await openai.models.list();
      const modelIds = response.data.map((model) => model.id);

      setModels(modelIds);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  return {
    models,
    isLoading,
    error,
    refetch: fetchModels,
  };
};
