import type { BlockCount } from "./block-stats";

export interface ElementBlockRule {
  id: string;
  host: string;
  selector: string;
  markers?: BlockMarker[];
  keywords?: string[];
  label: string;
  mode: "preview" | "hide" | "off";
}

export interface BlockMarker {
  selector: string;
  text?: string;
  path?: string;
}

export interface BlockInspection {
  ruleId: string;
  markerIndex?: number;
  keywordIndex?: number;
}

const protectedAreas = "html, body, head, text-transformer-ui, text-transformer-ui *";

export function canBlockElement(element: Element) {
  return !element.matches(protectedAreas) && !element.querySelector("text-transformer-ui");
}

const stableToken = (value: string) => /^[\w-]{1,64}$/.test(value) && !/\d{4,}|^[a-f\d]{8,}$/i.test(value);

function elementSignature(element: Element) {
  const tag = CSS.escape(element.localName);
  for (const attr of ["data-testid", "data-component", "data-item-type", "itemprop"]) {
    const value = element.getAttribute(attr);
    if (value && stableToken(value)) return { selector: `${tag}[${attr}="${CSS.escape(value)}"]`, named: true };
  }
  if (stableToken(element.id)) return { selector: `${tag}#${CSS.escape(element.id)}`, named: true };
  const classes = [...element.classList].filter(stableToken).slice(0, 2);
  const role = element.getAttribute("role");
  const semantic = role && stableToken(role) ? `[role="${CSS.escape(role)}"]` : "";
  return { selector: tag + semantic + classes.map((name) => `.${CSS.escape(name)}`).join(""), named: false };
}

const normalizeText = (text: string) => text.normalize("NFC").replace(/[\u061c\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const markerText = (element: Element) => normalizeText(element.textContent ?? "");

export function parseBlockKeywords(input: string) {
  return [...new Set(input.split(/\r?\n/).map(normalizeText).filter(Boolean))];
}

function keywordPattern(keyword: string) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}\\p{M}_])${escaped}(?![\\p{L}\\p{N}\\p{M}_])`, "u");
}

function areaText(parent: Element) {
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => node instanceof Element
      ? node.matches("script, style, template, noscript, [hidden], text-transformer-ui") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP
      : NodeFilter.FILTER_ACCEPT,
  });
  const parts: string[] = [];
  while (walker.nextNode()) parts.push(walker.currentNode.nodeValue ?? "");
  return normalizeText(parts.join(" "));
}

function relativeElementPath(element: Element, parent: Element) {
  const parts: string[] = [];
  for (let node: Element | null = element; node && node !== parent; node = node.parentElement) {
    const siblings = Array.from(node.parentElement?.children ?? []).filter((child) => child.localName === node?.localName);
    parts.unshift(`${CSS.escape(node.localName)}:nth-of-type(${siblings.indexOf(node) + 1})`);
  }
  return `:scope > ${parts.join(" > ")}`;
}

export function describeBlockMarker(element: Element, parent: Element): BlockMarker {
  const path = relativeElementPath(element, parent);
  const signature = elementSignature(element);
  // A short badge is identified by its text, not by generated CSS classes.
  const text = markerText(element);
  if (text && text.length <= 64) return { selector: "*", text, path };
  // Accessible labels and titles can distinguish controls that share a layout.
  for (const attr of ["aria-label", "title", "alt"]) {
    const value = element.getAttribute(attr);
    if (value?.trim() && value.length <= 96) {
      return { selector: `${signature.selector}[${attr}="${CSS.escape(value)}"]`, path };
    }
  }
  return { selector: signature.selector, path };
}

export function blockSelector(element: Element, hasMarkers = false) {
  const target = elementSignature(element);
  if (target.named) return target.selector;

  // Scope generic tags/classes to their section. A stable child can identify
  // a generic wrapper even when items are inserted or recycled.
  const parts: string[] = [];
  for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
    const { selector, named } = elementSignature(node);
    let qualifier = "";
    if (!(hasMarkers && node === element) && selector === CSS.escape(node.localName) && !node.matches("article, li, tr")) {
      const marker = node === element && Array.from(node.children).slice(0, 12)
        .map(elementSignature).find((child) => child.named);
      if (marker) qualifier = `:has(> ${marker.selector})`;
      else {
        const siblings = Array.from(node.parentElement?.children ?? []).filter((child) => child.localName === node?.localName);
        if (siblings.length > 1) qualifier = `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
    }
    parts.unshift(selector + qualifier);
    if (named) return parts.join(" > ");
  }
  return `body > ${parts.join(" > ")}`;
}

const parentSelector = (rule: ElementBlockRule) => `:is(${rule.selector}):not(${protectedAreas}, :has(text-transformer-ui))`;

function matchingMarkers(parent: Element, marker: BlockMarker) {
  const expected = marker.text ? normalizeText(marker.text) : "";
  const matches = (element: Element) => !element.closest("script, style, template, noscript, [hidden]") &&
    (!expected || markerText(element) === expected);
  if (expected && marker.path) {
    const exact = parent.querySelector(marker.path);
    if (exact && matches(exact)) return [exact];
  }
  return Array.from(parent.querySelectorAll(expected ? "*" : marker.selector)).filter(matches);
}

function inspectBlockRule(rule: ElementBlockRule, target: BlockInspection) {
  if (rule.host !== location.hostname) return [];
  const parents = Array.from(document.querySelectorAll(parentSelector(rule)));
  if (target.markerIndex !== undefined) {
    const marker = rule.markers?.[target.markerIndex];
    return marker ? parents.flatMap((parent) => matchingMarkers(parent, marker)) : [];
  }
  if (target.keywordIndex !== undefined) {
    const keyword = rule.keywords?.[target.keywordIndex];
    if (!keyword) return [];
    const pattern = keywordPattern(normalizeText(keyword));
    return parents.flatMap((parent) => {
      if (!pattern.test(areaText(parent))) return [];
      const elements = Array.from(parent.querySelectorAll("*")).filter((element) =>
        !element.closest("script, style, template, noscript, [hidden]") && pattern.test(areaText(element)));
      return elements.length ? elements.filter((element) => !elements.some((child) => child !== element && element.contains(child))) : [parent];
    });
  }
  return parents;
}

export function highlightBlockInspection(rule: ElementBlockRule, target: BlockInspection) {
  let nodes: Element[];
  try { nodes = [...new Set(inspectBlockRule(rule, target))]; } catch { return; }
  if (!nodes.length) return;
  const attribute = "data-aify-block-inspect";
  const color = target.markerIndex !== undefined ? "#0891b2" : target.keywordIndex !== undefined ? "#16a34a" : "#d97706";
  const sheet = new CSSStyleSheet();
  sheet.insertRule(`:root [${attribute}][${attribute}][${attribute}] { outline: 3px solid ${color} !important; outline-offset: 0 !important; }`);
  for (const node of nodes) node.setAttribute(attribute, "");
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  return () => {
    for (const node of nodes) node.removeAttribute(attribute);
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== sheet);
  };
}

export function applyElementBlockRules(rules: ElementBlockRule[], stats: {
  seen: Map<string, WeakSet<Element>>;
  record: (counts: BlockCount[]) => void;
}) {
  const active = rules.filter((rule) => rule.host === location.hostname && rule.mode !== "off");
  if (!active.length) return;

  // CSS hides selector-only matches immediately. The observer handles text
  // matches and counts new matches in Hide mode without changing the layout itself.
  const sheet = new CSSStyleSheet();
  const tracked: { selector: string; markers: BlockMarker[]; keywords: RegExp[]; token?: string; counter?: { ruleId: string; seen: WeakSet<Element> } }[] = [];
  const attribute = "data-aify-block-match";
  for (const rule of active) {
    if ([rule.selector, ...(rule.markers ?? []).map(({ selector }) => selector)].some((part) => !part || /[{}\n\r]/.test(part))) continue;
    const parent = parentSelector(rule);
    const selector = `${parent}${(rule.markers ?? []).filter(({ text }) => !text).map(({ selector }) => `:has(${selector})`).join("")}`;
    const markers = rule.markers?.filter(({ text }) => text) ?? [];
    const keywords = (rule.keywords ?? []).map(normalizeText).filter(Boolean).map(keywordPattern);
    const needsText = !!(markers.length || keywords.length);
    const token = needsText ? `r${tracked.length}` : undefined;
    const declarations = rule.mode === "hide" ? "display: none !important" :
      "outline: 3px solid #d946ef !important; outline-offset: -3px !important";
    try {
      document.querySelector(selector);
      for (const marker of markers) if (marker.path) document.querySelector(marker.path);
      if (rule.mode === "preview" && (rule.markers?.length || keywords.length)) {
        sheet.insertRule(`:where(${parent}) { outline: 2px dashed #d97706 !important; outline-offset: -2px !important; }`, 0);
      }
      sheet.insertRule(`${selector}${token ? `[${attribute}~="${token}"]` : ""} { ${declarations}; }`, sheet.cssRules.length);
      if (rule.mode === "hide") {
        const seen = stats.seen.get(rule.id) ?? new WeakSet<Element>();
        stats.seen.set(rule.id, seen);
        tracked.push({ selector, markers, keywords, token, counter: { ruleId: rule.id, seen } });
      } else if (token) tracked.push({ selector, markers, keywords, token });
    } catch {
      // A stale or unsupported selector must not disable the other rules.
    }
  }
  if (!sheet.cssRules.length) return;
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  let marked = new Map<Element, string>();
  let frame: number | undefined;
  const refresh = () => {
    frame = undefined;
    const next = new Map<Element, string>();
    const counts: BlockCount[] = [];
    for (const { selector, markers, keywords, token, counter } of tracked) {
      let count = 0;
      for (const parent of document.querySelectorAll(selector)) {
        if (keywords.length) {
          const text = areaText(parent);
          if (!keywords.every((pattern) => pattern.test(text))) continue;
        }
        if (!markers.every((marker) => matchingMarkers(parent, marker).length)) continue;
        if (token) {
          const previous = next.get(parent);
          next.set(parent, previous ? `${previous} ${token}` : token);
        }
        if (counter && !counter.seen.has(parent)) {
          counter.seen.add(parent);
          count++;
        }
      }
      if (counter && count) counts.push({ ruleId: counter.ruleId, count });
    }
    for (const node of marked.keys()) if (!next.has(node)) node.removeAttribute(attribute);
    for (const [node, value] of next) if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
    marked = next;
    if (counts.length) stats.record(counts);
  };
  const observer = tracked.length ? new MutationObserver((records) => {
    if (frame === undefined && records.some((record) => record.attributeName !== attribute)) frame = requestAnimationFrame(refresh);
  }) : undefined;
  if (observer) {
    refresh();
    observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  }
  return () => {
    observer?.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
    for (const node of marked.keys()) node.removeAttribute(attribute);
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== sheet);
  };
}
