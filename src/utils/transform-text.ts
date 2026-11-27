import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { API, SETTINGS } from "../constants";
import { errorDetails } from "./error-details";
import type { TransformTextMessage } from "./messaging";
import { getStorageValue } from "./storage";

export async function transformText({ action, text }: TransformTextMessage) {
  if (typeof action !== "string" || typeof text !== "string" || !action.trim() || !text.trim()) {
    throw new Error("Choose a text action and select some text first.");
  }

  // Only use the endpoint configured in extension settings, never a URL supplied by a message.
  const [custom, endpoint, apiKey, selectedModel] = await Promise.all([
    getStorageValue(SETTINGS.USE_CUSTOM_API, false),
    getStorageValue(SETTINGS.API_ENDPOINT, ""),
    getStorageValue(SETTINGS.API_KEY, ""),
    getStorageValue(SETTINGS.SELECTED_MODEL, "gpt-3.5-turbo"),
  ]);
  const baseURL = custom ? endpoint.trim() : API;
  let url: URL;
  try {
    url = new URL(baseURL);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error();
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS API endpoint in Settings → General.");
  }

  try {
    const provider = createOpenAICompatible({ name: "aify", baseURL, apiKey: custom ? apiKey.trim() : "empty" });
    const { text: result } = await generateText({
      prompt: `${action} the following text, without extra talk or message:\n${text}`,
      model: provider(selectedModel || "gpt-3.5-turbo"),
      temperature: 0.1,
      telemetry: { isEnabled: false },
    });
    return result;
  } catch (error) {
    const details = errorDetails(error, "Could not complete the text action.", custom ? apiKey.trim() : undefined);
    const hint = /\b401\b/.test(details) && custom ? " Check the API key in Settings → General." :
      /failed to fetch|networkerror|network error/i.test(details) ? ` Check that the API at ${url.origin} is running and reachable.` : "";
    throw new Error(details + hint);
  }
}
