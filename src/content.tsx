import React, { useEffect, useState, useRef } from "react";
import browser from "webextension-polyfill";
import { usePopper } from "react-popper";
import { createRoot } from "react-dom/client";
import { getStyles } from "./utils/styles";
import { Shell, Copy, Check } from "lucide-react";
import { getStorageValue, setStorageValue } from "./hooks/useLocalStorage";
import { SETTINGS } from "./constants";
import "./content.css";

interface TextTransformerProps {
  onClose: () => void;
  selectedText: string;
  referenceElement: HTMLElement | null;
}

let sliderLabels: string[] = [];
getStyles().then((styles) => {
  sliderLabels = [...Object.keys(styles), "Original"];
});

const Popover: React.FC<TextTransformerProps> = ({
  onClose,
  selectedText,
  referenceElement,
}) => {
  const [sliderValue, setSliderValue] = useState(sliderLabels.length - 1);
  const [transformedText, setTransformedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRTL, setIsRTL] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const popperRef = useRef<HTMLDivElement>(null);

  const { styles, attributes } = usePopper(
    referenceElement,
    popperRef.current,
    {
      strategy: "absolute",
      modifiers: [
        { name: "offset", options: { offset: [0, 10] } },
        { name: "flip", options: { fallbackPlacements: ["top", "bottom"] } },
        { name: "preventOverflow", options: { padding: 8 } },
      ],
    }
  );

  // Function to detect if text is RTL
  const isTextRTL = (text: string) => {
    const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
    return rtlRegex.test(text);
  };

  // Handle initial style processing and RTL detection
  useEffect(() => {
    const initDefaultStyle = async () => {
      const defaultStyle = await getStorageValue(SETTINGS.DEFAULT_STYLE, "");
      const defaultIndex = sliderLabels.indexOf(defaultStyle);

      if (defaultIndex !== -1 && defaultIndex !== sliderLabels.length - 1) {
        setSliderValue(defaultIndex);
        setIsLoading(true);
        const response = await browser.runtime.sendMessage({
          originalSelectedText: selectedText,
          text: selectedText,
          summaryLengthName: sliderLabels[defaultIndex],
        });
        setTransformedText(response);
        setIsRTL(isTextRTL(response));
        setIsLoading(false);
      } else {
        setTransformedText(selectedText);
        setIsRTL(isTextRTL(selectedText));
      }
    };
    initDefaultStyle();
  }, [selectedText]);

  const handleSliderChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = parseInt(event.target.value);
    setSliderValue(newValue);
    const summaryLengthName = sliderLabels[newValue];

    await setStorageValue(SETTINGS.DEFAULT_STYLE, summaryLengthName);

    if (newValue === sliderLabels.length - 1) {
      setTransformedText(selectedText);
      setIsRTL(isTextRTL(selectedText));
      return;
    }

    setIsLoading(true);
    const response = await browser.runtime.sendMessage({
      originalSelectedText: selectedText,
      text: selectedText,
      summaryLengthName,
    });
    setTransformedText(response);
    setIsRTL(isTextRTL(response));
    setIsLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(transformedText);
    setShowCheck(true);
    // Show check for 1 second then revert to copy icon
    setTimeout(() => {
      setShowCheck(false);
    }, 1000);
  };

  return (
    <div
      ref={popperRef}
      className="z-[999999] bg-[#111113] bg-opacity-95 shadow-lg backdrop-blur px-4 py-4 border border-[#3d3d42] rounded-xl w-[400px] font-inter text-white text-sm transition-opacity duration-300 popover"
      style={styles.popper}
      {...attributes.popper}
    >
      <button
        className="top-2 right-2 absolute bg-transparent hover:bg-white/10 p-1 border-none rounded-full w-6 h-6 text-white/60 hover:text-white text-xl transition-all ease-in-out cursor-pointer"
        onClick={onClose}
      >
        ×
      </button>
      <div className="flex flex-col gap-4 px-6">
        <div className="font-semibold text-white">Style</div>

        {/* Slider Container */}
        <div className="relative">
          <input
            type="range"
            min="0"
            max={sliderLabels.length - 1}
            value={sliderValue}
            step="1"
            className="bg-gray-700 [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:hover:bg-teal-400 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:-mt-1 rounded-lg [&::-webkit-slider-thumb]:rounded-full focus:outline-none w-full [&::-webkit-slider-thumb]:w-4 h-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:transition-colors appearance-none [&::-webkit-slider-thumb]:appearance-none cursor-pointer"
            onChange={handleSliderChange}
          />

          {/* Labels Container */}
          <div className="relative mt-2 text-white/80 text-xs pointer-events-none">
            {sliderLabels.map((label, index) => {
              const totalSteps = sliderLabels.length - 1;
              const positionPercentage = (index / totalSteps) * 100;
              return (
                <span
                  key={label}
                  className={`absolute text-center transition-colors ${
                    index === sliderValue ? "text-teal-400 font-medium" : ""
                  }`}
                  style={{
                    left: `${positionPercentage}%`,
                    transform: "translateX(-50%)",
                    width: "max-content",
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-center items-center mt-4 max-h-[400px] overflow-y-auto text-white">
          {isLoading ? (
            <Shell className="animate-spin" />
          ) : (
            <span
              className={`font-semibold ${
                isRTL ? "text-right direction-rtl" : "text-left"
              }`}
              dir={isRTL ? "rtl" : "ltr"}
            >
              {transformedText}
            </span>
          )}
          {!isLoading && transformedText && (
            <button
              className="bg-teal-500 hover:bg-teal-600 mt-2 p-1 rounded-full text-white transition-colors"
              onClick={handleCopy}
              title={showCheck ? "Copied!" : "Copy to clipboard"}
            >
              {showCheck ? <Check size={16} /> : <Copy size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const TextTransformerApp: React.FC = () => {
  const [selection, setSelection] = useState<{
    text: string;
    referenceElement: HTMLElement | null;
  } | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseUp = async (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        popoverRef.current?.contains(event.target)
      ) {
        return;
      }

      const isEnabled = await getStorageValue(SETTINGS.ENABLED, true);
      if (!isEnabled) return;

      const minWords = await getStorageValue(SETTINGS.MIN_WORDS, 5);
      const selectedText = window.getSelection()?.toString() || "";
      const wordCount = selectedText.trim().split(/\s+/).length;

      if (wordCount >= minWords) {
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        const virtualEl = document.createElement("span");
        document.body.appendChild(virtualEl);
        virtualEl.style.position = "absolute";
        virtualEl.style.left = `${rect.left + rect.width / 2}px`;
        virtualEl.style.top = `${rect.bottom + window.scrollY}px`;
        virtualEl.style.width = "1px";
        virtualEl.style.height = "1px";

        setSelection({
          text: selectedText,
          referenceElement: virtualEl,
        });
        setIsVisible(true);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        selection &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selection]);

  const handleClose = () => {
    if (selection?.referenceElement) {
      selection.referenceElement.remove();
    }
    setSelection(null);
    setIsVisible(true);
    removeHighlight();
  };

  return (
    <>
      {selection && (
        <div
          ref={popoverRef}
          className={`transition-opacity duration-300 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {isVisible && (
            <Popover
              selectedText={selection.text}
              referenceElement={selection.referenceElement}
              onClose={handleClose}
            />
          )}
        </div>
      )}
    </>
  );
};

const removeHighlight = () => {
  const activeWrappers = document.querySelectorAll(
    ".shorter-ext-text-wrapper-active"
  );
  activeWrappers.forEach((wrapper) => {
    wrapper.classList.remove("shorter-ext-text-wrapper-active");
  });
};

const init = () => {
  const root = document.createElement("div");
  root.id = "text-transformer-root";
  document.body.appendChild(root);

  const reactRoot = createRoot(root);
  reactRoot.render(<TextTransformerApp />);
};

init();

export default TextTransformerApp;
