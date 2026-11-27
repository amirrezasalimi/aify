import { browser } from "wxt/browser";
import { sendMessage } from "./messaging";
import { readPage } from "./read-page";
import type { PageSnapshot } from "./read-page";

type PageReader = () => Promise<PageSnapshot>;

export async function bindCurrentPage(sidebar: boolean): Promise<PageReader> {
  if (!sidebar) {
    const originalUrl = location.href;
    return async () => {
      if (location.href !== originalUrl) throw new Error("Page changed.");
      return readPage();
    };
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const id = tab?.id;
  if (id == null) throw new Error("No active tab.");
  const target = { tabId: id, frameId: 0 };
  const expectedUrl = tab.url ?? await sendMessage("identifyCurrentPage", undefined, target);
  return async () => {
    const [activeTab] = await browser.tabs.query({ active: true, windowId: tab.windowId });
    if (activeTab?.id !== id) throw new Error("Active tab changed.");
    return sendMessage("readCurrentPage", { expectedUrl }, target);
  };
}
