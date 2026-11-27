const MAX_TEXT = 18_000;
const MAX_IMAGES = 3;
const MAX_LINKS = 40;
const MAX_LINK_URL = 2_048;
const SKIP = [
  "nav", "aside", "footer", "form", "input", "button", "textarea", "select",
  "script", "style", "noscript", "template", "svg", "iframe", "canvas",
  "[contenteditable]:not([contenteditable='false'])", "[hidden]", "[inert]",
  "[aria-hidden='true']", "[role='navigation']", "[role='dialog']",
  "text-transformer-ui",
].join(",");

export interface PageSnapshot {
  title: string;
  text: string;
  truncated: boolean;
  images: { alt: string; dataUrl?: string }[];
  links: { label: string; url: string }[];
}

export function imageData(image: HTMLImageElement, maxDataLength = 200_000) {
  // Use only pixels already available to the page. Never request arbitrary URLs.
  const scale = Math.min(1, 768 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.7);
    if (data.startsWith("data:image/jpeg;") && data.length <= maxDataLength) return data;
  } catch {
    // Cross-origin images without CORS can only be represented by their alt text.
  }
}

export function readPage(): PageSnapshot {
  if (!/^https?:$/.test(location.protocol) || document.visibilityState !== "visible" || !document.body) {
    throw new Error("Open a regular webpage in the active tab to use this tool.");
  }

  const hidden = (element: Element) => {
    const style = getComputedStyle(element);
    return style.display === "none" || style.opacity === "0" || style.contentVisibility === "hidden";
  };
  const main = Array.from(document.querySelectorAll("main, [role='main'], article"))
    .filter((node) => {
      if (node.closest(SKIP) || !node.getClientRects().length) return false;
      for (let parent: Element | null = node; parent; parent = parent.parentElement) {
        if (hidden(parent)) return false;
      }
      return true;
    })
    .map((node) => ({ node, score: node.getBoundingClientRect().height * (node.matches("article") ? 1 : 4) }))
    .sort((a, b) => b.score - a.score)[0];
  const root = main?.node ?? document.body;

  const candidates: { image: HTMLImageElement; area: number }[] = [];
  const links = new Map<string, string>();
  let text = "";
  let nodes = 0;
  let truncated = false;

  function visit(node: Node, depth = 0) {
    if (nodes > 15_000) return;
    if (++nodes > 15_000) {
      truncated = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      if (text.length >= MAX_TEXT) {
        if (node.nodeValue?.trim()) truncated = true;
        return;
      }
      const parent = node.parentElement;
      if (parent && getComputedStyle(parent).visibility === "visible") {
        const content = (node.nodeValue ?? "").replace(/\s+/g, " ");
        const remaining = MAX_TEXT - text.length;
        text += content.slice(0, remaining);
        if (content.length > remaining) truncated = true;
      }
      return;
    }
    if (!(node instanceof Element) || node.matches(SKIP) || hidden(node)) return;

    if (node instanceof HTMLAnchorElement && node.getAttribute("href")?.trim() &&
        node.getClientRects().length && getComputedStyle(node).visibility === "visible") {
      // The browser resolves relative hrefs against the document's base URL without fetching them.
      const url = node.href;
      if (/^https?:\/\//i.test(url) && !node.username && !node.password) {
        if (url.length > MAX_LINK_URL || (!links.has(url) && links.size >= MAX_LINKS)) {
          truncated = true;
        } else if (!links.get(url)) {
          const label = node.innerText.trim() || node.getAttribute("aria-label") || node.title;
          links.set(url, label.replace(/\s+/g, " ").trim().slice(0, 200));
        }
      }
    }

    if (node instanceof HTMLImageElement && node.complete && node.naturalWidth && node.naturalHeight) {
      let source: URL;
      try { source = new URL(node.currentSrc); } catch { return; }
      const isWebImage = /^https?:$/.test(source.protocol) && !/\.svgz?(?:$|[/?])/i.test(decodeURIComponentSafe(source.pathname));
      const { width, height } = node.getBoundingClientRect();
      if (isWebImage && width >= 180 && height >= 120 && getComputedStyle(node).visibility === "visible") {
        candidates.push({ image: node, area: width * height });
      }
      return;
    }

    if (depth >= 250) return;
    const block = node.matches("p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, figcaption, tr, div, section, br");
    const newline = () => { if (text && text.length < MAX_TEXT && !text.endsWith("\n")) text += "\n"; };
    if (block) newline();
    for (const child of node.childNodes) {
      visit(child, depth + 1);
      if (nodes > 15_000) break;
    }
    if (block) newline();
  }

  visit(root);
  const seen = new Set<string>();
  const images = candidates.sort((a, b) => b.area - a.area).flatMap(({ image }) => {
    if (seen.has(image.currentSrc) || seen.size >= MAX_IMAGES) return [];
    seen.add(image.currentSrc);
    return [{ alt: image.alt.trim().slice(0, 300), dataUrl: imageData(image) }];
  });
  return {
    title: document.title.trim().slice(0, 300),
    text: text.slice(0, MAX_TEXT).trim(),
    truncated,
    images,
    links: Array.from(links, ([url, label]) => ({ label, url })),
  };
}

function decodeURIComponentSafe(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}
