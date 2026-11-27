import { autoUpdate, flip, hide, offset, shift, size, useFloating, type Placement, type ReferenceType } from "@floating-ui/react-dom";

function autoUpdateWithScrollDebounce(reference: ReferenceType, floating: HTMLElement, update: () => void) {
  let timer: number | undefined;
  let burstStart: number | undefined;
  const target = reference instanceof Element ? reference : reference.contextElement;
  const cleanup = autoUpdate(reference, floating, update, { ancestorScroll: false });
  // Capture scroll from nested page containers as well as the document itself.
  const onScroll = (event: Event) => {
    if (event.target instanceof Element && !event.target.contains(target ?? null)) return;
    window.clearTimeout(timer);
    const now = performance.now();
    burstStart ??= now;
    timer = window.setTimeout(() => {
      burstStart = undefined;
      update();
    }, Math.max(0, Math.min(50, 120 - (now - burstStart))));
  };
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  window.visualViewport?.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    cleanup();
    window.clearTimeout(timer);
    window.removeEventListener("scroll", onScroll, true);
    window.visualViewport?.removeEventListener("scroll", onScroll);
  };
}

export function useAnchoredPopover(reference: ReferenceType | null, floating: HTMLElement | null, placement: Placement, gap: number, constrainSize = false) {
  const padding = 8;
  const { floatingStyles, middlewareData, isPositioned } = useFloating({
    elements: { reference, floating },
    placement,
    strategy: "fixed",
    transform: false,
    middleware: [offset(gap), flip({ padding }), shift({ padding }), constrainSize && size({
      padding,
      apply({ availableWidth, availableHeight, elements }) {
        elements.floating.style.maxWidth = `${Math.max(0, availableWidth)}px`;
        elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
      },
    }), hide()],
    whileElementsMounted: autoUpdateWithScrollDebounce,
  });
  return {
    ...floatingStyles,
    visibility: !isPositioned || middlewareData.hide?.referenceHidden ? "hidden" as const : undefined,
  };
}
