import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import type { AgentProfile } from "../utils/agents";
import { streamAgentReply } from "../utils/agent-stream";
import { errorDetails } from "../utils/error-details";
import type { PageAttachment } from "../utils/page-attachment";
import { chatKey, conversationMessages, newChatId, type ChatTurn, type SavedChat } from "../utils/chat-history";

export function useChat(agent: AgentProfile, sidebar: boolean, initialChat?: SavedChat) {
  const [chat, setChat] = useState<SavedChat | undefined>(initialChat);
  const [isLoading, setIsLoading] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const controller = useRef<AbortController | null>(null);
  const lastResume = useRef(initialChat);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (isLoading || !initialChat || initialChat === lastResume.current) return;
    lastResume.current = initialChat;
    setChat(initialChat);
    setSaveError(undefined);
  }, [initialChat, isLoading]);

  async function run(input: string, context?: string, replaceIndex?: number, attachments?: PageAttachment[], freshAgent?: AgentProfile) {
    if (controller.current || !input.trim()) return;
    const abort = new AbortController();
    controller.current = abort;
    setIsLoading(true);
    setSaveError(undefined);
    const base = freshAgent ? undefined : chat;
    const replyAgent = freshAgent ?? agent;
    const turns = base?.turns.slice(0, replaceIndex ?? base.turns.length) ?? [];
    let turn: ChatTurn = {
      id: newChatId(), input, context, attachments, text: "", agentId: replyAgent.id, agentName: replyAgent.name,
      response: [], activity: [], status: "running",
    };
    // Edits and regenerations fork the transcript rather than deleting later turns.
    const id = replaceIndex !== undefined ? newChatId() : base?.id ?? newChatId();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = Promise.resolve();
    const snapshot = (): SavedChat => ({ version: 1, id, updatedAt: Date.now(), turns: [...turns, turn] });
    const persist = () => {
      clearTimeout(timer);
      timer = undefined;
      const data = snapshot();
      pending = pending.then(async () => {
        await browser.storage.local.set({ [chatKey(id)]: data });
        setSaveError(undefined);
      }).catch((error) => setSaveError(errorDetails(error, "Browser storage rejected the chat.")));
    };
    const update = (change: Partial<ChatTurn>, immediate = false) => {
      turn = { ...turn, ...change };
      setChat(snapshot());
      if (immediate) persist();
      else timer ??= setTimeout(persist, 500);
    };
    update({}, true);
    try {
      await streamAgentReply({
        agent: replyAgent, sidebar, signal: abort.signal, messages: conversationMessages([...turns, turn]),
        onText: (delta) => update({ text: turn.text + delta }),
        onModel: (model) => update({ model }),
        onResponse: (response) => update({ response }, true),
        onActivity: (activity) => {
          const previous = turn.activity.findIndex(({ id }) => id === activity.id);
          update({ activity: previous < 0 ? [...turn.activity, activity] : turn.activity.map((item, i) => i === previous ? activity : item) }, true);
        },
      });
      update({ status: "done" }, true);
    } catch (error) {
      const details = errorDetails(error, "Could not complete this reply.");
      update({
        status: abort.signal.aborted ? "stopped" : "error",
        error: abort.signal.aborted ? undefined : details,
        activity: turn.activity.map((activity) => activity.status === "running"
          ? { ...activity, status: "error", error: abort.signal.aborted ? "The reply was stopped before the tool finished." : details }
          : activity),
      }, true);
    } finally {
      await pending;
      controller.current = null;
      setIsLoading(false);
    }
  }

  return {
    chat, turns: chat?.turns ?? [], isLoading, saveError, run,
    stop: () => controller.current?.abort(),
    newChat: () => { if (!controller.current) { setChat(undefined); setSaveError(undefined); } },
  };
}
