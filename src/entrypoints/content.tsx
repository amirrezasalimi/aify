import "./content-style.css";
import { registerEstedadFont } from "@/utils/estedad-font";
import ReactDOM from "react-dom/client";
import { AppMain } from "@/components/main";
import { AifyThemeProvider } from "@/components/aify-theme-provider";
import "@mantine/core/styles.css";
import "@mantine/core/styles.layer.css";
import { onMessage } from "@/utils/messaging";
import { readPage } from "@/utils/read-page";
import { highlightBlockInspection, type ElementBlockRule } from "@/utils/element-blocking";
import { getStorageValue } from "@/utils/storage";
import { SETTINGS } from "@/constants";
import { browser } from "wxt/browser";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  async main(ctx) {
    registerEstedadFont();
    let inspection: string | undefined;
    let clearInspection: (() => void) | undefined;
    ctx.onInvalidated(() => { inspection = undefined; clearInspection?.(); });
    ctx.onInvalidated(onMessage("inspectBlockRule", async ({ data, sender }) => {
      if (sender.id !== browser.runtime.id) return;
      if (!data.target && inspection !== data.token) return;
      inspection = data.target ? data.token : undefined;
      clearInspection?.();
      clearInspection = undefined;
      if (!data.target) return;
      const rules = await getStorageValue<ElementBlockRule[]>(SETTINGS.ELEMENT_BLOCK_RULES, []);
      if (inspection !== data.token) return;
      const rule = rules.find(({ id }) => id === data.target?.ruleId);
      if (rule) clearInspection = highlightBlockInspection(rule, data.target);
    }));
    ctx.onInvalidated(onMessage("identifyCurrentPage", () => location.href));
    const stopReading = onMessage("readCurrentPage", ({ data }) => {
      if (location.href !== data.expectedUrl) {
        throw new Error("The page changed. Send your message again to read it.");
      }
      return readPage();
    });
    ctx.onInvalidated(stopReading);

    const ui = await createShadowRootUi(ctx, {
      name: "text-transformer-ui",
      position: "inline",
      anchor: "body",
      onMount: (container) => {
        const app = document.createElement("div");
        app.id = "text-transformer-root";
        container.append(app);

        const root = ReactDOM.createRoot(app);
        root.render(
          <AifyThemeProvider
            cssVariablesSelector="html"
            getRootElement={() => ui.shadow.querySelector("html")!}
          >
            <AppMain />
          </AifyThemeProvider>
        );
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
