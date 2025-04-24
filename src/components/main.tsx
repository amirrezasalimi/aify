import React, { useEffect, useState, useCallback } from "react";
import { SETTINGS, defaultInputActions, defaultTextActions } from "@/constants";
import { usePopper } from "react-popper";
import { CoreModal } from "./core-modal";
import { onMessage } from "@/utils/messaging";
import { Button } from "@mantine/core";
import { ActionMenu } from "./action-menu";
import { ActionResultPopover } from "./action-result-popover";
import { useTextTransform } from "@/hooks/use-text-transform";
import useLocalStorage from "@/hooks/use-localstorage";
import { useHistory } from "@/hooks/use-history";

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
    referenceElement: HTMLElement | null;
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

  // Action result popover state
  const [actionResult, setActionResult] = useState<{
    action: string;
    text: string;
    referenceElement: HTMLElement | null;
    loading: boolean;
    result?: string;
    error?: string;
  } | null>(null);

  // Popper state for textarea popover
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
    null
  );
  const { styles, attributes } = usePopper(
    textareaPopover?.element || null,
    popperElement,
    {
      placement: "bottom-start",
      modifiers: [
        {
          name: "offset",
          options: {
            offset: [0, 4],
          },
        },
        {
          name: "preventOverflow",
          options: {
            padding: 8,
          },
        },
      ],
    }
  );

  // Popper state for selection button
  const [selectionButtonElement, setSelectionButtonElement] =
    useState<HTMLDivElement | null>(null);
  const { styles: selectionStyles, attributes: selectionAttributes } =
    usePopper(selection?.referenceElement || null, selectionButtonElement, {
      placement: "bottom",
      strategy: "fixed",
      modifiers: [
        {
          name: "offset",
          options: {
            offset: [0, 10],
          },
        },
        {
          name: "preventOverflow",
          options: {
            padding: 8,
            boundary: document.body,
          },
        },
        {
          name: "flip",
          options: {
            fallbackPlacements: ["bottom-start", "bottom-end"],
          },
        },
      ],
    });

  console.log("rendering main component");

  const handleClose = useCallback(() => {
    if (selection?.referenceElement) {
      selection.referenceElement.remove();
    }
    setSelection(null);
    setShowTextActions(false);
    removeHighlight();
  }, [selection]);

  // Clean up textarea popover when text selection changes
  useEffect(() => {
    if (selection) {
      setTextareaPopover(null);
      setShowInputActions(false);
    }
  }, [selection]);

  const handleTextareaFocus = useCallback(
    (event: FocusEvent) => {
      if (!isEnabled) return;

      const target = event.target as HTMLElement;
      const isInputType =
        target.tagName.toLowerCase() === "textarea" ||
        (target.tagName.toLowerCase() === "input" &&
          (target as HTMLInputElement).type === "text");

      if (isInputType) {
        const value = (target as HTMLTextAreaElement | HTMLInputElement).value;

        setTextareaPopover({
          element: target,
          text: value,
        });

        setSelection(null);
        setShowTextActions(false);
      }
    },
    [isEnabled]
  );

  // Listen for input changes to update the text value
  useEffect(() => {
    if (!textareaPopover?.element) return;

    const handleInput = (e: Event) => {
      const target = e.target as HTMLTextAreaElement | HTMLInputElement;
      setTextareaPopover((prev) =>
        prev
          ? {
              ...prev,
              text: target.value,
            }
          : null
      );
    };

    const element = textareaPopover.element;
    element.addEventListener("input", handleInput);

    return () => {
      element.removeEventListener("input", handleInput);
    };
  }, [textareaPopover?.element]);

  const handleSelectionAifyClick = useCallback(() => {
    setShowTextActions(true);
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

      // Need to create a fixed position element that doesn't disappear when selection is cleared
      const virtualEl = document.createElement("div");
      virtualEl.style.position = "absolute";

      if (selection.referenceElement) {
        const rect = selection.referenceElement.getBoundingClientRect();
        virtualEl.style.left = `${rect.left + window.scrollX}px`;
        virtualEl.style.top = `${rect.top + window.scrollY}px`;
        document.body.appendChild(virtualEl);
      }

      // Set loading state
      setActionResult({
        action,
        text: selection.text,
        referenceElement: virtualEl,
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
    if (actionResult?.referenceElement) {
      actionResult.referenceElement.remove();
    }
    setActionResult(null);
    handleClose();
  }, [actionResult, handleClose]);

  const handleMouseUp = useCallback(
    async (event: MouseEvent) => {
      if (!isEnabled) return;

      // Don't process if clicking on Aify menu components
      if ((event.target as Element)?.closest?.(".aify-menu")) {
        return;
      }

      // Get the active element
      const activeEl = document.activeElement;
      const isInputOrTextarea =
        activeEl &&
        (activeEl.tagName === "TEXTAREA" ||
          (activeEl.tagName === "INPUT" &&
            (activeEl as HTMLInputElement).type === "text"));

      // If we're in an input/textarea, maintain the existing textareaPopover
      if (isInputOrTextarea) {
        return;
      }

      const selectedText = window.getSelection()?.toString() || "";
      const wordCount = selectedText.trim().split(/\s+/).length;

      if (wordCount >= minWords) {
        // Clean up textarea popover only if we're not in an input
        setTextareaPopover(null);
        setShowInputActions(false);

        const selection = window.getSelection();
        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);
        let referenceElement: HTMLElement | null = null;
        let rect = range.getBoundingClientRect();

        const virtualEl = document.createElement("div");
        virtualEl.style.position = "absolute";
        virtualEl.style.left = `${rect.left + window.scrollX}px`;
        virtualEl.style.top = `${rect.top + window.scrollY}px`;
        document.body.appendChild(virtualEl);
        referenceElement = virtualEl;

        setSelection({
          text: selectedText,
          referenceElement,
        });
      }
    },
    [isEnabled, minWords, defaultAction, textareaPopover, showInputActions]
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
      const isClickedInsideMenu = path?.some((el) => {
        const element = el as Element;
        return element.classList?.contains("aify-menu");
      });

      // Don't hide menus if clicking inside them
      if (isClickedInsideMenu) {
        return;
      }

      // Check if clicked inside the active textarea/input
      const isClickedInsideTextarea = path?.some((el) => {
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
      if (selection && showTextActions && !isClickedInsideMenu) {
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
    document.addEventListener("focusin", handleTextareaFocus);

    return () => {
      document.removeEventListener("mousedown", handleGlobalMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleTextareaFocus);
    };
  }, [
    handleGlobalMouseDown,
    handleMouseUp,
    handleKeyDown,
    handleTextareaFocus,
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

      // Create a virtual element for the action result position
      const virtualEl = document.createElement("div");
      virtualEl.style.position = "absolute";

      // Position at the bottom of the textarea/input
      const textareaRect = textareaPopover.element.getBoundingClientRect();
      virtualEl.style.left = `${textareaRect.left + window.scrollX}px`;
      virtualEl.style.top = `${textareaRect.bottom + window.scrollY}px`;
      document.body.appendChild(virtualEl);

      // Set loading state
      setActionResult({
        action,
        text: textareaPopover.text,
        referenceElement: virtualEl,
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
      <CoreModal
        isOpen={isCoreModalOpen}
        onClose={handleCloseModal}
        context={context || undefined}
        onContextChange={setContext}
        showSettings={showSettings}
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
          style={selectionStyles.popper}
          {...selectionAttributes.popper}
          className="z-50 aify-selection-button"
        >
          <div className="relative flex items-center gap-2 aify-menu">
            <Button
              size="xs"
              key={"selection-aify"}
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
            />
          </div>
        </div>
      )}
      {textareaPopover && !selection && !actionResult && (
        <div
          ref={setPopperElement}
          style={styles.popper}
          {...attributes.popper}
          className="z-50 textarea-popover"
        >
          <div className="relative aify-menu">
            <Button
              size="xs"
              key={"textarea-aify"}
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
            />
          </div>
        </div>
      )}
    </>
  );
};
