import { SETTINGS } from "@/constants";

export const getStyles = async () => {
  const content = await getStorageValue("", "");
  const items = (content?.split("\n") ?? []) as string[];

  const stylesMap: { [key: string]: string } = {};
  items.forEach((item) => {
    const [key, value] = item.split(":");
    if (key && value) {
      stylesMap[key.trim()] = value.trim();
    }
  });

  return stylesMap;
};
