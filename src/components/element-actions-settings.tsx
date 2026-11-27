import { useEffect, useRef, useState } from "react";
import { ActionIcon, Alert, Button, Select, Stack, TextInput, Textarea, Text } from "@mantine/core";
import { IconDeviceFloppy, IconPlus, IconTrash } from "@tabler/icons-react";
import useLocalStorage from "../hooks/use-localstorage";
import { SETTINGS } from "../constants";
import { defaultAgent, type AgentProfile } from "../utils/agents";
import type { ElementAction, PickPageAttachment } from "../utils/page-attachment";
import { newChatId } from "../utils/chat-history";

export function ElementActionsSettings({ profiles, onPick }: { profiles: AgentProfile[]; onPick: PickPageAttachment }) {
  const [actions, setActions] = useLocalStorage<ElementAction[]>(SETTINGS.ELEMENT_ACTIONS, []);
  const [editing, setEditing] = useState<ElementAction>();
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string>();
  const selection = useRef<AbortController | null>(null);
  useEffect(() => () => selection.current?.abort(), []);
  const agents = [defaultAgent, ...profiles];

  const pickArea = async () => {
    if (selection.current) return;
    const controller = new AbortController();
    selection.current = controller;
    setPickError(undefined);
    setPicking(true);
    try {
      const attachment = await onPick(controller.signal);
      if (!attachment || controller.signal.aborted) return;
      if (!attachment.selector || !attachment.pageHost) {
        throw new Error("The page picker did not return an element selector. Reload Aify, refresh the webpage, and select the area again.");
      }
      const action: ElementAction = {
        id: newChatId(), title: attachment.label || "Analyze element",
        instruction: "Analyze this content and summarize the key points.", agentId: defaultAgent.id,
        ...editing, selector: attachment.selector, host: attachment.pageHost,
      };
      setEditing(action);
    } catch (error) {
      if (!controller.signal.aborted) setPickError(error instanceof Error ? error.message : "Could not start the page picker.");
    } finally {
      selection.current = null;
      setPicking(false);
    }
  };

  return <Stack gap="sm">
    <Text size="sm" c="dimmed">Save a page area as a reusable action. When a matching element appears on this site, its button opens a new chat with the captured content.</Text>
    {actions.map((action) => <div key={action.id} className="flex items-center justify-between gap-2 rounded border border-gray-200 p-2">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(action)}>
        <span className="block truncate text-sm font-medium">{action.title}</span><span className="block truncate text-xs text-gray-500">{action.host} · {action.selector}</span>
      </button>
      <div className="flex items-center gap-1"><ActionIcon variant="subtle" aria-label={`Edit ${action.title}`} onClick={() => setEditing(action)}><IconDeviceFloppy size={16} /></ActionIcon><ActionIcon color="red" variant="subtle" aria-label={`Delete ${action.title}`} onClick={() => setActions((items) => items.filter(({ id }) => id !== action.id))}><IconTrash size={16} /></ActionIcon></div>
    </div>)}
    {picking
      ? <Button variant="default" onClick={() => selection.current?.abort()}>Cancel area selection</Button>
      : <Button leftSection={<IconPlus size={15} />} onClick={() => void pickArea()}>Select area on page</Button>}
    {pickError && <Alert color="red" title="Area selection failed">{pickError}</Alert>}
    {editing && <Stack gap="xs" className="rounded border border-blue-200 bg-blue-50 p-3">
      <Text fw={600} size="sm">{editing.selector ? "Edit saved action" : "New saved action"}</Text>
      <TextInput label="Button title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.currentTarget.value })} />
      <Textarea label="Instruction" description="Sent to the selected agent with the captured text and images." minRows={3} autosize value={editing.instruction} onChange={(e) => setEditing({ ...editing, instruction: e.currentTarget.value })} />
      <Select label="Default agent" value={editing.agentId} data={agents.map(({ id, name }) => ({ value: id, label: name }))} onChange={(agentId) => agentId && setEditing({ ...editing, agentId })} allowDeselect={false} comboboxProps={{ withinPortal: false }} />
      <div className="flex justify-end gap-2"><Button size="xs" variant="default" onClick={() => setEditing(undefined)}>Cancel</Button><Button size="xs" leftSection={<IconDeviceFloppy size={14} />} disabled={!editing.title.trim() || !editing.instruction.trim() || !editing.selector} onClick={() => { setActions((items) => [...items.filter(({ id }) => id !== editing.id), editing]); setEditing(undefined); }}>Save action</Button></div>
    </Stack>}
    {picking && <p className="text-xs text-gray-500" role="status">On the webpage, click the area you want, then click the yellow + to confirm. Escape cancels.</p>}
  </Stack>;
}
