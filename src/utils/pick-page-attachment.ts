import { browser } from "wxt/browser";
import { BLOCK_MARKER_PICKER_PORT, BLOCK_PICKER_PORT, PAGE_PICKER_PORT, type PagePickerMessage, type PickPageAttachment, type PagePickerResult } from "./page-attachment";

export const pickPageAttachmentInTab: PickPageAttachment = async (signal, mode) => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  signal.throwIfAborted();
  if (tab?.id == null) throw new Error("Open a webpage before attaching an element.");
  const name = typeof mode === "object" ? BLOCK_MARKER_PICKER_PORT : mode === "block" ? BLOCK_PICKER_PORT : PAGE_PICKER_PORT;
  const port = browser.tabs.connect(tab.id, { name, frameId: 0 });
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      port.disconnect();
      reject(new Error("Aify could not reach this page. Refresh the page and try selecting the area again."));
    }, 5_000);
    const finish = (result: PagePickerResult) => {
      cleanup();
      port.disconnect();
      if ("error" in result) reject(new Error(result.error));
      else resolve(result.attachment);
    };
    const disconnected = () => {
      cleanup();
      const detail = browser.runtime.lastError?.message;
      reject(new Error(`The picker lost its connection to the page. Refresh a regular webpage and try again.${detail ? ` (${detail})` : ""}`));
    };
    const receive = (message: PagePickerMessage) => {
      if ("ready" in message) clearTimeout(timeout);
      else finish(message);
    };
    const cancel = () => finish({ attachment: null });
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      port.onMessage.removeListener(receive);
      port.onDisconnect.removeListener(disconnected);
    };
    port.onMessage.addListener(receive);
    port.onDisconnect.addListener(disconnected);
    signal.addEventListener("abort", cancel, { once: true });
    if (typeof mode === "object") port.postMessage(mode);
  });
};
