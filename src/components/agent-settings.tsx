import { useState } from "react";
import { Button, Loader, Select, Stack, Switch, Text, TextInput, Textarea } from "@mantine/core";
import { SETTINGS } from "../constants";
import useLocalStorage from "../hooks/use-localstorage";
import { agentTools, type AgentProfile, type AgentToolId } from "../utils/agents";
import { AgentAvatar } from "./agent-avatar";
import { AgentToolIcon } from "./agent-tool-icon";

function randomToken() {
  // In-page settings also run on HTTP, where randomUUID is unavailable.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

interface AgentSettingsProps {
  useCustomApi: boolean;
  models: string[];
  isLoadingModels: boolean;
  modelsError: string | null;
}

function ToolSwitches({ tools, onChange }: {
  tools: AgentProfile["tools"];
  onChange: (tools: NonNullable<AgentProfile["tools"]>) => void;
}) {
  return (
    <Stack component="fieldset" gap="xs" className="min-w-0">
      <Text component="legend" size="sm" fw={500} mb="xs">Tools</Text>
      {(Object.keys(agentTools) as AgentToolId[]).map((id) => (
        <Switch
          key={id}
          label={<span className="inline-flex items-center gap-1.5"><AgentToolIcon tool={id} />{agentTools[id].label}</span>}
          description={agentTools[id].description}
          checked={tools?.[id] === true}
          onChange={(event) => onChange({ ...tools, [id]: event.currentTarget.checked })}
        />
      ))}
    </Stack>
  );
}

export function AgentSettings({ useCustomApi, models, isLoadingModels, modelsError }: AgentSettingsProps) {
  const [profiles, setProfiles, error] = useLocalStorage<AgentProfile[]>(SETTINGS.AGENT_PROFILES, []);
  const [defaultTools, setDefaultTools, defaultToolsError] = useLocalStorage<AgentProfile["tools"]>(SETTINGS.DEFAULT_AGENT_TOOLS, {});
  const [draft, setDraft] = useState<AgentProfile | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const autoModel = { value: "auto", label: "Auto (default)" };
  const savedModel = draft?.model;
  const modelOptions = [
    autoModel,
    ...models.map((model) => ({ value: `model:${model}`, label: model })),
  ];
  if (savedModel && !models.includes(savedModel)) {
    modelOptions.push({ value: `model:${savedModel}`, label: savedModel });
  }

  const save = (profile: AgentProfile) => {
    const name = profile.name.trim();
    const soul = profile.soul.trim();
    const seed = profile.seed.trim();
    if (!name || !soul || !seed) return;

    const saved = { ...profile, name, soul, seed };
    setProfiles((current) => current.some(({ id }) => id === saved.id)
      ? current.map((agent) => agent.id === saved.id ? saved : agent)
      : [...current, saved]);
    setDraft(null);
  };

  return (
    <Stack component="section" aria-label="Agent profiles" gap="xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text component="h2" size="sm" fw={600}>Agent profiles</Text>
        {!draft && (
          <Button size="xs" variant="light" onClick={() => {
            setRemovingId(null);
            setDraft({ id: randomToken(), name: "", soul: "", seed: randomToken() });
          }}>
            New agent
          </Button>
        )}
      </div>
      <Text size="xs" c="dimmed">
        Give each agent a soul: instructions for how it thinks, speaks, and responds.
      </Text>
      {error && <Text role="alert" size="xs" c="red">Could not {error.operation === "read" ? "load" : "save"} agent profiles.</Text>}
      {draft && (
        <form onSubmit={(event) => { event.preventDefault(); save(draft); }}>
          <Stack gap="xs" className="rounded-lg border border-gray-200 bg-aify-surface p-3">
            <TextInput label="Name" required maxLength={60} value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })} />
            <Textarea label="Soul" required minRows={3} maxRows={8} autosize value={draft.soul}
              placeholder="You are a friendly editor. Offer one concise suggestion at a time."
              onChange={(event) => setDraft({ ...draft, soul: event.currentTarget.value })} />
            {useCustomApi && (
              <Select
                label="Model"
                description="Auto uses the model selected in General settings."
                data={modelOptions}
                value={savedModel ? `model:${savedModel}` : autoModel.value}
                onChange={(value) => setDraft({
                  ...draft,
                  model: value?.startsWith("model:") ? value.slice("model:".length) : undefined,
                })}
                allowDeselect={false}
                searchable
                rightSection={isLoadingModels ? <Loader size="xs" /> : undefined}
                error={modelsError}
                comboboxProps={{ withinPortal: false }}
              />
            )}
            <div className="flex items-end gap-2">
              <AgentAvatar seed={draft.seed.trim()} size={36} />
              <TextInput className="min-w-0 flex-1" label="Avatar seed" required maxLength={120} value={draft.seed}
                onChange={(event) => setDraft({ ...draft, seed: event.currentTarget.value })} />
              <Button variant="default" onClick={() => setDraft({ ...draft, seed: randomToken() })}>Randomize</Button>
            </div>
            <ToolSwitches tools={draft.tools} onChange={(tools) => setDraft({ ...draft, tools })} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="xs" variant="default" onClick={() => setDraft(null)}>Cancel</Button>
              <Button size="xs" type="submit" disabled={!draft.name.trim() || !draft.soul.trim() || !draft.seed.trim()}>
                Save agent
              </Button>
            </div>
          </Stack>
        </form>
      )}
      <Stack component="section" gap="xs" className="rounded-lg border border-gray-200 bg-aify-surface p-3">
        <Text component="h3" size="sm" fw={600}>Aify (built-in)</Text>
        <ToolSwitches tools={defaultTools} onChange={setDefaultTools} />
        {defaultToolsError && <Text role="alert" size="xs" c="red">Could not {defaultToolsError.operation === "read" ? "load" : "save"} Aify’s tool settings.</Text>}
      </Stack>
      {!profiles.length && !draft && <Text size="xs" c="dimmed">No custom agents yet. Aify is always available in chat.</Text>}
      {profiles.map((agent) => (
        <div key={agent.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-aify-surface p-2">
          <AgentAvatar seed={agent.seed} size={30} />
          <Text className="min-w-0 flex-1" size="sm" truncate>{agent.name}</Text>
          {removingId === agent.id ? (
            <>
              <Button size="xs" variant="default" onClick={() => setRemovingId(null)}>Cancel</Button>
              <Button size="xs" color="red" onClick={() => {
                setProfiles((current) => current.filter(({ id }) => id !== agent.id));
                setRemovingId(null);
              }}>Confirm removal</Button>
            </>
          ) : (
            <>
              <Button size="xs" variant="subtle" aria-label={`Edit ${agent.name}`} disabled={!!draft} onClick={() => {
                setRemovingId(null);
                setDraft({ ...agent });
              }}>Edit</Button>
              <Button size="xs" variant="subtle" color="red" aria-label={`Remove ${agent.name}`} disabled={!!draft}
                onClick={() => setRemovingId(agent.id)}>Remove</Button>
            </>
          )}
        </div>
      ))}
    </Stack>
  );
}
