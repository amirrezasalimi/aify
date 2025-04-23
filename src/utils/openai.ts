import OpenAI from "openai";
import { API, SETTINGS } from "../constants";
import { getStorageValue } from "./storage";

export const getOpenAI = async () => {
  const apiKey = await getStorageValue(SETTINGS.API_KEY, "");
  const apiEndpoint = await getStorageValue(SETTINGS.API_ENDPOINT, "");
  const useCustomApi = await getStorageValue(SETTINGS.USE_CUSTOM_API, false);

  const aiChatService = `${API}/`;
  return new OpenAI({
    apiKey: useCustomApi ? apiKey : "empty",
    baseURL: useCustomApi ? apiEndpoint : aiChatService,
    dangerouslyAllowBrowser: true,
  });
};
