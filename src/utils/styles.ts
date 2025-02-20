import { SETTINGS } from "../constants";
import { getStorageValue } from "../hooks/useLocalStorage";

export const getStyles = async () => {
  const content = await getStorageValue(SETTINGS.STYLE, "");
  const items = content.split("\n");

  const stylesMap: { [key: string]: string } = {};
  items.forEach((item) => {
    const [key, value] = item.split(":");
    if (key && value) {
      stylesMap[key.trim()] = value.trim();
    }
  });

  return stylesMap;
};
