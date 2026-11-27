import { onMessage, sendMessage } from "../utils/messaging";
import { browser } from "wxt/browser";
import { PENDING_ELEMENT_ACTION } from "../utils/page-attachment";
import { transformText } from "../utils/transform-text";
import { localExtStorage } from "@webext-core/storage";
import { SETTINGS } from "../constants";
import { blockDayKey, recentBlockDays, type BlockStats } from "../utils/block-stats";
import type { ElementBlockRule } from "../utils/element-blocking";

export default defineBackground(() => {
  // Serialize updates from different tabs so a read/modify/write cannot lose a count.
  let blockStatsQueue = Promise.resolve();
  onMessage("recordBlockedElements", ({ data, sender }) => {
    if (sender.id !== browser.runtime.id || sender.tab?.id == null || sender.frameId !== 0 || !sender.url) return;
    const host = new URL(sender.url).hostname;
    const now = new Date();
    const day = blockDayKey(now);
    const oldest = blockDayKey(recentBlockDays(now).at(-1)!);
    const update = blockStatsQueue.then(async () => {
      const rawRules = await localExtStorage.getItem(SETTINGS.ELEMENT_BLOCK_RULES);
      const rules: ElementBlockRule[] = rawRules ? JSON.parse(rawRules) : [];
      const ruleIds = new Set(rules.filter((rule) => rule.host === host).map(({ id }) => id));
      const counts = data.filter(({ ruleId, count }) => ruleIds.has(ruleId) && Number.isSafeInteger(count) && count > 0);
      if (!counts.length) return;

      const rawStats = await localExtStorage.getItem(SETTINGS.ELEMENT_BLOCK_STATS);
      const previous: BlockStats = rawStats ? JSON.parse(rawStats) : {};
      const stats: BlockStats = Object.create(null);
      for (const { id } of rules) {
        if (!Object.hasOwn(previous, id)) continue;
        const { total, daily } = previous[id];
        stats[id] = { total, daily: Object.fromEntries(Object.entries(daily).filter(([date]) => date >= oldest)) };
      }
      for (const { ruleId, count } of counts) {
        const item = stats[ruleId] ??= { total: 0, daily: {} };
        item.total += count;
        item.daily[day] = (item.daily[day] ?? 0) + count;
      }
      await localExtStorage.setItem(SETTINGS.ELEMENT_BLOCK_STATS, JSON.stringify(stats));
    });
    blockStatsQueue = update.catch(() => {});
    return update;
  });
  onMessage("transformText", ({ data, sender }) => {
    if (sender.id !== browser.runtime.id) throw new Error("Invalid text action sender.");
    return transformText(data);
  });
  onMessage("launchSavedElementAction", async ({ data, sender }) => {
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    if (tabId == null || windowId == null) throw new Error("The page tab is no longer available.");
    if (browser.sidePanel?.open && browser.storage.session) {
      try {
        // Open before awaiting anything: Chrome requires the click's user gesture.
        await browser.sidePanel.open({ windowId });
        await browser.storage.session.set({
          [`${PENDING_ELEMENT_ACTION}${windowId}:${data.attachment.id}`]: data,
        });
        return;
      } catch (error) {
        console.debug("Could not launch Quick Action in the side panel:", error);
      }
    }
    await sendMessage("runSavedElementAction", data, { tabId, frameId: 0 });
  });
  const registerModalAction = () => {
    (browser.action ?? browser.browserAction).onClicked.addListener(async (tab) => {
      if (tab.id == null) return;

      try {
        await sendMessage(
          "toggleCoreModal",
          { visible: true },
          { tabId: tab.id }
        );
      } catch (error) {
        // Restricted pages do not have an Aify content script.
        console.debug("Could not open Aify in this tab:", error);
      }
    });
  };

  if (
    import.meta.env.CHROME &&
    import.meta.env.MANIFEST_VERSION === 3 &&
    browser.sidePanel?.setPanelBehavior
  ) {
    browser.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => {
        console.warn("Could not configure the Aify side panel:", error);
        registerModalAction();
      });
  } else {
    registerModalAction();
  }
});
