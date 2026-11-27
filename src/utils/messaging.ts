// ./messaging.ts
import { defineExtensionMessaging } from "@webext-core/messaging";
import type { PageSnapshot } from "./read-page";
import type { ElementActionRequest } from "./page-attachment";
import type { BlockInspection } from "./element-blocking";
import type { BlockCount } from "./block-stats";

export interface TransformTextMessage {
  action: string;
  text: string;
}

interface ProtocolMap {
  identifyCurrentPage(): string;
  inspectBlockRule(data: { token: string; target?: BlockInspection }): void;
  recordBlockedElements(data: BlockCount[]): Promise<void>;
  readCurrentPage(data: { expectedUrl: string }): PageSnapshot;
  transformText(data: TransformTextMessage): Promise<string>;
  toggleCoreModal(data: { visible: boolean; context?: string }): Promise<void>;
  openCoreModalWithContext(data: { text: string }): Promise<void>;
  runSavedElementAction(data: ElementActionRequest): Promise<void>;
  launchSavedElementAction(data: ElementActionRequest): Promise<void>;
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>();
