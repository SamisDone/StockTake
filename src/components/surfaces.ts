import { type FindIndex, findIndex } from "@/server/find-actions";

/**
 * The two surfaces that open over any page: the record sheet and the command palette.
 * Buttons in the shell, the palette and the keyboard all open them through here, so
 * the surfaces don't need to know who asked. Client only.
 */
export type Surface = "record" | "palette";

const OPEN = "stocktake:open";

export function openSurface(surface: Surface) {
  window.dispatchEvent(new CustomEvent<Surface>(OPEN, { detail: surface }));
}

export function onOpenSurface(handler: (surface: Surface) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<Surface>).detail);
  window.addEventListener(OPEN, listener);
  return () => window.removeEventListener(OPEN, listener);
}

/** Whether a key press belongs to something being typed in, not to the page. */
export function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest("input, textarea, select, [contenteditable]") !== null;
}

/** Whether a modal (the product drawer, a sheet) already has the page. */
export function modalOpen() {
  return document.querySelector("dialog[open]:modal") !== null;
}

let cached: FindIndex | null = null;

/**
 * Everything searchable, read fresh on every opening (stock moves), with the last copy
 * kept so a reopened surface lists at once while the new one loads.
 */
export function loadIndex() {
  return findIndex().then((index) => (cached = index));
}

export function cachedIndex() {
  return cached;
}
