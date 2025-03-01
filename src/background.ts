import OpenAI from "openai";
import browser from "webextension-polyfill";
import { getStorageValue, setStorageValue } from "./hooks/useLocalStorage";
import { SETTINGS } from "./constants";
import { getStyles } from "./utils/styles";

const cache = new Map<string, string>();
const MAX_CACHE_SIZE = 50;

browser.runtime.onInstalled.addListener(async (details) => {
  console.log("Extension installed:", details);
  const styles = await getStorageValue(SETTINGS.STYLE, "");
  if (!styles) {
    await setStorageValue(
      "style",
      `Summarize: Summarize\nEli5: Eli5\nTo English: Translate to English`
    );
  }
});

browser.runtime.onMessage.addListener(async (message: any) => {
  const { text, originalSelectedText, summaryLengthName } = message as {
    text: string;
    originalSelectedText: string;
    summaryLengthName: string;
  };

  const apiKey = await getStorageValue(SETTINGS.API_KEY, "");
  const endpoint = await getStorageValue(SETTINGS.ENDPOINT, "");
  const style = await getStorageValue(SETTINGS.STYLE, "");
  const selectedModel = await getStorageValue(SETTINGS.SELECTED_MODEL, "");

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

  const styles = await getStyles();
  const stylePrompt = styles[summaryLengthName];
  const prompt = `Please do ${stylePrompt} on the input text.
<text>
${text}
</text>
--------
- no extra text or note.
Response:
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
