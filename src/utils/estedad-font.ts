import fontUrl from "@fontsource-variable/estedad/files/estedad-arabic-wght-normal.woff2?inline";
import unicode from "@fontsource-variable/estedad/unicode.json";

export function registerEstedadFont() {
  // Register on the document so the font also works inside the in-page shadow root.
  const encoded = fontUrl.slice(fontUrl.indexOf(",") + 1);
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  document.fonts.add(new FontFace("Aify Estedad", bytes.buffer, {
    weight: "100 900",
    display: "swap",
    unicodeRange: unicode.arabic,
  }));
}
