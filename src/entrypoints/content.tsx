import "./content-style.css";
import ReactDOM from "react-dom/client";
import { AppMain } from "@/components/main";
import { createTheme, MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/core/styles.layer.css";

const theme = createTheme({
  /** Put your mantine theme override here */
});

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  async main(ctx) {
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
          <MantineProvider
            theme={theme}
            forceColorScheme="light"
            cssVariablesSelector="html"
            getRootElement={() => ui.shadow.querySelector("html")!}
          >
            <AppMain />
          </MantineProvider>
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
