"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * A product opened over the list: a second label laid on top of the sheet, as a modal
 * dialog so focus stays inside and Escape closes it. The drawer is a route, so closing
 * it is going back; the browser's back button closes it too.
 *
 * Its motion is CSS, not a view transition: the label is pulled out from the right edge
 * as it opens (`@starting-style`) and pushed back before the route changes, so an open
 * or close can be interrupted midway and the list beneath never moves.
 */
export function Drawer({ closeLabel, children }: { closeLabel: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Leaving the route doesn't unmount the drawer: Next.js keeps recent routes alive,
  // hidden in <Activity>, and a hidden modal would stay in the top layer and keep the
  // page inert. So this closes on the way out and reopens if the route comes back.
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
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
  }, []);

  /** Push the label back to the edge, then go back once it's gone. */
  function close() {
    const node = dialog.current;
    if (!node || "closing" in node.dataset) return;
    node.dataset.closing = "";
    // Reading the animations applies the style change, so the transitions exist now.
    const leaving = panel.current?.getAnimations() ?? [];
    Promise.all(leaving.map((animation) => animation.finished)).then(
      () => router.back(),
      () => router.back(),
    );
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
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-2 z-10 flex min-h-11 items-center gap-1.5 rounded-control bg-label px-3 text-sm font-semibold text-ink-2 press-quiet hover:bg-liner hover:text-ink sm:top-5 sm:right-5"
        >
          <X aria-hidden size={18} strokeWidth={2.25} />
          {closeLabel}
        </button>
        <div className="h-full overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </dialog>
  );
}

/** Holds the space in the label's header zone that the drawer's pinned Close button sits over. */
export function CloseSpace() {
  return <span aria-hidden className="w-20 shrink-0" />;
}
