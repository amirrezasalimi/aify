import React from "react";
import { Button } from "@mantine/core";
import { IconMessage, IconSettings } from "@tabler/icons-react";
import { getActionIcon } from "../utils/action-icon";
import useLocalStorage from "@/hooks/use-localstorage";
import { SETTINGS } from "@/constants";

interface ActionMenuProps {
  actions: string[];
  onSelect: (action: string) => void;
  show: boolean;
  className?: string;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  actions,
  onSelect,
  show,
  className = "",
}) => {
  const [selectedLanguages] = useLocalStorage(SETTINGS.TRANSLATION_LANGUAGES, [
    "English",
  ]);
  const combinedActions = [
    ...selectedLanguages.map((lang) => `Translate to ${lang}`),
    ...actions,
  ];

  return (
    <div
      className={`absolute top-full left-0 mt-1 bg-white !border !border-gray-200 !border-solid rounded-md shadow-lg transform origin-top transition-all duration-150 ease-out min-w-[250px] ${
        show
          ? "opacity-100 scale-100"
          : "opacity-0 scale-95 pointer-events-none"
      } ${className}`}
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          onSelect("Chat");
        }}
        className="flex items-center gap-2 hover:bg-gray-100 px-4 py-2 rounded-t-md w-full text-gray-700 text-sm text-left"
      >
        <IconMessage size={16} />
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
            className="flex items-center gap-2 hover:bg-gray-100 px-4 py-2 w-full text-gray-700 text-sm text-left"
          >
            <Icon size={16} />
            <span>{action}</span>
          </button>
        );
      })}

      <div className="bg-gray-200 mx-2 h-px"></div>

      <button
        onClick={(e) => {
          e.preventDefault();
          onSelect("Settings");
        }}
        className="flex items-center gap-2 hover:bg-gray-100 px-4 py-2 rounded-b-md w-full text-gray-700 text-sm text-left"
      >
        <IconSettings size={16} />
        <span>Settings</span>
      </button>
    </div>
  );
};
