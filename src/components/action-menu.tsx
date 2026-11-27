import React from "react";
import { IconMessage, IconSettings } from "@tabler/icons-react";
import { getActionIcon } from "../utils/action-icon";
import useLocalStorage from "@/hooks/use-localstorage";
import { SETTINGS } from "@/constants";
import { useAnchoredPopover } from "../hooks/use-anchored-popover";

interface ActionMenuProps {
  actions: string[];
  onSelect: (action: string) => void;
  show: boolean;
  anchor: HTMLElement | null;
}

const rowClass = "flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm text-gray-700 hover:bg-gray-100";

export const ActionMenu: React.FC<ActionMenuProps> = ({
  actions,
  onSelect,
  show,
  anchor,
}) => {
  const [selectedLanguages] = useLocalStorage(SETTINGS.TRANSLATION_LANGUAGES, [
    "English",
  ]);
  const [menu, setMenu] = React.useState<HTMLDivElement | null>(null);
  const style = useAnchoredPopover(show ? anchor : null, menu, "bottom-start", 4, true);
  // An opacity-hidden menu still participates in text selection and copying.
  if (!show) return null;

  const combinedActions = [
    ...selectedLanguages.map((lang) => `Translate to ${lang}`),
    ...actions,
  ];

  return (
    <div
      ref={setMenu}
      style={style}
      className="z-10 w-[230px] select-none overflow-y-auto overscroll-contain rounded-md !border !border-solid !border-gray-200 bg-aify-surface shadow-lg"
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          onSelect("Chat");
        }}
        className={`${rowClass} rounded-t-md`}
      >
        <IconMessage size={16} className="shrink-0" />
        <span>Chat</span>
      </button>

      <div className="bg-gray-200 mx-2 h-px"></div>

      {combinedActions.map((action) => {
        const Icon = getActionIcon(action);
        return (
          <button
            key={action}
            onClick={(e) => {
              e.preventDefault();
              onSelect(action);
            }}
            className={rowClass}
          >
            <Icon size={16} className="shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{action}</span>
          </button>
        );
      })}

      <div className="bg-gray-200 mx-2 h-px"></div>

      <button
        onClick={(e) => {
          e.preventDefault();
          onSelect("Settings");
        }}
        className={`${rowClass} rounded-b-md`}
      >
        <IconSettings size={16} className="shrink-0" />
        <span>Settings</span>
      </button>
    </div>
  );
};
