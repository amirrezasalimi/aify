import { useState, useRef, useEffect } from "react";
import { useChat } from "../hooks/use-chat";
import { toolErrorDetails, type SavedChat } from "../utils/chat-history";
import {
  IconSend,
  IconPlus,
  IconPencil,
  IconPlayerStop,
  IconReload,
  IconTrash,
  IconPaperclip,
} from "@tabler/icons-react";
import { ActionIcon, Button, Select, Combobox, Textarea, useCombobox } from "@mantine/core";
import useLocalStorage from "../hooks/use-localstorage";
import { SETTINGS, defaultTextActions } from "../constants";
import { defaultAgent, type AgentProfile } from "../utils/agents";
import { AgentAvatar } from "./agent-avatar";
import { ErrorPopover } from "./error-popover";
import { AgentToolIcon } from "./agent-tool-icon";
import { ResponseMarkdown } from "./response-markdown";
import { AttachmentPopover } from "./attachment-popover";
import { MAX_ATTACHMENTS, removeAttachmentChunk, type ElementActionRequest, type PageAttachment, type PickPageAttachment } from "../utils/page-attachment";
import { errorDetails } from "../utils/error-details";
import { getStorageValue } from "../utils/storage";

interface ChatPanelProps {
  context?: string;
  onContextChange?: (context: string | null) => void;
  sidebar?: boolean;
  resumeChat?: SavedChat;
  onRunningChange?: (running: boolean) => void;
  pickPageAttachment: PickPageAttachment;
  savedAction?: ElementActionRequest;
  onSavedActionStart?: () => void;
}

const ChatPanel = ({ context, onContextChange, sidebar = false, resumeChat, onRunningChange, pickPageAttachment, savedAction, onSavedActionStart }: ChatPanelProps) => {
  const combobox = useCombobox();
  const [textActions] = useLocalStorage(
    SETTINGS.TEXT_ACTIONS,
    defaultTextActions
  );
  const [selectedLanguages] = useLocalStorage(SETTINGS.TRANSLATION_LANGUAGES, [
    "English",
  ]);
  const [profiles] = useLocalStorage<AgentProfile[]>(SETTINGS.AGENT_PROFILES, []);
  const [defaultTools] = useLocalStorage<AgentProfile["tools"]>(SETTINGS.DEFAULT_AGENT_TOOLS, {});
  const [selectedAgentId, setSelectedAgentId] = useLocalStorage(
    SETTINGS.SELECTED_AGENT,
    defaultAgent.id
  );
  const builtInAgent = { ...defaultAgent, tools: defaultTools };
  const agents = [builtInAgent, ...profiles];
  const selectedAgent = agents.find(({ id }) => id === selectedAgentId) ?? builtInAgent;

  const {
    turns,
    isLoading,
    saveError,
    run,
    newChat,
    stop,
  } = useChat(selectedAgent, sidebar, resumeChat);

  const [input, setInput] = useState("");
  const [edit, setEdit] = useState<{ id: string; text: string } | null>(null);
  const [isCommandMode, setIsCommandMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<PageAttachment[]>([]);
  const [includeImages, setIncludeImages] = useState(true);
  const [picking, setPicking] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string>();
  const picker = useRef<AbortController | null>(null);
  const startedAction = useRef<string>(undefined);
  useEffect(() => () => picker.current?.abort(), []);

  async function attachPageElement() {
    if (picker.current || attachments.length >= MAX_ATTACHMENTS || isLoading) return;
    const abort = new AbortController();
    picker.current = abort;
    setPicking(true);
    setAttachmentError(undefined);
    try {
      const item = await pickPageAttachment(abort.signal);
      if (item && !abort.signal.aborted) setAttachments((items) =>
        items.some(({ text, images }) => text === item.text &&
          (images?.length ?? 0) === (item.images?.length ?? 0) &&
          (images ?? []).every(({ url }) => item.images?.some((image) => image.url === url)))
          ? items : [...items, item].slice(0, MAX_ATTACHMENTS));
    } catch (error) {
      if (!abort.signal.aborted) setAttachmentError(errorDetails(error, "Could not start the page picker."));
    } finally {
      picker.current = null;
      setPicking(false);
    }
  }

  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container || edit) return;
    if (!isLoading || container.scrollHeight - container.scrollTop - container.clientHeight < 150) {
      container.scrollTop = container.scrollHeight;
    }
  }, [turns, isLoading, edit]);

  useEffect(() => {
    if (!resumeChat) return;
    picker.current?.abort();
    setAttachments([]);
    setIncludeImages(true);
    setAttachmentError(undefined);
    setEdit(null);
    const agentId = resumeChat.turns.at(-1)?.agentId;
    if (agentId) setSelectedAgentId(agentId);
  }, [resumeChat]);

  useEffect(() => {
    if (!savedAction || isLoading || startedAction.current === savedAction.attachment.id) return;
    let cancelled = false;
    void Promise.all([
      getStorageValue<AgentProfile[]>(SETTINGS.AGENT_PROFILES, []),
      getStorageValue<AgentProfile["tools"]>(SETTINGS.DEFAULT_AGENT_TOOLS, {}),
    ]).then(([savedProfiles, tools]) => {
      if (cancelled) return;
      const agent = savedProfiles.find(({ id }) => id === savedAction.action.agentId) ?? { ...defaultAgent, tools };
      startedAction.current = savedAction.attachment.id;
      picker.current?.abort();
      setSelectedAgentId(agent.id);
      setInput("");
      setAttachments([]);
      setIncludeImages(true);
      setAttachmentError(undefined);
      setEdit(null);
      setIsCommandMode(false);
      combobox.closeDropdown();
      onContextChange?.(null);
      void run(savedAction.action.instruction, undefined, undefined, [savedAction.attachment], agent);
      onSavedActionStart?.();
    });
    return () => { cancelled = true; };
  }, [savedAction, isLoading]);

  useEffect(() => {
    onRunningChange?.(isLoading);
    return () => onRunningChange?.(false);
  }, [isLoading, onRunningChange]);

  const getCommandOptions = () => {
    const actions = textActions.split("\n").filter(Boolean);
    const translateActions = selectedLanguages.map(
      (lang) => `Translate to ${lang}`
    );
    return [...actions, ...translateActions];
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    if (value === "/") {
      setIsCommandMode(true);
      combobox.openDropdown();
    } else if (isCommandMode && !value.startsWith("/")) {
      setIsCommandMode(false);
      combobox.closeDropdown();
    }
  };

  const handleCommandSelect = (command: string) => {
    setInput(command + " ");
    setIsCommandMode(false);
    combobox.closeDropdown();
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading || picker.current) return;
    const text = input.trim();
    setInput("");
    setAttachments([]);
    setAttachmentError(undefined);
    setIncludeImages(true);
    const outgoing = includeImages ? attachments : attachments.flatMap(({ id, label, text, truncated }) =>
      text.trim() ? [{ id, label, text, truncated }] : []);
    await run(text, context, undefined, outgoing);
  };

  return (
    <div className="flex flex-col h-full">
      {context && (
        <div className="flex justify-between items-center gap-2 bg-blue-50 p-2 border-b border-blue-100">
          <div className="text-blue-700 text-sm line-clamp-2">
            Context: <bdi className="aify-message-text">{context}</bdi>
          </div>
          <Button
            variant="subtle"
            color="blue"
            size="xs"
            onClick={() => onContextChange?.(null)}
          >
            <IconTrash size={14} />
          </Button>
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-4 p-4 overflow-auto">
        {turns.length === 0 && (
          <div className="flex flex-col gap-2 mt-8 text-gray-500 text-center">
            <h2 className="font-semibold text-lg">Welcome to Aify!</h2>
            <p className="text-sm">
              {sidebar
                ? "Type a message to chat, or enter / to pick an action."
                : 'Select text on any webpage and click "Aify" to choose chat or other actions.'}
            </p>
          </div>
        )}
        {turns.map((turn, index) => (
          <div key={turn.id} className="space-y-2">
            <div className="group flex items-start justify-end gap-1">
              {edit?.id !== turn.id && (
                <ActionIcon size="xs" variant="subtle" color="gray" aria-label="Edit message"
                  title="Edit message" disabled={isLoading || picking}
                  className="mt-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => setEdit({ id: turn.id, text: turn.input })}>
                  <IconPencil size={12} />
                </ActionIcon>
              )}
              <div className="max-w-[80%] min-w-0 rounded-lg bg-blue-100 p-3">
                {edit?.id === turn.id ? (
                  <div className="space-y-2">
                    <Textarea autoFocus aria-label="Edit user message" autosize minRows={2} value={edit.text}
                      dir="auto" classNames={{ input: "aify-message-text" }}
                      onChange={(event) => setEdit({ id: turn.id, text: event.currentTarget.value })}
                      onKeyDown={(event) => { if (event.key === "Escape") setEdit(null); }} />
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="compact-xs" variant="subtle" onClick={() => setEdit(null)}>Cancel</Button>
                      <Button size="compact-xs" disabled={isLoading || picking || !edit.text.trim()} onClick={() => {
                        void run(edit.text.trim(), turn.context, index, turn.attachments);
                        setEdit(null);
                      }}>Save and resend</Button>
                    </div>
                  </div>
                ) : <div dir="auto" className="aify-message-text whitespace-pre-wrap [overflow-wrap:anywhere]">{turn.input}</div>}
                {turn.context && <details className="mt-1 text-xs text-blue-800 [overflow-wrap:anywhere]"><summary>Selected text</summary><div dir="auto" className="aify-message-text">{turn.context}</div></details>}
                {!!turn.attachments?.length && <div className="mt-1"><AttachmentPopover items={turn.attachments} /></div>}
              </div>
            </div>
            {turn.activity.length > 0 && (
              <ul className="space-y-1 text-xs text-gray-600" aria-label="Tool activity">
                {turn.activity.map((item) => (
                  <li key={item.id} className="flex items-center gap-1">
                    {item.tool ? <AgentToolIcon tool={item.tool} /> : item.label === "Read current page" && <AgentToolIcon tool="read_page" />}
                    <span role="status">{item.label} · {item.status === "running" ? (isLoading && index === turns.length - 1 ? "Running…" : "Interrupted") : item.status === "done" ? "Completed" : "Failed"}</span>
                    {item.status === "error" && (
                      <ErrorPopover label={item.label} details={toolErrorDetails(turn, item)} />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {(turn.text || turn.status !== "done") && (
              <div className="group relative mr-auto max-w-[85%] rounded-lg bg-gray-100 p-3 pr-8">
                <div className="mb-1 text-xs text-gray-600">{turn.agentName}</div>
                {turn.text && <ResponseMarkdown text={turn.text} />}
                {turn.status === "running" && <div className="text-xs text-gray-500" role="status">{isLoading && index === turns.length - 1 ? (turn.text ? "Responding…" : "Working…") : "Interrupted"}</div>}
                {turn.status === "stopped" && <div className="text-xs text-gray-500">Stopped</div>}
                {turn.status === "error" && (
                  <div className="flex items-center gap-1 text-sm text-red-800">
                    <span role="alert">Reply failed</span>
                    <ErrorPopover label="Reply failed" details={turn.error ?? "No error details were saved for this reply."} />
                  </div>
                )}
                {!isLoading && <ActionIcon variant="subtle" color="gray" size="xs" aria-label="Regenerate reply"
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => { if (!picker.current) void run(turn.input, turn.context, index, turn.attachments); }}><IconReload size={13} /></ActionIcon>}
              </div>
            )}
          </div>
        ))}
        {saveError && (
          <div className="flex items-center gap-1 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <span role="alert">Chat could not be saved.</span>
            <ErrorPopover label="Chat save failed" details={saveError} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex shrink-0 flex-col gap-2 bg-aify-surface p-2 border border-neutral-200 border-solid rounded-xl">
        {attachmentError && <div className="flex items-center gap-1 text-xs text-red-800"><span role="alert">Could not attach page element.</span><ErrorPopover label="Page attachment failed" details={attachmentError} /></div>}
        {picking && <p className="text-xs text-gray-600" role="status">Select an element on the page, then click Add.</p>}
        <Combobox
          store={combobox}
          onOptionSubmit={handleCommandSelect}
          withinPortal={false}
        >
          <Combobox.Target>
            <textarea
              autoFocus
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              aria-label="Chat message"
              dir="auto"
              placeholder="Type a message or use / to select an action"
              className="aify-message-text border-none outline-0 size-full resize-none"
              rows={2}
            />
          </Combobox.Target>

          <Combobox.Dropdown hidden={!isCommandMode}>
            <Combobox.Options>
              {getCommandOptions().map((option) => (
                <Combobox.Option value={option} key={option}>
                  {option}
                </Combobox.Option>
              ))}
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>

        <div className="flex flex-wrap justify-between gap-2">
          <Select
            className="w-36 min-w-0 max-w-full"
            aria-label="Agent profile"
            comboboxProps={{ withinPortal: false, position: "top-start" }}
            value={selectedAgent.id}
            onChange={(value) => value && setSelectedAgentId(value)}
            allowDeselect={false}
            disabled={isLoading}
            data={agents.map(({ id, name }) => ({ value: id, label: name }))}
            leftSection={<AgentAvatar seed={selectedAgent.seed} size={18} />}
            leftSectionPointerEvents="none"
            renderOption={({ option }) => (
              <div className="flex min-w-0 items-center gap-2">
                <AgentAvatar seed={agents.find(({ id }) => id === option.value)?.seed ?? defaultAgent.seed} />
                <span className="truncate">{option.label}</span>
              </div>
            )}
            size="xs"
          />
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <AttachmentPopover items={attachments}
              includeImages={includeImages} onIncludeImagesChange={setIncludeImages}
              onRemove={(id) => setAttachments((items) => items.filter((item) => item.id !== id))}
              onRemoveChunk={(id, index) => setAttachments((items) => items.flatMap((item) => {
                if (item.id !== id) return [item];
                const updated = removeAttachmentChunk(item, index);
                return updated ? [updated] : [];
              }))} />
            <ActionIcon size="sm" variant="subtle" color="gray"
              aria-label={picking ? "Cancel page selection" : "Attach page element"}
              title={picking ? "Cancel page selection" : attachments.length >= MAX_ATTACHMENTS ? "Attachment limit reached" : "Attach page element"}
              disabled={isLoading || (!picking && attachments.length >= MAX_ATTACHMENTS)}
              onClick={() => picking ? picker.current?.abort() : void attachPageElement()}><IconPaperclip size={16} /></ActionIcon>
            <Button
              variant="subtle"
              color="gray"
              onClick={() => { newChat(); setEdit(null); setInput(""); setAttachments([]); setIncludeImages(true); setAttachmentError(undefined); onContextChange?.(null); }}
              size="xs"
              disabled={picking || isLoading || turns.length === 0}
              title="New chat"
              aria-label="New chat"
            >
              <IconPlus size={14} />
            </Button>
            {isLoading ? <Button onClick={stop} size="xs" title="Stop response" aria-label="Stop response"><IconPlayerStop size={14} /></Button> : (
            <Button
              onClick={handleSubmit}
              disabled={picking || isLoading || !input.trim()}
              size="xs"
              title="Send message"
              aria-label="Send message"
            >
              <IconSend size={14} />
            </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
