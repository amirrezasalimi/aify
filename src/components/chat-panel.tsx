import { useState, useRef, useEffect } from "react";
import { useChat, Message, ChatTune, ResponseLength } from "../hooks/use-chat";
import {
  IconSend,
  IconEraser,
  IconReload,
  IconTrash,
} from "@tabler/icons-react";
import { Button, Select, Combobox, useCombobox } from "@mantine/core";
import useLocalStorage from "../hooks/use-localstorage";
import { SETTINGS, defaultTextActions } from "../constants";

interface ChatPanelProps {
  context?: string;
  onContextChange?: (context: string | null) => void;
}

const ChatPanel = ({ context, onContextChange }: ChatPanelProps) => {
  const combobox = useCombobox();
  const [textActions] = useLocalStorage(
    SETTINGS.TEXT_ACTIONS,
    defaultTextActions
  );
  const [selectedLanguages] = useLocalStorage(SETTINGS.TRANSLATION_LANGUAGES, [
    "English",
  ]);

  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    reloadMessage,
    config,
    setConfig,
  } = useChat();

  const [input, setInput] = useState("");
  const [isCommandMode, setIsCommandMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      const container = messagesEndRef.current?.parentElement;
      if (!container) return;

      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    if (messages.length > 0 || isLoading) {
      scrollToBottom();
    }
  }, [messages, isLoading]);

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
    if (!input.trim() || isLoading) return;
    await sendMessage(input, context);
    setInput("");
  };

  const handleReload = async (index: number) => {
    if (isLoading) return;
    await reloadMessage(index, context);
  };

  return (
    <div className="flex flex-col h-full">
      {context && (
        <div className="flex justify-between items-center gap-2 bg-blue-50 p-2 border-b border-blue-100">
          <div className="text-blue-700 text-sm line-clamp-2">
            Context: {context}
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
      <div className="flex-1 space-y-4 p-4 overflow-auto">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2 mt-8 text-gray-500 text-center">
            <h2 className="font-semibold text-lg">Welcome to Aify!</h2>
            <p className="text-sm">
              Select text on any webpage and click "Aify" to choose chat or
              other actions.
            </p>
          </div>
        )}
        {messages.map((message: Message, index: number) => (
          <div
            key={index}
            className={`p-3 rounded-lg flex items-end gap-2 relative group ${
              message.role === "user"
                ? "bg-blue-100 ml-auto max-w-[80%]"
                : "bg-gray-100 mr-auto max-w-[80%]"
            }`}
          >
            <div className="flex-1 pr-6">{message.content}</div>
            {message.role === "assistant" && (
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                className="top-2 right-2 absolute opacity-0 group-hover:opacity-100"
                onClick={() => handleReload(index)}
                disabled={isLoading || message.isReloading}
              >
                <IconReload
                  size={14}
                  className={message.isReloading ? "animate-spin" : ""}
                />
              </Button>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="bg-gray-100 mr-auto p-3 rounded-lg">Thinking...</div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex flex-col gap-2 bg-white p-2 border border-neutral-200 border-solid rounded-xl">
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
              placeholder="Type a message or use / to select an action"
              className="border-none outline-0 size-full resize-none"
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

        <div className="flex justify-between gap-2">
          <div className="flex gap-2">
            <Select
              className="!w-[120px]"
              comboboxProps={{
                withinPortal: false,
              }}
              value={config.tune}
              onChange={(value) =>
                setConfig({ ...config, tune: value as ChatTune })
              }
              data={[
                { value: "Professional", label: "Professional" },
                { value: "Creative", label: "Creative" },
                { value: "Friendly", label: "Friendly" },
                { value: "Direct", label: "Direct" },
                { value: "Technical", label: "Technical" },
              ]}
              size="xs"
              styles={{ input: { minHeight: "30px" } }}
            />
            <Select
              className="!w-[120px]"
              comboboxProps={{
                withinPortal: false,
              }}
              value={config.responseLength}
              onChange={(value) =>
                setConfig({
                  ...config,
                  responseLength: value as ResponseLength,
                })
              }
              data={[
                { value: "short", label: "Short" },
                { value: "normal", label: "Normal" },
                { value: "long", label: "Long" },
              ]}
              size="xs"
              styles={{ input: { minHeight: "30px" } }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="subtle"
              color="gray"
              onClick={clearMessages}
              size="xs"
              disabled={isLoading || messages.length === 0}
              title="Clear messages"
            >
              <IconEraser size={14} />
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !input.trim()}
              size="xs"
              title="Send message"
            >
              <IconSend size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
