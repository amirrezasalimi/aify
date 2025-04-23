import { useState, useCallback, useEffect } from "react";
import useLocalStorage from "./use-localstorage";
import { getOpenAI } from "../utils/openai";
import { getStorageValue } from "../utils/storage";
import { SETTINGS } from "../constants";

export interface Message {
  role: "user" | "assistant";
  content: string;
  isReloading?: boolean;
}

export type ChatTune =
  | "Professional"
  | "Creative"
  | "Friendly"
  | "Direct"
  | "Technical";
export type ResponseLength = "short" | "normal" | "long";

interface ChatConfig {
  tune: ChatTune;
  responseLength: ResponseLength;
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useLocalStorage("chatConfig", {
    tune: "Professional" as ChatTune,
    responseLength: "normal" as ResponseLength,
  });

  const getTunePrompt = (tune: ChatTune) => {
    const tunePrompts = {
      Professional: "Respond in a professional and formal manner",
      Creative: "Be creative and think outside the box",
      Friendly: "Respond in a friendly and casual tone",
      Direct: "Be concise and straight to the point",
      Technical: "Use technical language and precise terms",
    };
    return tunePrompts[tune];
  };

  const getLengthPrompt = (length: ResponseLength) => {
    const lengthPrompts = {
      short: "Keep responses very brief and concise",
      normal: "Provide standard-length responses",
      long: "Provide detailed and comprehensive responses",
    };
    return lengthPrompts[length];
  };

  const getSystemPrompt = (
    tune: ChatTune,
    responseLength: ResponseLength,
    context?: string
  ) => {
    return `${getTunePrompt(tune)}.\n${getLengthPrompt(responseLength)}.\n${
      context
        ? `Context: "${context}"\n Answer or perform actions toward this context.`
        : ""
    }`;
  };

  const sendMessage = async (content: string, context?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const openai = await getOpenAI();
      const selectedModel = await getStorageValue(
        SETTINGS.SELECTED_MODEL,
        "gpt-3.5-turbo"
      );

      const newMessage: Message = { role: "user", content };
      setMessages((prev) => [...prev, newMessage]);

      const systemPrompt = getSystemPrompt(
        config.tune,
        config.responseLength,
        context
      );

      const messagesToSend = [
        { role: "system" as const, content: systemPrompt },
        newMessage,
      ];

      const completion = await openai.chat.completions.create({
        messages: messagesToSend,
        model: selectedModel,
        temperature: 0.7,
      });

      const assistantMessage: Message = {
        role: "assistant",
        content: completion.choices[0]?.message?.content || "",
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
    }
  };

  const reloadMessage = async (messageIndex: number, context?: string) => {
    if (messageIndex < 0 || messageIndex >= messages.length) return;
    setIsLoading(true);
    setError(null);

    try {
      const openai = await getOpenAI();
      const selectedModel = await getStorageValue(
        SETTINGS.SELECTED_MODEL,
        "gpt-3.5-turbo"
      );

      const messagesToSend = messages.slice(0, messageIndex);
      setMessages((prev) => prev.slice(0, messageIndex));

      const systemPrompt = getSystemPrompt(
        config.tune,
        config.responseLength,
        context
      );
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          ...messagesToSend.map(({ role, content }) => ({ role, content })),
        ],
        model: selectedModel,
        temperature: 0.7,
      });

      const newMessage = completion.choices[0]?.message?.content || "";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: newMessage,
          isReloading: false,
        },
      ]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
    }
    setIsLoading(false);
  };

  const clearMessages = () => setMessages([]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    reloadMessage,
    config,
    setConfig,
  };
};
