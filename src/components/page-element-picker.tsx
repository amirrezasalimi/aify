import { useEffect, useRef, useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { CAPTURE_ITEM, canPickElement, createElementCapture } from "../utils/capture-element";
import { newChatId } from "../utils/chat-history";
import type { PagePickerMode, PagePickerResult } from "../utils/page-attachment";
import { blockSelector, canBlockElement, describeBlockMarker, type BlockMarker } from "../utils/element-blocking";

function describe(element: Element) {
  if (element.matches("ul, ol, [role='list'], [role='listbox']")) return "List";
  if (element.matches("article, [role='article']")) return "Article";
  if (element.matches("li, [role='listitem']")) return "List item";
  if (element.matches("table, [role='grid'], [role='table']")) return "Table";
  return element.getAttribute("role")?.slice(0, 40) || element.localName;
}

function bounds(element: Element) {
  const rect = element.getBoundingClientRect();
  let { left, top, right, bottom } = rect;
  for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(parent);
    if (overflowX === "visible" && overflowY === "visible") continue;
    const clip = parent.getBoundingClientRect();
    if (overflowX !== "visible") { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
    if (overflowY !== "visible") { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
  }
  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(innerWidth, right);
  bottom = Math.min(innerHeight, bottom);
  return right > left && bottom > top ? { left, top, right, bottom } : undefined;
}

export function PageElementPicker({ mode, onFinish, onReady }: { mode: PagePickerMode; onFinish: (result: PagePickerResult) => void; onReady: () => void }) {
  const markerParent = typeof mode === "object" ? mode.markerParent.selector : undefined;
  const blocking = mode !== "attachment";
  const [view, setView] = useState<{ label: string; rect: ReturnType<typeof bounds>; locked: boolean; y: number; count: number; imageCount: number; detached: boolean; markers: { id: string; rect: ReturnType<typeof bounds> }[]; markerHover: ReturnType<typeof bounds> }>();
  const add = useRef<() => void>(() => {});
  const undoMarker = useRef<() => void>(() => {});

  useEffect(() => {
    const events = new AbortController();
    const capture = createElementCapture();
    const options = { capture: true, signal: events.signal };
    let suggested: Element | undefined;
    let locked: Element | undefined;
    const markers = new Map<string, { node: Element; marker: BlockMarker }>();
    let markerHover: Element | undefined;
    let pointerY = 0;
    let timer: number | undefined;
    let frame = 0;
    const originalUrl = location.href;

    const draw = () => {
      frame = 0;
      const element = locked ?? suggested;
      if (location.href !== originalUrl) {
        onFinish({ error: "The page changed during capture. Start a new selection." });
        return;
      }
      setView(element ? {
        label: describe(element), rect: bounds(element), locked: !!locked, y: pointerY,
        count: capture.count, imageCount: capture.imageCount, detached: !!locked && !locked.isConnected,
        markers: [...markers].map(([id, { node }]) => ({ id, rect: node.isConnected ? bounds(node) : undefined })),
        markerHover: markerHover?.isConnected ? bounds(markerHover) : undefined,
      } : undefined);
    };
    const redraw = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const sample = () => {
      if (!blocking && locked && location.href === originalUrl) capture.sample(locked);
      redraw();
    };
    const schedule = () => {
      if (locked && timer === undefined) timer = window.setTimeout(() => { timer = undefined; sample(); }, 90);
      redraw();
    };
    const observer = new MutationObserver(schedule);
    const resize = new ResizeObserver(schedule);
    const targetAt = (event: MouseEvent | PointerEvent) => {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      if (!hit || hit.closest("text-transformer-ui")) return;
      const item = hit.closest(CAPTURE_ITEM);
      const group = event.shiftKey && hit.closest("ul, ol, table, [role='list'], [role='listbox'], [role='grid'], [role='table'], main, section");
      const preferred = group || (event.altKey || blocking ? hit : item || hit);
      return canPickElement(hit) && canPickElement(preferred) && (!blocking || canBlockElement(preferred)) && bounds(preferred) ? preferred : undefined;
    };
    const markerAt = (event: MouseEvent | PointerEvent) => {
      if (!markerParent) return;
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const parent = locked ?? hit?.parentElement?.closest(markerParent);
      // Badges may be aria-hidden (with a separate screen-reader label), but still visible.
      return hit && !hit.closest("text-transformer-ui") && parent && canBlockElement(parent) && hit !== parent && parent.contains(hit) && hit.getClientRects().length
        ? { hit, parent } : undefined;
    };
    const move = (event: PointerEvent) => {
      if (!event.isTrusted) return;
      if (markerParent) {
        const next = markerAt(event);
        markerHover = next?.hit;
        suggested = next?.parent;
        redraw();
        return;
      }
      if (locked) return;
      const next = targetAt(event);
      if (next !== suggested) { suggested = next; redraw(); }
    };
    const click = (event: MouseEvent) => {
      if (!event.isTrusted || event.button !== 0 || event.composedPath().some((node) => node instanceof Element && node.matches("text-transformer-ui"))) return;
      if (markerParent) {
        const target = markerAt(event);
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!target) return;
        const { hit, parent } = target;
        if (!locked) lock(parent, event.clientY);
        const marker = describeBlockMarker(hit, parent);
        const id = JSON.stringify(marker);
        if (markers.has(id)) markers.delete(id);
        else if (markers.size < 8) markers.set(id, { node: hit, marker });
        redraw();
        return;
      }
      if (locked) return;
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const target = !event.altKey && !event.shiftKey && suggested && hit && suggested.contains(hit) && canPickElement(suggested)
        ? suggested : targetAt(event);
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!target) return;
      lock(target, event.clientY);
    };
    const lock = (target: Element, y: number) => {
      locked = target;
      pointerY = y;
      observer.observe(locked, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden", "alt", "src", "srcset", "sizes", "media", "poster", "role"] });
      if (locked.parentElement) observer.observe(locked.parentElement, { childList: true });
      resize.observe(locked);
      sample();
    };
    const key = (event: KeyboardEvent) => {
      if (!event.isTrusted) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onFinish({ attachment: null });
      } else if (!markerParent && !locked && suggested && event.key === "ArrowUp" && suggested.parentElement && canPickElement(suggested.parentElement) && (!blocking || canBlockElement(suggested.parentElement))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suggested = suggested.parentElement;
        redraw();
      }
    };
    undoMarker.current = () => {
      const last = [...markers.keys()].at(-1);
      if (last !== undefined) {
        markers.delete(last);
        if (!markers.size && locked) {
          observer.disconnect();
          resize.unobserve(locked);
          locked = undefined;
        }
        redraw();
      }
    };
    add.current = () => {
      if (!locked) return;
      if (location.href !== originalUrl) {
        onFinish({ error: "The page changed during capture. Start a new selection." });
        return;
      }
      if (blocking) {
        if (!locked.isConnected || !canBlockElement(locked)) {
          onFinish({ error: "That area is no longer selectable. Start a new selection." });
          return;
        }
        const blockMarkers = [...markers.values()].filter(({ node }) => locked?.contains(node)).map(({ marker }) => marker);
        if (markerParent && !blockMarkers.length) {
          onFinish({ error: "The selected markers are no longer inside the parent. Try again." });
          return;
        }
        onFinish({ attachment: { id: newChatId(), label: describe(locked), text: "", truncated: false, selector: markerParent ?? blockSelector(locked, true), blockMarkers, pageHost: location.hostname } });
        return;
      }
      sample();
      const result = capture.result();
      if (result.text || result.images.length) {
        onFinish({ attachment: { ...result, id: newChatId(), label: describe(locked), selector: elementSelector(locked), pageHost: location.hostname } });
      }
    };

    window.addEventListener("pointermove", move, options);
    window.addEventListener("click", click, options);
    window.addEventListener("keydown", key, options);
    window.addEventListener("scroll", redraw, options);
    window.addEventListener("load", (event) => {
      if (event.target instanceof HTMLImageElement && locked?.contains(event.target)) schedule();
    }, options);
    window.addEventListener("resize", schedule, options);
    window.addEventListener("pagehide", () => onFinish({ attachment: null }), options);
    onReady();
    return () => {
      events.abort();
      observer.disconnect();
      resize.disconnect();
      add.current = () => {};
      undoMarker.current = () => {};
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [blocking, markerParent, onFinish, onReady]);

  const rect = view?.rect;
  return (
    <div className="pointer-events-none fixed inset-0 z-[2147483647]" dir="ltr">
      {rect && <div className={`fixed rounded-sm border-2 ${view.locked ? "border-yellow-400" : "border-dashed border-yellow-500 bg-yellow-300/10"}`}
        style={{ left: rect.left, top: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top }} />}
      {view?.markers.map(({ id, rect }) => rect && <div key={id} className="fixed rounded-sm border-2 border-cyan-500"
        style={{ left: rect.left, top: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top }} />)}
      {view?.markerHover && <div className="fixed rounded-sm border-2 border-dashed border-cyan-500"
        style={{ left: view.markerHover.left, top: view.markerHover.top, width: view.markerHover.right - view.markerHover.left, height: view.markerHover.bottom - view.markerHover.top }} />}
      {!view?.locked ? (
        <div className="fixed left-3 top-3 rounded-md bg-yellow-100 px-3 py-2 text-xs text-neutral-900 shadow-lg" role="status">
          {markerParent ? "Click a marker inside a matching parent" : <>{view ? `Click to select: ${view.label}` : "Hover over a page element"} · ↑ larger{!blocking && " · Alt exact"}</>} · Esc cancel
        </div>
      ) : (
        <div className="aify-menu pointer-events-auto fixed flex max-w-[calc(100vw-16px)] items-center gap-2 rounded-md border border-yellow-400 bg-yellow-50 px-2 py-1 text-xs text-neutral-900 shadow-lg"
          style={blocking ? { right: 8, bottom: 8 } : { right: rect ? Math.max(8, Math.min(innerWidth - 200, innerWidth - rect.right + 4)) : 8, top: rect ? Math.min(Math.max(8, rect.top, Math.min(view.y, rect.bottom - 30)), innerHeight - 38) : 8 }}>
          <span role="status">{view.detached ? "Area removed" : markerParent ? `${view.markers.length}/8 markers selected` : blocking ? `Parent: ${view.label}` : view.count || view.imageCount ? `${view.count} text · ${view.imageCount} images` : "No content yet"}</span>
          {markerParent && !!view.markers.length && <button type="button" className="shrink-0 rounded px-1 hover:bg-yellow-200" onClick={() => undoMarker.current()}>Undo marker</button>}
          <button type="button" onClick={(event) => { if (event.nativeEvent.isTrusted) add.current(); }} disabled={blocking ? view.detached || (!!markerParent && !view.markers.length) : !view.count && !view.imageCount} aria-label={markerParent ? "Save markers" : blocking ? "Save parent" : "Add page attachment"} className="rounded bg-yellow-300 p-1 disabled:opacity-50">
            {markerParent ? "Save markers" : blocking ? "Save parent" : <IconPlus size={16} />}
          </button>
          <button type="button" onClick={() => onFinish({ attachment: null })} aria-label="Cancel capture" title="Cancel capture" className="rounded p-1 hover:bg-yellow-200"><IconX size={16} /></button>
        </div>
      )}
    </div>
  );
}

function elementSelector(item: Element) {
  const semantic = ["data-testid", "data-item-type", "role", "itemprop"]
    .map((name) => [name, item.getAttribute(name)] as const)
    .find(([, value]) => !!value && value.length < 100);
  if (semantic) return `${item.localName}[${semantic[0]}="${CSS.escape(semantic[1]!)}"]`;
  const stableClasses = [...item.classList].filter((name) => name.length < 50 && !/\d{5,}/.test(name)).slice(0, 2);
  return `${item.localName}${stableClasses.map((name) => `.${CSS.escape(name)}`).join("")}`;
}
