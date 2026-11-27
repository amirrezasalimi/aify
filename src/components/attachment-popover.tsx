import { ActionIcon, Button, Popover, Switch } from "@mantine/core";
import { IconPaperclip, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { attachmentChunks, type PageAttachment, type PageAttachmentImage } from "../utils/page-attachment";

function ImagePreview({ image }: { image: PageAttachmentImage }) {
  const [failedSource, setFailedSource] = useState<string>();
  const [unavailable, setUnavailable] = useState(false);
  if (!/^https?:\/\//i.test(image.url)) return null;
  const pixels = image.dataUrl?.startsWith("data:image/jpeg;base64,") ? image.dataUrl : undefined;
  const source = pixels && failedSource !== pixels ? pixels : image.url;
  return (
    <a href={image.url} target="_blank" rel="noopener noreferrer" title={image.url} className="block overflow-hidden rounded border border-gray-200 bg-aify-surface text-blue-700">
      {!unavailable && <img src={source} referrerPolicy="no-referrer" loading="lazy"
        alt={image.alt || "Captured page image"} className="block max-h-44 w-full object-contain"
        onError={() => source === pixels ? setFailedSource(source) : setUnavailable(true)} />}
      <span className="block px-2 py-1 underline [overflow-wrap:anywhere]">
        <bdi>{unavailable ? "Preview unavailable · Open image" : image.alt || "Open image"}</bdi>
      </span>
    </a>
  );
}

function AttachmentContent({ item, includeImages, onRemoveChunk }: { item: PageAttachment; includeImages: boolean; onRemoveChunk?: (index: number) => void }) {
  return <div className="space-y-2">
    {attachmentChunks(item).map(({ text, images }, index) => (
      <div key={JSON.stringify([text, images.map(({ url }) => url)])} className="flex items-start gap-1 border-t border-gray-200 pt-2">
        <div className="min-w-0 flex-1 space-y-2">
          {text && <div dir="auto" className="aify-message-text whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</div>}
          {includeImages ? images.map((image) => <ImagePreview key={image.url} image={image} />)
            : images.length > 0 && <p className="text-gray-600">{images.length === 1 ? "1 image excluded" : `${images.length} images excluded`}</p>}
        </div>
        {onRemoveChunk && <ActionIcon size="xs" variant="subtle" color="red" aria-label={`Remove captured chunk ${index + 1}`} title="Remove chunk and its images" onClick={() => onRemoveChunk(index)}><IconTrash size={13} /></ActionIcon>}
      </div>
    ))}
  </div>;
}

export function AttachmentPopover({ items, includeImages = true, onIncludeImagesChange, onRemove, onRemoveChunk }: {
  items: PageAttachment[];
  includeImages?: boolean;
  onIncludeImagesChange?: (includeImages: boolean) => void;
  onRemove?: (id: string) => void;
  onRemoveChunk?: (id: string, index: number) => void;
}) {
  if (!items.length) return null;
  return (
    <Popover withinPortal={false} floatingStrategy="fixed" position="top-start" withArrow shadow="md">
      <Popover.Target>
        <Button size="compact-xs" variant="light" leftSection={<IconPaperclip size={13} />} aria-label={`View ${items.length} page attachments`}>
          {items.length}
        </Button>
      </Popover.Target>
      <Popover.Dropdown w="min(300px, calc(100vw - 24px))" p="xs">
        {onIncludeImagesChange && <Switch size="xs" label="Include images" checked={includeImages}
          onChange={(event) => onIncludeImagesChange(event.currentTarget.checked)} className="mb-2" />}
        <div className="max-h-60 space-y-2 overflow-y-auto" tabIndex={0} aria-label="Page attachment previews">
          {items.map((item) => (
            <section key={item.id} className="rounded bg-gray-50 p-2 text-xs">
              <div className="mb-1 flex items-center justify-between gap-2">
                <bdi className="font-semibold">{item.label}</bdi>
                {onRemove && <ActionIcon size="xs" variant="subtle" color="red" aria-label={`Remove ${item.label} attachment`} title="Remove attachment" onClick={() => onRemove(item.id)}><IconTrash size={13} /></ActionIcon>}
              </div>
              <AttachmentContent item={item} includeImages={includeImages} onRemoveChunk={onRemoveChunk && ((index) => onRemoveChunk(item.id, index))} />
              {item.truncated && <p className="mt-1 text-gray-600">Capture limit reached; some text was omitted.</p>}
            </section>
          ))}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
