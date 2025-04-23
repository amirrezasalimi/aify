import {
  IconMessage,
  IconLanguage,
  IconFileDescription,
  IconBulb,
  IconPencil,
  IconWand,
  IconMoodSmile,
  IconTransform,
} from "@tabler/icons-react";

export const getActionIcon = (action: string) => {
  const actionLower = action.toLowerCase();
  if (actionLower.includes("translate")) return IconLanguage;
  if (actionLower.includes("summary")) return IconFileDescription;
  if (actionLower.includes("eli5")) return IconBulb;
  if (actionLower.includes("enhance")) return IconPencil;
  if (actionLower.includes("grammar")) return IconWand;
  if (actionLower.includes("professional")) return IconWand;
  if (actionLower.includes("friendly")) return IconMoodSmile;
  return IconTransform;
};
