import "./style.css";
import { registerEstedadFont } from "@/utils/estedad-font";
import "@mantine/core/styles.layer.css";
import "@mantine/notifications/styles.layer.css";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ActionIcon, Title } from "@mantine/core";
import { AifyThemeProvider } from "@/components/aify-theme-provider";
import { Notifications } from "@mantine/notifications";
import { IconArrowLeft, IconHistory, IconSettings } from "@tabler/icons-react";
import ChatPanel from "@/components/chat-panel";
import { ChatHistoryPanel } from "@/components/chat-history-panel";
import type { SavedChat } from "@/utils/chat-history";
import { SettingsPanel } from "@/components/settings-panel";
import { pickPageAttachmentInTab } from "@/utils/pick-page-attachment";
import { PENDING_ELEMENT_ACTION, type ElementActionRequest } from "@/utils/page-attachment";
import { browser } from "wxt/browser";

function SidePanel() {
  const [view, setView] = useState<"Chat" | "History" | "Settings">("Chat");
  const [resume, setResume] = useState<SavedChat>();
  const [running, setRunning] = useState(false);
  const [pendingActions, setPendingActions] = useState<Record<string, ElementActionRequest>>({});
  const [pendingKey, pendingAction] = Object.entries(pendingActions)[0] ?? [];

  useEffect(() => {
    let active = true;
    let stopListening: (() => void) | undefined;
    void browser.windows.getCurrent().then(({ id }) => {
      const storage = browser.storage.session;
      if (!active || id == null || !storage) return;
      const prefix = `${PENDING_ELEMENT_ACTION}${id}:`;
      const receive = (items: Record<string, unknown>) => {
        if (!active) return;
        const incoming = Object.entries(items).filter((entry): entry is [string, ElementActionRequest] => {
          const [key, value] = entry;
          return key.startsWith(prefix) && !!value && typeof value === "object" && "action" in value && "attachment" in value;
        });
        if (!incoming.length) return;
        setPendingActions((current) => ({ ...current, ...Object.fromEntries(incoming) }));
        setResume(undefined);
        setView("Chat");
      };
      const changed: Parameters<typeof storage.onChanged.addListener>[0] = (changes) => {
        receive(Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.newValue])));
      };
      storage.onChanged.addListener(changed);
      stopListening = () => storage.onChanged.removeListener(changed);
      return storage.get(null).then(receive);
    }).catch((error) => console.error("Could not load Quick Actions:", error));
    return () => { active = false; stopListening?.(); };
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-neutral-50">
      <header className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-aify-surface p-3">
        <div className="flex items-center gap-2">
          {view !== "Chat" && (
            <ActionIcon
              variant="subtle"
              aria-label="Back to chat"
              onClick={() => setView("Chat")}
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          )}
          <Title order={1} size="h4">
            {view === "Chat" ? "Aify Chat" : view}
          </Title>
        </div>
        {view === "Chat" && (
          <div className="flex gap-2">
            <ActionIcon
              variant="subtle"
              aria-label="History"
              title="History"
              onClick={() => setView("History")}
            >
              <IconHistory size={18} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              aria-label="Settings"
              title="Settings"
              onClick={() => setView("Settings")}
            >
              <IconSettings size={18} />
            </ActionIcon>
          </div>
        )}
      </header>
      <main className="min-h-0 flex-1 overflow-auto p-2">
        <div className="h-full" hidden={view !== "Chat"}>
          <ChatPanel sidebar resumeChat={resume} onRunningChange={setRunning} pickPageAttachment={pickPageAttachmentInTab} savedAction={pendingAction} onSavedActionStart={() => {
            if (!pendingKey) return;
            setPendingActions(({ [pendingKey]: consumed, ...rest }) => rest);
            void browser.storage.session.remove(pendingKey).catch((error) => console.error("Could not clear submitted Quick Action:", error));
          }} />
        </div>
        {view === "History" && <ChatHistoryPanel running={running} onResume={(chat) => { setResume({ ...chat }); setView("Chat"); }} />}
        {view === "Settings" && <SettingsPanel pickPageAttachment={pickPageAttachmentInTab} />}
      </main>
    </div>
  );
}

registerEstedadFont();
createRoot(document.getElementById("root")!).render(
  <AifyThemeProvider>
    <Notifications position="bottom-center" />
    <SidePanel />
  </AifyThemeProvider>
);
