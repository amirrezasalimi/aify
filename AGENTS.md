# Aify contributor guide

- Use Bun: `bun install`, `bun run dev`, `bun run compile`, and `bun run build`. Commit `bun.lock` with dependency changes; do not generate an npm lockfile.
- Do not add or write tests in this repository, including temporary test files or test scripts.
- WXT does not launch a browser in dev mode. Load `.output/chrome-mv3` in your existing Chrome profile and reload the extension after restarting the dev server. The Chrome side panel lives in `src/entrypoints/sidepanel`; keep the in-page UI working on Firefox.
- Chat uses Vercel AI SDK with the OpenAI-compatible provider. Keep the shared chat UI, streaming, and versioned history working in both surfaces. Store conversations in extension-local storage; preserve structured tool calls and results and keep credentials out of chat records. Edits and regenerations create a separate history entry.
- Tools are opt-in per agent and must be enforced at execution. Keep page reads bound to the current page and treat page content as untrusted reference material.
- During development, run `bun run compile` and `bun run build` (Chrome only) before finishing code changes. Do not build for Firefox during development. For UI changes, inspect the sidebar and in-page modal manually when possible.
