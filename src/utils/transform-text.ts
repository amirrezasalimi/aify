import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { SETTINGS } from "../constants";
import { requireApiEndpoint, requireApiModel } from "./api";
import { errorDetails } from "./error-details";
import type { TransformTextMessage } from "./messaging";
import { getStorageValue } from "./storage";

export async function transformText({ action, text }: TransformTextMessage) {
  if (typeof action !== "string" || typeof text !== "string" || !action.trim() || !text.trim()) {
    throw new Error("Choose a text action and select some text first.");
  }

  // Only use the endpoint configured in extension settings, never a URL supplied by a message.
  const [endpoint, savedKey, selectedModel] = await Promise.all([
    getStorageValue(SETTINGS.API_ENDPOINT, ""),
    getStorageValue(SETTINGS.API_KEY, ""),
    getStorageValue(SETTINGS.SELECTED_MODEL, ""),
  ]);
  const url = requireApiEndpoint(endpoint);
  const baseURL = url.href.replace(/\/+$/, "");
  const model = requireApiModel(selectedModel);
  const apiKey = savedKey.trim() || undefined;

  try {
    const provider = createOpenAICompatible({ name: "aify", baseURL, apiKey });
    const { text: result } = await generateText({
      prompt: `${action} the following text, without extra talk or message:\n${text}`,
      model: provider(model),
      temperature: 0.1,
      telemetry: { isEnabled: false },
    });
    return result;
  } catch (error) {
    const details = errorDetails(error, "Could not complete the text action.", apiKey);
    const hint = /\b401\b/.test(details) ? " Check the API key in Settings → General." :
      /failed to fetch|networkerror|network error/i.test(details) ? ` Check that the API at ${url.origin} is running and reachable.` : "";
    throw new Error(details + hint);
  }
}
