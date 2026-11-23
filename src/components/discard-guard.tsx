"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Language } from "@/lib/i18n";
import { COMPONENT_COPY } from "./copy";

/** A form's fields as one string, to tell whether anything was changed since it opened. */
const snapshot = (form: HTMLFormElement) =>
  new URLSearchParams(
    [...new FormData(form)].map(([key, value]) => [key, typeof value === "string" ? value : value.name]),
  ).toString();

/**
 * Keeps a form's unsaved changes from being thrown away by accident. The form is read
 * when it opens; if it has changed since, Cancel (and Escape), a link out of the page and
 * closing or reloading the tab all ask first. Unchanged, they just go.
 *
 * `ask(then)` runs `then` at once when nothing changed, otherwise after "Discard". Render
 * `dialog` anywhere in the form's tree.
 */
export function useDiscardGuard(form: RefObject<HTMLFormElement | null>, language: Language) {
  const t = COMPONENT_COPY[language].discard;
  const router = useRouter();
  const opened = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);

  const changed = () => form.current !== null && opened.current !== null && snapshot(form.current) !== opened.current;

  // Read the form once it's on the page with its starting values.
  useEffect(() => {
    if (form.current) opened.current = snapshot(form.current);
  }, [form]);

  // Leaving the tab: the browser asks, in its own words.
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (changed()) event.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  });

  // A link out of the page: held until the person says to go. Capturing on the document
  // runs before Next's own link handling. Inactive while the page is kept alive hidden,
  // since React drops a hidden page's effects.
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.origin !== location.origin || !changed()) return;
      if (link.pathname === location.pathname && link.hash) return;
      event.preventDefault();
      event.stopPropagation();
      const href = `${link.pathname}${link.search}${link.hash}` as Route;
      setPending(() => () => router.push(href));
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  });

  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (pending && !node.open) node.showModal();
    if (!pending && node.open) node.close();
  }, [pending]);

  const ask = (then: () => void) => {
    if (pending) return;
    if (changed()) setPending(() => then);
    else then();
  };

  const discard = () => {
    const then = pending;
    opened.current = null;
    setPending(null);
    then?.();
  };

  const element: ReactNode = (
    <dialog
      ref={dialog}
      aria-labelledby="discard-title"
      aria-describedby="discard-body"
      onClose={() => setPending(null)}
      onKeyDown={(event) => {
        // Escape here means "keep editing", never "stop editing" to the form around it.
        if (event.key === "Escape") event.stopPropagation();
      }}
      className="sheet m-auto w-[min(26rem,calc(100vw-2rem))] p-0 text-ink backdrop:bg-ink/25"
    >
      {pending ? (
        <div className="px-5 pt-5 pb-4">
          <h2 id="discard-title" className="text-lg font-bold">
            {t.title}
          </h2>
          <p id="discard-body" className="mt-1 text-ink-2">
            {t.body}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => setPending(null)}
              className="press-quiet min-h-11 rounded-control px-4 font-semibold text-ink-2 hover:bg-liner hover:text-ink"
            >
              {t.keep}
            </button>
            <button
              type="button"
              onClick={discard}
              className="group min-h-11 rounded-control bg-ink px-4 font-semibold text-label transition-colors duration-150 hover:bg-ink-lift"
            >
              <span className="inline-block transition-transform duration-150 ease-out group-active:scale-[0.96]">
                {t.discard}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );

  return { ask, dialog: element };
}
