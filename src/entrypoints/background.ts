import { sendMessage } from "../utils/messaging";
import { browser } from "wxt/browser";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async (details) => {
    console.log("Extension installed:", details);
  });

  (browser.action ?? browser.browserAction).onClicked.addListener(
    async (tab) => {
      if (tab.id) {
        await sendMessage(
          "toggleCoreModal",
          { visible: true },
          { tabId: tab.id }
        );
      }
    }
  );
});
