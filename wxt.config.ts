import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite(env) {
    return {
      plugins: [tailwindcss()],
    };
  },
  manifest: {
    permissions: ["storage", "activeTab", "scripting"],
    web_accessible_resources: [
      {
        resources: ["/icon/128.png"],
        matches: ["<all_urls>"],
      },
    ],
    action: {},
  },
  srcDir: "src",
});
