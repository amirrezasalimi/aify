import { useState } from "react";
import { SETTINGS } from "../constants";
import { getStorageValue } from "../utils/storage";
import { getOpenAI } from "../utils/openai";

interface UseTextTransformReturn {
  transform: (action: string, text: string) => Promise<string>;
  isLoading: boolean;
  error: string | null;
}

export const useTextTransform = (): UseTextTransformReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPromptForAction = (action: string, text: string): string => {
    return `${action} the following text, without extra talk or message:\n${text}`;
  };

  const transform = async (action: string, text: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const openai = await getOpenAI();
      const selectedModel = await getStorageValue(
        SETTINGS.SELECTED_MODEL,
        "gpt-3.5-turbo"
      );
      const prompt = getPromptForAction(action, text);

      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: selectedModel,
        temperature: 0.1,
      });

      const result = completion.choices[0]?.message?.content || "";
      setIsLoading(false);
      return result;
    } catch (err) {
      setIsLoading(false);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  return {
    transform,
    isLoading,
    error,
  };
};
