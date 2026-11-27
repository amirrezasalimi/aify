import { MantineProvider } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { ComponentProps } from "react";
import { SETTINGS } from "../constants";
import useLocalStorage from "../hooks/use-localstorage";

export type AifyTheme = "light" | "dark" | "auto";

export function AifyThemeProvider(props: Omit<ComponentProps<typeof MantineProvider>, "forceColorScheme">) {
  const [theme] = useLocalStorage<AifyTheme>(SETTINGS.THEME, "auto");
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)", false, { getInitialValueInEffect: false });
  return <MantineProvider {...props} forceColorScheme={theme === "auto" ? (systemDark ? "dark" : "light") : theme} />;
}
