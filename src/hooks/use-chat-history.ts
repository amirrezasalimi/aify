import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { CHAT_PREFIX, type SavedChat } from "../utils/chat-history";
import { errorDetails } from "../utils/error-details";

function isChat(value: unknown): value is SavedChat {
  if (!value || typeof value !== "object") return false;
  const chat = value as Partial<SavedChat>;
  return chat.version === 1 && typeof chat.id === "string" && Array.isArray(chat.turns) && chat.turns.length > 0;
}

export function useChatHistory() {
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let disposed = false;
    const changed = new Set<string>();
    const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== "local") return;
      const entries = Object.entries(changes).filter(([key]) => key.startsWith(CHAT_PREFIX));
      if (!entries.length) return;
      const ids = new Set(entries.map(([key]) => key.slice(CHAT_PREFIX.length)));
      ids.forEach((id) => changed.add(id));
      setChats((current) => [
        ...current.filter(({ id }) => !ids.has(id)),
        ...entries.map(([, value]) => value.newValue).filter(isChat),
      ]);
    };
    browser.storage.onChanged.addListener(listener);
    browser.storage.local.get(null).then((items) => {
      if (disposed) return;
      const saved = Object.entries(items).filter(([key]) => key.startsWith(CHAT_PREFIX)).map(([, value]) => value).filter(isChat);
      setChats((current) => [...current, ...saved.filter(({ id }) => !changed.has(id))]);
    }).catch((error) => { if (!disposed) setError(errorDetails(error, "Browser storage could not be read.")); }).finally(() => { if (!disposed) setLoading(false); });
    return () => {
      disposed = true;
      browser.storage.onChanged.removeListener(listener);
    };
  }, []);

  return { chats: [...chats].sort((a, b) => b.updatedAt - a.updatedAt), loading, error };
}
