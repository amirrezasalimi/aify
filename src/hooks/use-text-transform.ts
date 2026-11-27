import { useState } from "react";
import { sendMessage } from "../utils/messaging";

interface UseTextTransformReturn {
  transform: (action: string, text: string) => Promise<string>;
  isLoading: boolean;
  error: string | null;
}

export const useTextTransform = (): UseTextTransformReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transform = async (action: string, text: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      return await sendMessage("transformText", { action, text });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    transform,
    isLoading,
    error,
  };
};
