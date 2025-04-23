// ./messaging.ts
import { defineExtensionMessaging } from "@webext-core/messaging";

export interface TransformTextMessage {
  text: string;
  originalSelectedText: string;
  summaryLengthName: string;
}

interface ProtocolMap {
  transformText(data: TransformTextMessage): Promise<string>;
  toggleCoreModal(data: { visible: boolean; context?: string }): Promise<void>;
  openCoreModalWithContext(data: { text: string }): Promise<void>;
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>();
