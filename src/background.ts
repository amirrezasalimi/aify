import OpenAI from "openai";
import browser from "webextension-polyfill";
import { getStorageValue } from "./hooks/useLocalStorage";

const cache = new Map<string, string>();
const MAX_CACHE_SIZE = 50;

browser.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed:", details);
});

browser.runtime.onMessage.addListener(async (message: any) => {
  const { text, originalSelectedText, summaryLengthName } = message as {
    text: string;
    originalSelectedText: string;
    summaryLengthName: string;
  };

  const apiKey = await getStorageValue("apiKey", "");
  const endpoint = await getStorageValue("endpoint", "");
  const style = await getStorageValue("style", "");
  const selectedModel = await getStorageValue("selectedModel", "");

  if (!text) {
    return;
  }
  console.log(`style: `, style);
  console.log(`summaryLengthName: `, summaryLengthName);
  console.log(`originalSelectedText: `, originalSelectedText);

  const oai = new OpenAI({
    baseURL: endpoint,
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  });

  if (summaryLengthName === "Original") {
    return originalSelectedText;
  }

  const cacheKey = JSON.stringify({ text, style, summaryLengthName });

  if (cache.get(cacheKey)) {
    console.log("Returning cached summary");
    return cache.get(cacheKey);
  }

  const prompt = `
Summarize the following text while ensuring it meets the following criteria:

1. **Length**: The summary should be ${summaryLengthName} in length.
2. **Tone**: The summary should have a ${style} tone.
3. **Content**: Ensure the summary is clear, concise, and captures the key points accurately.
4. Do not include extra text or note.

TEXT: ${text}

Summary:
`;

  try {
    const completion = await oai.chat.completions.create({
      model: selectedModel, // Replace with your preferred model
      messages: [
        {
          role: "assistant",
          content: prompt,
        },
      ],
      temperature: 0,
    });

    const aiSummary = completion.choices[0].message.content;
    console.log("AI Summary:\n", aiSummary);
    cache.set(cacheKey, aiSummary || "");

    if (cache.size > MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
        console.log("Cache eviction: removed oldest entry");
      }
    }

    return Promise.resolve(aiSummary);
  } catch (error) {
    console.error("Error during AI summarization:", error);
    return Promise.resolve(`Error: Could not summarize text.\n${error}`);
  }
});
