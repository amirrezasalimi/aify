import React, { useEffect, useState } from "react";
import browser from "webextension-polyfill";
import ReactDOM from "react-dom/client";
import "../tailwind@4";

interface TextTransformerProps {
  onClose: () => void;
  selectedText: string;
  position: { x: number; y: number };
}

const sliderLabels = ["Summarize", "Translate: Persian", "Eli5", "Original"];

const Popover: React.FC<TextTransformerProps> = ({
  onClose,
  selectedText,
  position,
}) => {
  const [sliderValue, setSliderValue] = useState(sliderLabels.length - 1);

  const handleSliderChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = parseInt(event.target.value);
    setSliderValue(newValue);
    const summaryLengthName = sliderLabels[newValue];

    const response = await browser.runtime.sendMessage({
      originalSelectedText: selectedText,
      text: selectedText,
      summaryLengthName,
    });

    const selection = window.getSelection();
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const normalizedResponse = response.replaceAll("\n", "<br/>");
      const fragment = range.createContextualFragment(normalizedResponse);
      range.insertNode(fragment);
    }
  };

  return (
    <div
      className="bottom-2 left-1/2 z-[999999] fixed bg-black bg-opacity-95 shadow-lg backdrop-blur px-4 py-4 border border-white/10 rounded-xl w-[400px] font-inter text-white text-sm transition-all -translate-x-1/2 transform visible"
      style={{}}
    >
      <button
        className="top-2 right-2 absolute bg-transparent hover:bg-white/10 p-1 border-none rounded-full w-6 h-6 text-white/60 hover:text-white text-xl transition-all ease-in-out cursor-pointer"
        onClick={onClose}
      >
        ×
      </button>
      <div className="flex flex-col gap-3 px-4">
        <div className="mb-1 font-semibold text-white">Style</div>
        <input
          type="range"
          min="0"
          max={sliderLabels.length - 1}
          value={sliderValue}
          className="bg-gradient-to-r from-indigo-600 to-indigo-200 rounded-md w-full h-1 appearance-none cursor-pointer"
          onChange={handleSliderChange}
        />
        <div className="relative flex justify-between pt-1 h-5 text-white/60 text-xs">
          {sliderLabels.map((label, index) => (
            <span
              key={label}
              className="left-1/2 absolute whitespace-nowrap -translate-x-1/2 transform"
              style={{ left: `${(index / (sliderLabels.length - 1)) * 100}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const TextTransformerApp: React.FC = () => {
  const [selection, setSelection] = useState<{
    text: string;
    position: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    const handleMouseUp = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".shorter-ext-popover")
      ) {
        return;
      }

      const selectedText = window.getSelection()?.toString() || "";
      const wordCount = selectedText.trim().split(/\s+/).length;

      if (wordCount > 5) {
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setSelection({
          text: selectedText,
          position: {
            x: rect.left + rect.width / 2,
            y: rect.bottom,
          },
        });

        // Highlight selected text
        const wrapper = document.createElement("span");
        wrapper.className =
          "shorter-ext-text-wrapper shorter-ext-text-wrapper-active";
        range.surroundContents(wrapper);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelection(null);
        removeHighlight();
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleClose = () => {
    setSelection(null);
    removeHighlight();
  };

  return (
    <>
      {selection && (
        <Popover
          selectedText={selection.text}
          position={selection.position}
          onClose={handleClose}
        />
      )}
    </>
  );
};

// Helper function to remove highlights
const removeHighlight = () => {
  const activeWrappers = document.querySelectorAll(
    ".shorter-ext-text-wrapper-active"
  );
  activeWrappers.forEach((wrapper) => {
    wrapper.classList.remove("shorter-ext-text-wrapper-active");
  });
};

// Initialize the app
const init = () => {
  // Inject Tailwind CSS with JIT support from CDN
  const tailwindCdn = document.createElement("script") as HTMLScriptElement;
  document.head.appendChild(tailwindCdn);

  // Create root div for React
  const root = document.createElement("div");
  root.id = "text-transformer-root";
  document.body.appendChild(root);

  // Initialize React
  const reactRoot = ReactDOM.createRoot(root);
  reactRoot.render(<TextTransformerApp />);
};

init();

export default TextTransformerApp;
