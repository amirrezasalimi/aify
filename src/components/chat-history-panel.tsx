import { Button, Loader, Stack, Tabs, Text } from "@mantine/core";
import { IconMessageCircle, IconHistory } from "@tabler/icons-react";
import { useChatHistory } from "../hooks/use-chat-history";
import type { SavedChat } from "../utils/chat-history";
import { HistoryPanel } from "./history-panel";
import { ErrorPopover } from "./error-popover";

export function ChatHistoryPanel({ onResume, running }: { onResume: (chat: SavedChat) => void; running: boolean }) {
  const { chats, loading, error } = useChatHistory();
  return (
    <Tabs defaultValue="chats">
      <Tabs.List aria-label="History sections">
        <Tabs.Tab value="chats" leftSection={<IconMessageCircle size={16} />}>Chats</Tabs.Tab>
        <Tabs.Tab value="actions" leftSection={<IconHistory size={16} />}>Text actions</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="chats" pt="sm">
        <Stack gap="xs">
          {loading && <Loader size="sm" aria-label="Loading chats" />}
          {error && <div className="flex items-center gap-1"><Text size="sm" c="red" role="alert">Could not load saved chats.</Text><ErrorPopover label="Chat history failed to load" details={error} /></div>}
          {!loading && !error && !chats.length && <Text size="sm" c="dimmed" ta="center" py="md">No saved chats yet</Text>}
          {chats.map((chat) => {
            const last = chat.turns.at(-1)!;
            return (
              <div key={chat.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-aify-surface p-2">
                <div className="min-w-0 flex-1">
                  <Text size="sm" fw={600} truncate dir="auto" className="aify-message-text">{chat.turns[0].input}</Text>
                  <Text size="xs" c="dimmed">{last.agentName} · {new Date(chat.updatedAt).toLocaleString()}</Text>
                  {last.text && <Text size="xs" lineClamp={2} dir="auto" className="aify-message-text [overflow-wrap:anywhere]">{last.text}</Text>}
                  {last.status === "running" && <Text size="xs" c="dimmed">{last.activity.at(-1)?.label ?? "Reply in progress"}</Text>}
                  {last.status === "error" && (
                    <div className="flex items-center gap-1">
                      <Text size="xs" c="red">Reply failed</Text>
                      <ErrorPopover label="Reply failed" details={last.error ?? "No error details were saved for this reply."} />
                    </div>
                  )}
                </div>
                <Button size="xs" variant="light" disabled={running} onClick={() => onResume(chat)}>Resume</Button>
              </div>
            );
          })}
        </Stack>
      </Tabs.Panel>
      <Tabs.Panel value="actions" pt="sm"><HistoryPanel /></Tabs.Panel>
    </Tabs>
  );
}
