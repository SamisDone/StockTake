"use client";

import { Maximize2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { EitherLanguage } from "@/components/either-language";
import type { Language } from "@/lib/i18n";

/**
 * A product opened over the page that linked to it: a second label laid on top of the
 * sheet, as a modal dialog so focus stays inside and Escape closes it. The drawer is a
 * route, so closing it is going back; the browser's back button closes it too. "Open as
 * a page" loads the same address in full, which prints the product as its own page.
 *
 * Its motion is CSS, not a view transition: the label is pulled out from the right edge
 * as it opens (`@starting-style`) and pushed back before the route changes, so an open
 * or close can be interrupted midway and the list beneath never moves.
 */
export function Drawer({
  closeLabel,
  pageLabel,
  children,
}: {
  closeLabel: Record<Language, string>;
  pageLabel: Record<Language, string>;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  // A slot keeps what it last showed when a link leads somewhere it doesn't match (a
  // supplier linked from the label), so the drawer is open only on a product's address.
  const here = /^\/products\/[^/]+$/.test(pathname);

  // Leaving the route doesn't unmount the drawer: Next.js keeps recent routes alive,
  // hidden in <Activity>, and a hidden modal would stay in the top layer and keep the
  // page inert. So this closes on the way out and reopens if the route comes back.
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node || !here) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    delete node.dataset.closing;
    if (!node.open) node.showModal();
    // Opening a dialog focuses its first control, Close. A form to fill in marks the
    // field that should have it instead.
    node.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      node.close();
      opener?.focus({ preventScroll: true });
    };
  }, [here]);

  /**
   * Push the label back to the edge, then go back once it's gone. The dialog closes the
   * moment the label is gone, not when the route changes: while it's open the page
   * under it is inert, and a click on the list or the rail would be lost meanwhile.
   */
  function close() {
    const node = dialog.current;
    if (!node || "closing" in node.dataset) return;
    node.dataset.closing = "";
    // Reading the animations applies the style change, so the transitions exist now.
    const leaving = panel.current?.getAnimations() ?? [];
    const leave = () => {
      node.close();
      router.back();
    };
    Promise.all(leaving.map((animation) => animation.finished)).then(leave, leave);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="product-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className="drawer fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:bg-transparent lg:p-3"
    >
      {/* The dimmed list. A click on it closes the drawer. */}
      <div aria-hidden onClick={close} className="drawer-scrim absolute inset-0 bg-ink/25" />
      <div
        ref={panel}
        className="drawer-panel sheet relative ml-auto h-full w-full max-w-176 overflow-hidden rounded-none lg:rounded-label"
      >
        {/* First in the dialog, so it takes focus on open; pinned, so it stays in reach
            however far the label scrolls, and there before the data arrives. */}
        {/* Close comes first, so it takes focus on open; the row is reversed so it sits
            at the edge, with "Open as a page" beside it. */}
        <div className="absolute top-3 right-2 z-10 flex flex-row-reverse items-center gap-1 sm:top-5 sm:right-5">
          <button
            type="button"
            onClick={close}
            className="flex min-h-11 items-center gap-1.5 rounded-control bg-label px-3 text-sm font-semibold text-ink-2 press-quiet hover:bg-liner hover:text-ink"
          >
            <X aria-hidden size={18} strokeWidth={2.25} />
            <EitherLanguage inline>{(language) => closeLabel[language]}</EitherLanguage>
          </button>
          {/* A plain link: loading the address in full prints the product as its own page. */}
          <a
            href={pathname}
            className="flex size-11 items-center justify-center rounded-control bg-label text-ink-2 press-quiet hover:bg-liner hover:text-ink"
          >
            <Maximize2 aria-hidden size={18} strokeWidth={2.25} />
            <span className="sr-only">
              <EitherLanguage inline>{(language) => pageLabel[language]}</EitherLanguage>
            </span>
          </a>
        </div>
        <div className="h-full overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </dialog>
  );
}

/** Holds the space in the label's header zone that the drawer's pinned Close button sits over. */
export function CloseSpace() {
  return <span aria-hidden className="w-36 shrink-0" />;
}
