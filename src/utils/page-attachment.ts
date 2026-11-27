export interface PageAttachmentImage {
  url: string;
  alt: string;
  dataUrl?: string;
}

export interface PageAttachment {
  id: string;
  label: string;
  text: string;
  images?: PageAttachmentImage[];
  imagePositions?: { offset: number; urls: string[] }[];
  truncated: boolean;
  selector?: string;
  blockMarkers?: BlockMarker[];
  pageHost?: string;
}

export interface ElementAction {
  id: string;
  selector: string;
  host: string;
  title: string;
  instruction: string;
  agentId: string;
}
export interface ElementActionRequest {
  action: ElementAction;
  attachment: PageAttachment;
}

export const PENDING_ELEMENT_ACTION = "aify:pending-element-action:";

interface AttachmentChunk {
  text: string;
  images: PageAttachmentImage[];
}

export function attachmentChunks(item: PageAttachment): AttachmentChunk[] {
  const images = new Map(item.images?.map((image) => [image.url, image]));
  const positions = new Map<number, PageAttachmentImage[]>();
  for (const { offset, urls } of item.imagePositions ?? []) {
    const end = Math.max(0, Math.min(item.text.length, offset));
    const atOffset = positions.get(end) ?? [];
    for (const url of urls) {
      const image = images.get(url);
      if (!image) continue;
      atOffset.push(image);
      images.delete(url);
    }
    positions.set(end, atOffset);
  }
  if (images.size) positions.set(item.text.length, [...(positions.get(item.text.length) ?? []), ...images.values()]);

  const ends = new Set([...positions.keys(), item.text.length]);
  for (const match of item.text.matchAll(/\n\n/g)) ends.add(match.index);
  const chunks: AttachmentChunk[] = [];
  let start = 0;
  for (const end of [...ends].sort((a, b) => a - b)) {
    const text = item.text.slice(start, end).trim();
    const images = positions.get(end) ?? [];
    if (text || images.length) chunks.push({ text, images });
    start = end;
  }
  return chunks;
}

export function removeAttachmentChunk(item: PageAttachment, index: number): PageAttachment | undefined {
  const chunks = attachmentChunks(item).filter((_, i) => i !== index);
  if (!chunks.length) return;
  let text = "";
  const images: PageAttachmentImage[] = [];
  const imagePositions: NonNullable<PageAttachment["imagePositions"]> = [];
  for (const chunk of chunks) {
    if (chunk.text) text += (text ? "\n\n" : "") + chunk.text;
    if (chunk.images.length) {
      images.push(...chunk.images);
      imagePositions.push({ offset: text.length, urls: chunk.images.map(({ url }) => url) });
    }
  }
  return { ...item, text, images, imagePositions };
}

export const MAX_ATTACHMENTS = 4;
export const PAGE_PICKER_PORT = "aify:pick-page-attachment";
export const BLOCK_PICKER_PORT = "aify:pick-block-area";
export const BLOCK_MARKER_PICKER_PORT = "aify:pick-block-markers";

export type PagePickerResult = { attachment: PageAttachment | null } | { error: string };
export type PagePickerMessage = PagePickerResult | { ready: true };
export type PagePickerMode = "attachment" | "block" | { markerParent: { host: string; selector: string } };
export type PickPageAttachment = (signal: AbortSignal, mode?: PagePickerMode) => Promise<PageAttachment | null>;
import type { BlockMarker } from "./element-blocking";
