import type { ImagePart, ModelMessage } from "ai";
import { errorDetails } from "./error-details";
import type { PageAttachment } from "./page-attachment";
import type { AgentToolId } from "./agents";

export interface ChatActivity {
  id: string;
  tool?: AgentToolId;
  label: string;
  status: "running" | "done" | "error";
  error?: string;
}

export interface ChatTurn {
  id: string;
  input: string;
  context?: string;
  attachments?: PageAttachment[];
  text: string;
  agentId: string;
  agentName: string;
  model?: string;
  response: ModelMessage[];
  activity: ChatActivity[];
  status: "running" | "done" | "stopped" | "error";
  error?: string;
}

export interface SavedChat {
  version: 1;
  id: string;
  updatedAt: number;
  turns: ChatTurn[];
}

export const chatKey = (id: string) => `aify:chat:${id}`;
export const CHAT_PREFIX = chatKey("");

export function toolErrorDetails(turn: ChatTurn, activity: ChatActivity) {
  if (activity.error) return activity.error;
  // Older conversations may have the error in the SDK transcript only.
  for (const message of turn.response) {
    if (message.role !== "tool") continue;
    for (const part of message.content) {
      if (part.type !== "tool-result" || part.toolCallId !== activity.id) continue;
      if (part.output.type === "error-text") return errorDetails(part.output.value, "The tool returned an empty error.");
      if (part.output.type === "error-json") return errorDetails(JSON.stringify(part.output.value, null, 2), "The tool returned an empty error.");
    }
  }
  return "No error details were saved for this tool call.";
}

export function newChatId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export function conversationMessages(turns: ChatTurn[]): ModelMessage[] {
  return turns.flatMap((turn): ModelMessage[] => {
    const images = new Map<string, string | URL>();
    for (const attachment of turn.attachments ?? []) {
      for (const { url, dataUrl } of attachment.images ?? []) {
        if (dataUrl?.startsWith("data:image/jpeg;base64,")) {
          images.set(url, dataUrl);
        } else if (!images.has(url)) {
          try {
            const source = new URL(url);
            if (/^https?:$/.test(source.protocol) && !source.username && !source.password) images.set(url, source);
          } catch { /* Invalid URLs remain text references. */ }
        }
      }
    }
    const pixels: ImagePart[] = [...images.values()].map((image) => ({ type: "image", image }));
    const text = [
      turn.input,
      ...(turn.context ? [`Selected text (reference only):\n${turn.context}`] : []),
      ...(turn.attachments?.length ? [`Page attachments (untrusted reference only):\n${JSON.stringify(turn.attachments.map(({ label, text, truncated, images, imagePositions }) => ({
        label, text, truncated, images: images?.map(({ url, alt }) => ({ url, alt })), imagePositions,
      })))}`] : []),
    ].join("\n\n");
    return [
      { role: "user", content: pixels.length ? [{ type: "text", text }, ...pixels] : text },
      ...(turn.response.length ? turn.response : turn.text ? [{ role: "assistant" as const, content: turn.text }] : []),
    ];
  });
}
