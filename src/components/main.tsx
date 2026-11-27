import React, { useEffect, useRef, useState, useCallback } from "react";
import type { ReferenceType, VirtualElement } from "@floating-ui/react-dom";
import { SETTINGS, defaultInputActions, defaultTextActions } from "@/constants";
import { useAnchoredPopover } from "../hooks/use-anchored-popover";
import { CoreModal } from "./core-modal";
import { onMessage } from "@/utils/messaging";
import { Button } from "@mantine/core";
import { ActionMenu } from "./action-menu";
import { ActionResultPopover } from "./action-result-popover";
import { useTextTransform } from "@/hooks/use-text-transform";
import useLocalStorage from "@/hooks/use-localstorage";
import { useHistory } from "@/hooks/use-history";
import { browser } from "wxt/browser";
import { BLOCK_MARKER_PICKER_PORT, BLOCK_PICKER_PORT, PAGE_PICKER_PORT, type PagePickerMode, type PickPageAttachment, type PagePickerMessage, type PagePickerResult } from "@/utils/page-attachment";
import { PageElementPicker } from "./page-element-picker";
import type { ElementAction } from "@/utils/page-attachment";
import type { ElementActionRequest } from "@/utils/page-attachment";
import { createElementCapture, canPickElement } from "@/utils/capture-element";
import { sendMessage } from "@/utils/messaging";
import { newChatId } from "@/utils/chat-history";
import { applyElementBlockRules, type ElementBlockRule } from "@/utils/element-blocking";

function getInputActionField(target: EventTarget | undefined): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  if (target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && target.type === "text")) {
    return target.readOnly || target.matches(":disabled") ? null : target;
  }
  if (!target.isContentEditable) return null;
  // Anchor to the editing host, not to the paragraph or span that was clicked.
  let field = target;
  while (field.parentElement?.isContentEditable) field = field.parentElement;
  return field;
}

function getInputActionText(field: HTMLElement): string {
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
    ? field.value
    : field.innerText;
}

export const removeHighlight = () => {
  const activeWrappers = document.querySelectorAll(
    ".shorter-ext-text-wrapper-active"
  );
  activeWrappers.forEach((wrapper) => {
    wrapper.classList.remove("shorter-ext-text-wrapper-active");
  });
};

export const AppMain: React.FC = () => {
  const { transform } = useTextTransform();
  const { addHistoryItem } = useHistory();

  const [selection, setSelection] = useState<{
    text: string;
    referenceElement: VirtualElement;
  } | null>(null);
  const [textareaPopover, setTextareaPopover] = useState<{
    element: HTMLElement;
    text: string;
  } | null>(null);
  const [isCoreModalOpen, setIsCoreModalOpen] = useState(false);
  const [showInputActions, setShowInputActions] = useState(false);
  const [showTextActions, setShowTextActions] = useState(false);
  const [context, setContext] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pickerMode, setPickerMode] = useState<PagePickerMode>();
  const picking = !!pickerMode;
  const [elementActionButton, setElementActionButton] = useState<{ action: ElementAction; element: Element; x: number; y: number }>();
  const [quickAction, setQuickAction] = useState<ElementActionRequest>();
  const [quickActionError, setQuickActionError] = useState<string>();
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const picker = useRef<((result: PagePickerResult) => void) | null>(null);
  const pickerReady = useRef<() => void>(undefined);
  const markPickerReady = useCallback(() => {
    pickerReady.current?.();
    pickerReady.current = undefined;
  }, []);
  const finishPicker = useCallback((result: PagePickerResult) => {
    const finish = picker.current;
    picker.current = null;
    pickerReady.current = undefined;
    setPickerMode(undefined);
    finish?.(result);
  }, []);

  const startPicker = useCallback((signal: AbortSignal, mode?: PagePickerMode, onReady?: () => void) => new Promise<Awaited<ReturnType<PickPageAttachment>>>((resolve, reject) => {
    if (signal.aborted) return resolve(null);
    if (!/^https?:$/.test(location.protocol)) return reject(new Error("Open a regular webpage to attach an element."));
    if (picker.current) return reject(new Error("A page selection is already active."));
    if (typeof mode === "object") {
      const { host, selector } = mode.markerParent;
      if (host !== location.hostname) return reject(new Error(`Open ${host} to select markers for this rule.`));
      try {
        if (!document.querySelector(selector)) return reject(new Error("No matching parent on this page. Try another page or reselect the parent."));
      } catch (error) { return reject(error); }
    }
    pickerReady.current = onReady;
    const cancel = () => finishPicker({ attachment: null });
    signal.addEventListener("abort", cancel, { once: true });
    picker.current = (result) => {
      signal.removeEventListener("abort", cancel);
      if ("error" in result) reject(new Error(result.error));
      else resolve(result.attachment);
    };
    setPickerMode(mode ?? "attachment");
  }), [finishPicker]);

  useEffect(() => {
    const connect: Parameters<typeof browser.runtime.onConnect.addListener>[0] = (port) => {
      if (![PAGE_PICKER_PORT, BLOCK_PICKER_PORT, BLOCK_MARKER_PICKER_PORT].includes(port.name) || port.sender?.id !== browser.runtime.id) return;
      const abort = new AbortController();
      port.onDisconnect.addListener(() => abort.abort());
      const reply = (message: PagePickerMessage) => { if (!abort.signal.aborted) port.postMessage(message); };
      const start = (mode?: PagePickerMode) => void startPicker(abort.signal, mode, () => reply({ ready: true })).then(
        (attachment) => reply({ attachment }),
        (error: unknown) => reply({ error: error instanceof Error ? error.message : "Could not start the page picker." }),
      );
      if (port.name === BLOCK_MARKER_PICKER_PORT) {
        const receive = (mode: { markerParent?: { host?: unknown; selector?: unknown } } | undefined) => {
          port.onMessage.removeListener(receive);
          const { host, selector } = mode?.markerParent ?? {};
          if (typeof host !== "string" || typeof selector !== "string" || !selector) return reply({ error: "Missing parent selector." });
          start({ markerParent: { host, selector } });
        };
        port.onMessage.addListener(receive);
      } else start(port.name === BLOCK_PICKER_PORT ? "block" : undefined);
    };
    browser.runtime.onConnect.addListener(connect);
    return () => {
      browser.runtime.onConnect.removeListener(connect);
      const finish = picker.current;
      picker.current = null;
      pickerReady.current = undefined;
      finish?.({ attachment: null });
    };
  }, [startPicker]);

  // Use useLocalStorage for all settings
  const [inputActionsList] = useLocalStorage(
    SETTINGS.INPUT_ACTIONS,
    defaultInputActions
  );
  const [textActionsList] = useLocalStorage(
    SETTINGS.TEXT_ACTIONS,
    defaultTextActions
  );
  const [defaultAction] = useLocalStorage(SETTINGS.DEFAULT_ACTION, null);
  const [minWords] = useLocalStorage(SETTINGS.MIN_WORDS, 2);
  const [isEnabled] = useLocalStorage(SETTINGS.ENABLED, true);
  const [elementActions] = useLocalStorage<ElementAction[]>(SETTINGS.ELEMENT_ACTIONS, []);
  const [blockRules] = useLocalStorage<ElementBlockRule[]>(SETTINGS.ELEMENT_BLOCK_RULES, []);
  const countedBlocks = useRef(new Map<string, WeakSet<Element>>());
  useEffect(() => {
    const ruleIds = new Set(blockRules.map(({ id }) => id));
    for (const id of countedBlocks.current.keys()) {
      if (!ruleIds.has(id)) countedBlocks.current.delete(id);
    }
    if (isEnabled) return applyElementBlockRules(blockRules, {
      seen: countedBlocks.current,
      record: (counts) => {
        void sendMessage("recordBlockedElements", counts).catch((error) => {
          console.debug("Could not save Block List counts:", error);
        });
      },
    });
  }, [isEnabled, blockRules]);

  useEffect(() => {
    setElementActionButton(undefined);
    if (!isEnabled || picking || !elementActions.length) return;
    let hideTimer: number | undefined;
    const keepVisible = () => {
      window.clearTimeout(hideTimer);
      hideTimer = undefined;
    };
    const hideSoon = () => {
      if (hideTimer !== undefined) return;
      hideTimer = window.setTimeout(() => {
        hideTimer = undefined;
        if (!actionButtonRef.current?.matches(":hover")) setElementActionButton(undefined);
      }, 300);
    };
    const move = (event: PointerEvent) => {
      if (!event.isTrusted) return;
      const button = actionButtonRef.current;
      if (button && (event.composedPath().includes(button) || button.matches(":hover"))) {
        keepVisible();
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !canPickElement(target)) { hideSoon(); return; }
      const match = elementActions.find((action) => {
        if (action.host !== location.hostname) return false;
        try { return !!target.closest(action.selector); } catch { return false; }
      });
      const element = match ? target.closest(match.selector) : null;
      if (!match || !element) { hideSoon(); return; }
      keepVisible();
      const rect = element.getBoundingClientRect();
      const x = Math.max(8, Math.min(innerWidth - 150, rect.right + 6));
      const y = Math.max(8, Math.min(innerHeight - 40, Math.max(rect.top, event.clientY - 12)));
      setElementActionButton((current) => current?.element === element && current.action === match && current.x === x && current.y === y
        ? current : { action: match, element, x, y });
    };
    const clear = (event: PointerEvent) => {
      if (event.isTrusted && !event.relatedTarget) hideSoon();
    };
    document.addEventListener("pointerover", move, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerout", clear, true);
    return () => {
      keepVisible();
      document.removeEventListener("pointerover", move, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerout", clear, true);
    };
  }, [isEnabled, picking, elementActions]);

  const highlightedActionTarget = isEnabled && !picking ? elementActionButton?.element : undefined;
  useEffect(() => {
    if (!highlightedActionTarget?.isConnected) return;
    const attribute = "data-aify-quick-action-target";
    const sheet = new CSSStyleSheet();
    sheet.insertRule(`[${attribute}] { outline: 1px solid rgba(59, 130, 246, 0.55) !important; outline-offset: 2px !important; }`);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    highlightedActionTarget.setAttribute(attribute, "");
    return () => {
      highlightedActionTarget.removeAttribute(attribute);
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== sheet);
    };
  }, [highlightedActionTarget]);

  const runElementAction = useCallback(async () => {
    const current = elementActionButton;
    if (!current) return;
    setElementActionButton(undefined);
    setQuickActionError(undefined);
    try {
      if (!current.element.isConnected) throw new Error("That area is no longer on the page.");
      const capture = createElementCapture();
      capture.sample(current.element);
      const result = capture.result();
      if (!result.text && !result.images.length) throw new Error("No text or images could be captured from that area.");
      await sendMessage("launchSavedElementAction", {
        action: current.action,
        attachment: { ...result, id: newChatId(), label: current.action.title, selector: current.action.selector, pageHost: location.hostname },
      });
    } catch (error) {
      setQuickActionError(error instanceof Error ? error.message : "Could not start a chat.");
    }
  }, [elementActionButton]);

  useEffect(() => onMessage("runSavedElementAction", ({ data }) => {
    setContext(null);
    setShowSettings(false);
    setQuickAction(data);
    setIsCoreModalOpen(true);
  }), []);

  // Action result popover state
  const [actionResult, setActionResult] = useState<{
    action: string;
    text: string;
    referenceElement: ReferenceType;
    loading: boolean;
    result?: string;
    error?: string;
  } | null>(null);

  // Popper state for textarea popover
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
    null
  );
  const popoverStyle = useAnchoredPopover(
    textareaPopover?.element || null,
    popperElement,
    "bottom-start", 4
  );

  // Popper state for selection button
  const [selectionButtonElement, setSelectionButtonElement] =
    useState<HTMLDivElement | null>(null);
  const [selectionMenuAnchor, setSelectionMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const [inputMenuAnchor, setInputMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const selectionStyle = useAnchoredPopover(selection?.referenceElement || null, selectionButtonElement, "bottom", 10);

  // console.log("rendering main component");

  const handleClose = useCallback(() => {
    setSelection(null);
    setShowTextActions(false);
    removeHighlight();
  }, []);

  // Clean up textarea popover when text selection changes
  useEffect(() => {
    if (selection) {
      setTextareaPopover(null);
      setShowInputActions(false);
    }
  }, [selection]);

  const activateInputActions = useCallback((field: HTMLElement) => {
    setTextareaPopover({ element: field, text: getInputActionText(field) });
    setSelection(null);
    setShowTextActions(false);
  }, []);

  const handleEditableFocus = useCallback(
    (event: FocusEvent) => {
      if (!isEnabled || picking) return;

      const path = event.composedPath();
      if (path.some((node) => node instanceof HTMLElement && node.localName === "text-transformer-ui")) return;

      setShowInputActions(false);
      const field = getInputActionField(path.find((node) => node instanceof HTMLElement));
      if (field) activateInputActions(field);
      else setTextareaPopover(null);
    },
    [isEnabled, picking, activateInputActions]
  );

  // Listen for input changes to update the text value
  useEffect(() => {
    const element = textareaPopover?.element;
    if (!element) return;

    const handleInput = () => {
      const text = getInputActionText(element);
      setTextareaPopover((prev) => prev?.element === element ? { element, text } : prev);
    };

    element.addEventListener("input", handleInput);

    return () => {
      element.removeEventListener("input", handleInput);
    };
  }, [textareaPopover?.element]);

  const handleSelectionAifyClick = useCallback(() => {
    setShowTextActions((open) => !open);
  }, []);

  // Process text action function with proper dependencies
  const processTextAction = useCallback(
    async (action: string, text: string) => {
      try {
        const result = await transform(action, text);
        return result;
      } catch (err) {
        throw err;
      }
    },
    [transform]
  );

  const handleTextAction = useCallback(
    async (action: string) => {
      if (!selection) return;

      if (action === "Chat") {
        setContext(selection.text);
        setIsCoreModalOpen(true);
        setShowTextActions(false);
        handleClose();
        return;
      }

      if (action === "Settings") {
        setIsCoreModalOpen(true);
        setShowSettings(true);
        setShowTextActions(false);
        handleClose();
        return;
      }

      console.log(`Performing ${action} on text:`, selection.text);
      setShowTextActions(false);

      // Set loading state
      setActionResult({
        action,
        text: selection.text,
        referenceElement: selection.referenceElement,
        loading: true,
      });

      try {
        // Process the action
        const result = await processTextAction(action, selection.text);

        // Save to history
        await addHistoryItem({
          action,
          text: selection.text,
          result,
        });

        // Update with result
        setActionResult((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                result,
              }
            : null
        );
      } catch (error) {
        // Update with error
        setActionResult((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: error instanceof Error ? error.message : "Unknown error",
              }
            : null
        );
      }

      // Don't call handleClose() here as we want to keep the result visible
    },
    [selection, processTextAction, handleClose, addHistoryItem]
  );

  const handleCloseActionResult = useCallback(() => {
    setActionResult(null);
    handleClose();
  }, [handleClose]);

  const handleMouseUp = useCallback(
    async (event: MouseEvent) => {
      if (!isEnabled || picking) return;

      const path = event.composedPath();
      if (path.some((node) => node instanceof Element &&
        (node.localName === "text-transformer-ui" || node.classList.contains("aify-menu")))) {
        return;
      }

      const field = getInputActionField(path.find((node) => node instanceof HTMLElement));
      if (field) {
        // An editor that's already focused won't fire focusin again on click.
        activateInputActions(field);
        return;
      }

      const selectedText = window.getSelection()?.toString() || "";
      const wordCount = selectedText.trim().split(/\s+/).length;

      if (selectedText.trim() && wordCount >= minWords) {
        // Clean up textarea popover only if we're not in an input
        setTextareaPopover(null);
        setShowInputActions(false);

        const selection = window.getSelection();
        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0).cloneRange();
        const node = range.commonAncestorContainer;
        const referenceElement = {
          contextElement: node instanceof Element ? node : node.parentElement ?? document.body,
          getBoundingClientRect: () => range.getBoundingClientRect(),
        };

        setSelection({
          text: selectedText,
          referenceElement,
        });
      }
    },
    [isEnabled, picking, minWords, activateInputActions]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
        handleCloseActionResult();
        setTextareaPopover(null);
        setShowInputActions(false);
        setShowTextActions(false);
      }
    },
    [handleClose, handleCloseActionResult]
  );

  // Central mousedown event handler for all click outside logic
  const handleGlobalMouseDown = useCallback(
    (event: MouseEvent) => {
      const path = event.composedPath && event.composedPath();
      const realTarget =
        path && path.length > 0
          ? (path[0] as Element)
          : (event.target as Element);

      // Check if clicked inside menu
      const isClickedInsideMenu =
        realTarget?.closest?.(".aify-menu") ||
        path?.some((el) => {
          const element = el as Element;
          return element.classList?.contains("aify-menu");
        });

      // Don't hide menus if clicking inside them
      if (isClickedInsideMenu) {
        return;
      }

      // Check if clicked inside the active textarea/input
      const isClickedInsideTextarea =
        realTarget === textareaPopover?.element ||
        path?.some((el) => {
          const element = el as Element;
          return textareaPopover?.element === element;
        });

      // Keep textareaPopover if clicking inside the active input
      if (isClickedInsideTextarea) {
        return;
      }

      // Reset input actions if clicking outside
      if (!isClickedInsideMenu && !isClickedInsideTextarea) {
        setShowInputActions(false);
      }

      // Handle text actions menu click outside
      if (!isClickedInsideMenu) {
        handleClose();
      }

      // Only reset textareaPopover if clicking outside both textarea and menu
      if (!isClickedInsideTextarea && !isClickedInsideMenu) {
        setTextareaPopover(null);
      }
    },
    [selection, showTextActions, textareaPopover, handleClose]
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleGlobalMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleEditableFocus, true);

    return () => {
      document.removeEventListener("mousedown", handleGlobalMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleEditableFocus, true);
    };
  }, [
    handleGlobalMouseDown,
    handleMouseUp,
    handleKeyDown,
    handleEditableFocus,
  ]);

  useEffect(() => {
    const unsubscribe = onMessage("toggleCoreModal", ({ data }) => {
      if (data.context) {
        setContext(data.context);
      }
      setIsCoreModalOpen(data.visible);
    });

    return () => unsubscribe();
  }, []);

  const handleCloseModal = () => {
    setIsCoreModalOpen(false);
    setContext(null);
    setShowSettings(false);
  };

  const handleInputAction = useCallback(
    async (action: string) => {
      if (!textareaPopover) return;

      if (action === "Chat") {
        setContext(textareaPopover.text);
        setIsCoreModalOpen(true);
        setShowInputActions(false);
        setTextareaPopover(null);
        return;
      }

      if (action === "Settings") {
        setIsCoreModalOpen(true);
        setShowSettings(true);
        setShowInputActions(false);
        setTextareaPopover(null);
        return;
      }

      console.log(`Performing ${action} on text:`, textareaPopover.text);
      setShowInputActions(false);

      // Set loading state
      setActionResult({
        action,
        text: textareaPopover.text,
        referenceElement: textareaPopover.element,
        loading: true,
      });

      try {
        const result = await processTextAction(action, textareaPopover.text);

        // Save to history
        await addHistoryItem({
          action,
          text: textareaPopover.text,
          result,
        });

        setActionResult((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                result,
              }
            : null
        );
      } catch (error) {
        setActionResult((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: error instanceof Error ? error.message : "Unknown error",
              }
            : null
        );
      }

      setTextareaPopover(null);
    },
    [textareaPopover, processTextAction, addHistoryItem]
  );

  const handleAifyButtonClick = (e: React.MouseEvent) => {
    setShowInputActions((prev) => !prev);
  };

  return (
    <>
      {pickerMode && <PageElementPicker mode={pickerMode} onFinish={finishPicker} onReady={markPickerReady} />}
      {elementActionButton && !picking && <button ref={actionButtonRef} type="button" className="aify-menu fixed z-[2147483646] rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white shadow-lg hover:bg-blue-700" style={{ left: elementActionButton.x, top: elementActionButton.y }} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); void runElementAction(); }}>{elementActionButton.action.title}</button>}
      {quickActionError && <div role="alert" className="aify-menu fixed right-3 top-3 z-[2147483646] flex max-w-xs items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-900 shadow-lg">
        <span>Quick Action failed: {quickActionError}</span>
        <button type="button" aria-label="Dismiss error" onClick={() => setQuickActionError(undefined)}>×</button>
      </div>}
      <div style={picking ? { display: "none" } : { display: "contents" }}>
      <CoreModal
        isOpen={isCoreModalOpen}
        onClose={handleCloseModal}
        context={context || undefined}
        onContextChange={setContext}
        showSettings={showSettings}
        pickPageAttachment={startPicker}
        savedAction={quickAction}
        onSavedActionStart={() => setQuickAction(undefined)}
      />

      {/* Action Result Popover */}
      {actionResult && (
        <ActionResultPopover
          opened={!!actionResult}
          onClose={handleCloseActionResult}
          referenceElement={actionResult.referenceElement}
          action={actionResult.action}
          text={actionResult.text}
          result={actionResult.result}
          loading={actionResult.loading}
          error={actionResult.error}
        />
      )}

      {selection && !actionResult && (
        <div
          ref={setSelectionButtonElement}
          style={selectionStyle}
          className="z-50 aify-selection-button"
        >
          <div className="relative flex select-none items-center gap-2 aify-menu">
            <Button
              size="xs"
              key={"selection-aify"}
              ref={setSelectionMenuAnchor}
              aria-expanded={showTextActions}
              variant="default"
              onClick={handleSelectionAifyClick}
              className="hover:bg-blue-100 shadow-xl min-w-[60px]"
            >
              Aify
            </Button>
            {defaultAction && (
              <Button
                key={"selection-action"}
                size="xs"
                variant="filled"
                color="blue"
                className="shadow-xl min-w-[60px]"
                onClick={() => handleTextAction(defaultAction)}
              >
                {defaultAction}
              </Button>
            )}
            <ActionMenu
              actions={(textActionsList ?? "").split("\n")}
              onSelect={handleTextAction}
              show={showTextActions}
              anchor={selectionMenuAnchor}
            />
          </div>
        </div>
      )}
      {textareaPopover && !selection && !actionResult && (
        <div
          ref={setPopperElement}
          style={popoverStyle}
          className="z-50 textarea-popover"
        >
          <div
            className="relative select-none aify-menu"
            onMouseDown={(event) => {
              // Keep the editor's focus and caret when clicking the trigger or a menu button.
              if (event.button === 0 && event.target instanceof Element && event.target.closest("button")) {
                event.preventDefault();
              }
            }}
          >
            <Button
              size="xs"
              key={"textarea-aify"}
              ref={setInputMenuAnchor}
              aria-expanded={showInputActions}
              variant="default"
              onClick={handleAifyButtonClick}
              className="bg-blue-50 hover:bg-blue-100 shadow-xl min-w-[60px]"
            >
              Aify
            </Button>

            <ActionMenu
              actions={(inputActionsList ?? "").split("\n")}
              onSelect={handleInputAction}
              show={showInputActions}
              anchor={inputMenuAnchor}
            />
          </div>
        </div>
      )}
      </div>
    </>
  );
};
