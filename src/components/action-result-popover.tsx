import React from "react";
import { usePopper } from "react-popper";
import { Loader, Text, ActionIcon, Tooltip } from "@mantine/core";
import {
  IconCheck,
  IconX,
  IconCopy,
  IconX as IconClose,
} from "@tabler/icons-react";
import { useClipboard } from "@mantine/hooks";
import { getActionIcon } from "../utils/action-icon";

// Helper function to check if text starts with RTL characters
const isRTL = (text: string) => {
  const rtlRegex =
    /^[⁦\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  return rtlRegex.test(text);
};

interface ActionResultPopoverProps {
  opened: boolean;
  onClose: () => void;
  referenceElement: HTMLElement | null;
  action: string;
  text: string;
  result?: string;
  loading: boolean;
  error?: string;
}

export const ActionResultPopover: React.FC<ActionResultPopoverProps> = ({
  opened,
  onClose,
  referenceElement,
  action,
  text,
  result,
  loading,
  error,
}) => {
  const [popperElement, setPopperElement] =
    React.useState<HTMLDivElement | null>(null);
  const clipboard = useClipboard();
  const [copied, setCopied] = React.useState(false);
  const ActionIconComponent = getActionIcon(action);

  const handleCopy = () => {
    clipboard.copy(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  // Handle click outside
  React.useEffect(() => {
    if (!opened) return;
    function handleClick(event: MouseEvent) {
      // Use composedPath for shadow DOM support
      const path = event.composedPath ? event.composedPath() : [];
      const isInPopover = popperElement && path.includes(popperElement);
      const isInReference = referenceElement && path.includes(referenceElement);
      if (!isInPopover && !isInReference) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [opened, popperElement, referenceElement, onClose]);

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: "bottom-start", // Changed from "bottom" to "bottom-start" to align with the start of the reference
    modifiers: [
      {
        name: "offset",
        options: {
          offset: [0, 16],
        },
      },
      {
        name: "preventOverflow",
        options: {
          boundary: document.body,
        },
      },
    ],
  });

  if (!opened || !referenceElement) return null;

  return (
    <div
      ref={setPopperElement}
      style={styles.popper}
      {...attributes.popper}
      className="z-[1000] bg-white shadow-md p-4 !border !border-gray-200 !border-solid rounded-md w-[320px] action-result-popover"
    >
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ActionIconComponent size={16} />
            <Text size="sm" fw={500}>
              {action}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader size="xs" />
            ) : error ? (
              <IconX size={16} className="text-red-500" />
            ) : null}
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={onClose}
              aria-label="Close"
            >
              <IconClose size={16} />
            </ActionIcon>
          </div>
        </div>

        {loading && (
          <Text size="xs" c="dimmed">
            Processing...
          </Text>
        )}

        {error && (
          <Text size="xs" c="red">
            {error}
          </Text>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Text size="xs" c="dimmed">
                Result:
              </Text>
              <Tooltip label="Copy to clipboard">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={handleCopy}
                  aria-label="Copy to clipboard"
                >
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </ActionIcon>
              </Tooltip>
            </div>
            <div
              className="bg-gray-50 p-2 rounded text-sm"
              dir={isRTL(result) ? "rtl" : "ltr"}
            >
              {result}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
