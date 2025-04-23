import { useEffect, useState, useRef } from "react";
import {
  IconX,
  IconSettings,
  IconArrowLeft,
  IconHistory,
  IconWorld,
} from "@tabler/icons-react";
import { useDrag } from "@use-gesture/react";
import { useViewportSize } from "@mantine/hooks";
import { Title, Badge } from "@mantine/core";
import { Resizable } from "re-resizable";
import { SettingsPanel } from "./settings-panel";
import { HistoryPanel } from "./history-panel";
import ChatPanel from "./chat-panel";
import { WEBSITE_URL } from "../constants";

// Constants for modal configuration
const INITIAL_WIDTH = 550;
const INITIAL_HEIGHT = 400;
const MIN_WIDTH = 400; // Set to same as initial width
const MIN_HEIGHT = 300; // Set to same as initial height
const MAX_WIDTH = 800;
const MAX_HEIGHT = 500;

interface CoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: string;
  onContextChange?: (context: string | null) => void;
  showSettings?: boolean;
}

interface ModalDimensions {
  width: number;
  height: number;
}

export const CoreModal = ({
  isOpen,
  onClose,
  context,
  onContextChange,
  showSettings: initialShowSettings = false,
}: CoreModalProps) => {
  const { width: vpWidth, height: vpHeight } = useViewportSize();

  // Dynamic max dimensions based on viewport
  const effectiveMaxWidth = Math.min(MAX_WIDTH, vpWidth * 0.9);
  const effectiveMaxHeight = Math.min(MAX_HEIGHT, vpHeight * 0.9);

  // Calculate center position (only when viewport dimensions are valid)
  const getCenteredPosition = () => ({
    x: Math.max(0, Math.floor((vpWidth - INITIAL_WIDTH) / 2)),
    y: Math.max(0, Math.floor((vpHeight - INITIAL_HEIGHT) / 2)),
  });

  // Ensure dimensions are within bounds
  const validateDimensions = (dim: ModalDimensions): ModalDimensions => ({
    width: Math.min(Math.max(dim.width, MIN_WIDTH), effectiveMaxWidth),
    height: Math.min(Math.max(dim.height, MIN_HEIGHT), effectiveMaxHeight),
  });

  // Ensure position is within viewport
  const validatePosition = (
    pos: { x: number; y: number },
    dim: ModalDimensions
  ) => ({
    x: Math.min(Math.max(pos.x, 0), vpWidth - dim.width),
    y: Math.min(Math.max(pos.y, 0), vpHeight - dim.height),
  });

  // Initial state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState<ModalDimensions>({
    width: INITIAL_WIDTH,
    height: INITIAL_HEIGHT,
  });
  const [opacity, setOpacity] = useState(0);
  const [scale, setScale] = useState(1);
  const [showSettings, setShowSettings] = useState(initialShowSettings);
  const [showHistory, setShowHistory] = useState(false);

  // Add a ref to track if we're actually dragging
  const isDragging = useRef(false);
  const dragRef = useRef({ x: 0, y: 0 });

  // Effects for positioning and visibility
  useEffect(() => {
    if (vpWidth > 0 && vpHeight > 0 && isOpen) {
      setPosition(getCenteredPosition());
      setOpacity(1);
    }
  }, [vpWidth, vpHeight, isOpen]);

  // Ensure modal stays within viewport when window is resized
  useEffect(() => {
    if (vpWidth > 0 && vpHeight > 0) {
      const validDim = validateDimensions(dimensions);
      const validPos = validatePosition(position, validDim);

      // Only update if actually changed
      if (
        validDim.width !== dimensions.width ||
        validDim.height !== dimensions.height
      ) {
        setDimensions(validDim);
      }
      if (validPos.x !== position.x || validPos.y !== position.y) {
        setPosition(validPos);
      }
    }
  }, [vpWidth, vpHeight]);

  // Update showSettings when prop changes
  useEffect(() => {
    setShowSettings(initialShowSettings);
  }, [initialShowSettings]);

  const bindDrag = useDrag(
    ({ movement: [mx, my], first, last, active }) => {
      if (first) {
        // Store current position as the base for the movement
        dragRef.current = { ...position };
        isDragging.current = true;
      }

      if (active && isDragging.current) {
        // Only update position while actively dragging
        const newX = Math.min(
          Math.max(dragRef.current.x + mx, 0),
          vpWidth - dimensions.width
        );
        const newY = Math.min(
          Math.max(dragRef.current.y + my, 0),
          vpHeight - dimensions.height
        );

        setPosition({ x: newX, y: newY });
        setScale(active ? 1.02 : 1);
      }

      if (last) {
        isDragging.current = false;
        setScale(1);
      }
    },
    {
      filterTaps: true,
      preventScroll: true,
    }
  );

  // Handle resize completion
  const handleResizeStop = (d: any, direction: any, ref: HTMLElement) => {
    const newWidth = ref.offsetWidth;
    const newHeight = ref.offsetHeight;

    // Calculate position adjustment to maintain center point
    if (direction.includes("left")) {
      // When resizing from left, adjust x position to maintain center
      const widthDiff = newWidth - dimensions.width;
      setPosition((prev) => ({
        ...prev,
        x: prev.x - widthDiff,
      }));
    }

    setDimensions({ width: newWidth, height: newHeight });
  };

  if (!isOpen) return null;

  const logoUrl = browser.runtime.getURL("/icon/128.png");
  return (
    <Resizable
      size={{ width: dimensions.width, height: dimensions.height }}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
      maxWidth={effectiveMaxWidth}
      maxHeight={effectiveMaxHeight}
      onResizeStop={handleResizeStop}
      enable={{
        top: false,
        right: true,
        bottom: true,
        left: true,
        topRight: false,
        bottomRight: true,
        bottomLeft: true,
        topLeft: false,
      }}
      className="z-[100000] !fixed"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transition: "opacity 0.1s, transform 0.2s",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div className="flex flex-col bg-neutral-50 shadow-2xl border border-neutral-200 border-solid rounded-2xl size-full overflow-hidden">
        <div
          {...bindDrag()}
          className="flex justify-between items-center bg-zinc-100 px-3 h-12 !touch-none cursor-move select-none"
        >
          <div className="flex items-center gap-2">
            {showSettings || showHistory ? (
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowHistory(false);
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <IconArrowLeft size={18} />
              </button>
            ) : (
              <div
                className="bg-contain rounded-full !size-[24px]"
                style={{
                  backgroundImage: `url(${logoUrl})`,
                }}
              />
            )}
            <Title order={4} className="flex items-center gap-2">
              {showSettings ? (
                "Settings"
              ) : showHistory ? (
                "History"
              ) : (
                <>
                  Aify
                  <a
                    href={WEBSITE_URL}
                    className="cursor-pointer"
                    target="_blank"
                  >
                    <Badge size="sm" variant="light" color="cyan">
                      FREE
                    </Badge>
                  </a>
                </>
              )}
            </Title>
          </div>
          <div className="flex items-center gap-2">
            {!showSettings && !showHistory && (
              <>
                <button
                  onClick={() => window.open(WEBSITE_URL, "_blank")}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <IconWorld size={18} />
                </button>
                <button
                  onClick={() => setShowHistory(true)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <IconHistory size={18} />
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <IconSettings size={18} />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 p-2 overflow-auto">
          {showSettings ? (
            <SettingsPanel />
          ) : showHistory ? (
            <HistoryPanel />
          ) : (
            <ChatPanel context={context} onContextChange={onContextChange} />
          )}
        </div>
      </div>
    </Resizable>
  );
};
