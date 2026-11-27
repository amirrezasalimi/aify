import type { PageAttachmentImage } from "./page-attachment";
import { imageData } from "./read-page";

const MAX_CAPTURE_CHARS = 18_000;
const MAX_NODES = 5_000;
const MAX_IMAGES = 8;
const MAX_VIDEO_POSTERS = 2;
const MAX_IMAGE_BYTES = 320_000;
const EXCLUDED = "script, style, noscript, template, iframe, svg, input, textarea, select, [contenteditable]:not([contenteditable='false']), [hidden], [inert], [aria-hidden='true'], text-transformer-ui";
const VOLATILE = "time, [role='timer'], [role='status'], button, [role='button'], [role='progressbar'], [role='slider']";
export const CAPTURE_ITEM = "article, li, tr, [role='article'], [role='listitem'], [role='row'], [role='option']";
const TEXT_BLOCK = "p, h1, h2, h3, h4, h5, h6, pre, blockquote, div, section, dd, dt, br, td, th";

const normalizeText = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim();

const PLAYBACK_TIME = /(?<!\S)\d{1,2}:\d{2}(?::\d{2})?(?:\s*\/\s*\d{1,2}:\d{2}(?::\d{2})?)?(?!\S)/g;

export function canPickElement(element: Element) {
  return !element.closest(EXCLUDED) && element.getClientRects().length > 0;
}

export function createElementCapture() {
  // Key by normalized content, never by DOM node or virtual row index: both can be recycled.
  type Block = { text: string; offset: number; urls: Set<string> };
  const items = new Map<string, Block>();
  const positioned = new Set<string>();
  const images = new Map<string, PageAttachmentImage>();
  const attemptedPixels = new WeakMap<HTMLImageElement, string>();
  let imageBudget = MAX_IMAGE_BYTES;
  let videoPosters = 0;
  let size = 0;
  let truncated = false;

  function captureImage(media: Element, source: string, kind: "image" | "background" | "poster", image?: HTMLImageElement) {
    const { width, height } = media.getBoundingClientRect();
    if (width < 96 || height < 72 || width * height < 9_000) return;
    const loaded = image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    if (image && loaded && (image.naturalWidth < 96 || image.naturalHeight < 64)) return;
    let url: URL;
    try {
      if (!source) return;
      url = new URL(source, document.baseURI);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || /\.svgz?$/i.test(decodeURIComponent(url.pathname))) return;
    } catch { return; }
    url.hash = "";
    const src = url.href;
    const previous = images.get(src);
    if (previous) {
      if (!previous.dataUrl && image && loaded && imageBudget >= 8_000 && attemptedPixels.get(image) !== src) {
        attemptedPixels.set(image, src);
        previous.dataUrl = imageData(image, Math.min(120_000, imageBudget));
        imageBudget -= previous.dataUrl?.length ?? 0;
      }
      return previous.url;
    }
    if (images.size >= MAX_IMAGES || src.length > 2_048 || (kind === "poster" && videoPosters >= MAX_VIDEO_POSTERS)) {
      truncated = true;
      return;
    }
    // Never fetch a URL from page markup. Only copy pixels already readable in this document.
    const dataUrl = image && loaded && imageBudget >= 8_000 ? imageData(image, Math.min(120_000, imageBudget)) : undefined;
    if (image && loaded) attemptedPixels.set(image, src);
    imageBudget -= dataUrl?.length ?? 0;
    if (kind === "poster") videoPosters++;
    images.set(src, { url: src, alt: normalizeText(image?.alt || media.getAttribute("aria-label") || (kind === "poster" ? "Video poster" : "")).slice(0, 200), dataUrl });
    return src;
  }

  function sample(root: Element) {
    if (!root.isConnected) return;
    let chunk = "";
    let nodes = 0;
    let hasVideo = false;
    let pendingImages = new Set<string>();
    const keepControls = !!root.closest(VOLATILE);

    function append(text: string) {
      const room = MAX_CAPTURE_CHARS - chunk.length;
      if (text.length > room) truncated = true;
      chunk += text.slice(0, room);
    }

    function flush() {
      const text = normalizeText(chunk);
      chunk = "";
      const urls = pendingImages;
      pendingImages = new Set();
      let comparable = normalizeText(text.replace(/[\u00ad\u061c\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ""));
      // Some players render their changing countdown as ordinary text, outside the controls.
      if (hasVideo && !keepControls) comparable = normalizeText(comparable.replace(PLAYBACK_TIME, " "));
      hasVideo = false;
      const key = comparable ? `text:${comparable}` : urls.size ? `media:${JSON.stringify([...urls].sort())}` : "";
      if (!key || (!text && !urls.size)) return;
      let block = items.get(key);
      if (!block) {
        const separator = text && size ? 2 : 0;
        const remaining = Math.max(0, MAX_CAPTURE_CHARS - size - separator);
        if (text.length > remaining) truncated = true;
        if (!remaining && !urls.size) return;
        const value = text.slice(0, remaining);
        if (value) size += separator + value.length;
        block = { text: value, offset: size, urls: new Set() };
        items.set(key, block);
      }
      for (const url of urls) {
        if (positioned.has(url)) continue;
        positioned.add(url);
        block.urls.add(url);
      }
    }

    function visit(node: Node, grouped = false, depth = 0, visible = true, suppressText = false) {
      if (++nodes > MAX_NODES || depth > 100) {
        truncated = true;
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        if (visible && !suppressText && node.nodeValue) append(node.nodeValue);
        return;
      }
      if (!(node instanceof Element) || node.matches(EXCLUDED)) return;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.contentVisibility === "hidden" || style.opacity === "0") return;
      if (node instanceof HTMLImageElement || node instanceof HTMLVideoElement) {
        if (style.visibility === "visible") {
          if (node instanceof HTMLVideoElement) hasVideo = true;
          const url = node instanceof HTMLVideoElement
            ? captureImage(node, node.poster, "poster")
            : captureImage(node, node.currentSrc || node.src, "image", node);
          if (url) pendingImages.add(url);
        }
        return;
      }
      // Mutable UI labels are not part of the row content. Explicitly selected controls still work.
      const control = !keepControls && node.matches(VOLATILE);
      const item = !grouped && node.matches(CAPTURE_ITEM);
      const block = node.matches(TEXT_BLOCK);
      if (item || (block && !grouped)) flush();
      else if (block) append(" ");
      // Content images may be painted as a background instead of a visible <img>.
      // Skip tiled backgrounds, page chrome, and full-layout decoration.
      if (style.visibility === "visible" && style.backgroundImage !== "none" &&
          !node.closest("nav, header, footer, [role='navigation']") && !node.matches("html, body, main") &&
          (node.matches("[role='img'], figure") || style.backgroundSize === "cover" ||
            style.backgroundRepeat === "no-repeat" && (style.backgroundSize === "contain" || !node.childElementCount))) {
        const source = /^url\(["']?(.*?)["']?\)$/.exec(style.backgroundImage)?.[1];
        const url = source && captureImage(node, source, "background");
        if (url) pendingImages.add(url);
      }
      const hideChildText = suppressText || control;
      for (const child of node.childNodes) {
        visit(child, grouped || item, depth + 1, style.visibility === "visible", hideChildText);
        if (nodes > MAX_NODES) break;
      }
      if (item || (block && !grouped)) flush();
      else if (block) append(" ");
    }

    if (canPickElement(root)) visit(root);
    flush();
  }

  return {
    sample,
    get count() { return [...items.values()].filter(({ text }) => text).length; },
    get imageCount() { return images.size; },
    result: () => ({
      text: [...items.values()].map(({ text }) => text).filter(Boolean).join("\n\n"),
      images: [...images.values()],
      imagePositions: [...items.values()].filter(({ urls }) => urls.size).map(({ offset, urls }) => ({ offset, urls: [...urls] })),
      truncated,
    }),
  };
}
