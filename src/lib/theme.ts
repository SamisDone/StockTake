/**
 * Light or dark. The choice is the person's, kept in a cookie the browser reads for
 * itself (the server never needs it, so the landing and sign-in pages stay static);
 * "system" follows the device. A script in the document head resolves it to
 * `data-theme="light" | "dark"` on <html> before the first paint, so nothing flashes.
 */
export type ThemeChoice = "system" | "light" | "dark";
export const THEME_CHOICES: ThemeChoice[] = ["system", "light", "dark"];
export const THEME_COOKIE = "theme";

/** Runs in the head, before the body paints. Kept tiny and dependency-free. */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var c=m?m[1]:"system";var d=c==="dark"||(c==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

/** The theme a choice comes to on this device now. */
export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readThemeChoice(): ThemeChoice {
  const found = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)`));
  return (found?.[1] as ThemeChoice | undefined) ?? "system";
}

/** Saves the choice for a year (or forgets it, for "system") and applies it at once. */
export function applyThemeChoice(choice: ThemeChoice) {
  document.cookie =
    choice === "system"
      ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.dataset.theme = resolveTheme(choice);
}
