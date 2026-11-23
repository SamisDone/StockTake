"use client";

import { Check } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Toaster as Sonner, toast } from "sonner";
import type { Language } from "@/lib/i18n";
import { COMPONENT_COPY } from "./copy";
import { FaultText } from "./fault";
import { ProductLink } from "./product-link";

/** How long a toast stays: long enough to read it, and with Undo, to change your mind. */
const SHOWN_MS = 4000;
const UNDO_MS = 5000;
const FAULT_MS = 8000;

type Undo = () => Promise<{ ok: boolean; message: string }>;

export type NoticeInput = {
  /** The same id updates a toast in place instead of stacking another. */
  id?: string;
  message: string;
  language: Language;
  /** What went wrong rather than what was done. */
  fault?: boolean;
  /** Takes back what was just done; its answer replaces the toast. */
  undo?: Undo;
  /** The product the thing was done to: Open shows its label in the drawer. */
  productId?: number;
};

/**
 * Confirms something done, at the edge of the screen, so it stays readable after the
 * page it was done on has moved on. One with Undo stays five seconds, with a hairline
 * along its foot draining as the time runs out; pointing at the toasts holds them and
 * the line. Undo appends the reverse in the ledger, so nothing done is ever erased.
 */
export function notify(input: NoticeInput) {
  const id = input.id ?? crypto.randomUUID();
  const duration = input.fault ? FAULT_MS : input.undo ? UNDO_MS : SHOWN_MS;
  toast.custom(() => <Notice {...input} id={id} duration={duration} />, { id, duration });
  return id;
}

function Notice({
  id,
  message,
  language,
  fault,
  undo,
  productId,
  duration,
}: NoticeInput & { id: string; duration: number }) {
  const t = COMPONENT_COPY[language];
  const [undoing, setUndoing] = useState(false);

  const takeBack = async () => {
    if (!undo || undoing) return;
    setUndoing(true);
    try {
      const answer = await undo();
      notify({
        id,
        language,
        message: answer.message,
        fault: !answer.ok,
        productId: answer.ok ? productId : undefined,
      });
    } catch {
      setUndoing(false);
    }
  };

  return (
    <div className="sheet relative flex w-full items-start gap-3 overflow-hidden py-2 pr-2 pl-4 sm:w-[24rem]">
      {fault ? (
        <FaultText className="min-w-0 flex-1 py-2.5">{message}</FaultText>
      ) : (
        <p className="flex min-w-0 flex-1 items-start gap-1.5 py-2.5 text-sm font-medium">
          <Check aria-hidden size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" />
          <span className="min-w-0">{message}</span>
        </p>
      )}
      <div className="flex shrink-0 items-center">
        {productId !== undefined ? (
          // Opening the label is the end of the toast's job.
          <span onClickCapture={() => toast.dismiss(id)} className="contents">
            <ProductLink
              id={productId}
              className="press-quiet flex min-h-11 items-center rounded-control px-3 text-sm font-semibold hover:bg-liner"
            >
              {t.open}
            </ProductLink>
          </span>
        ) : null}
        {undo ? (
          <button
            type="button"
            onClick={takeBack}
            disabled={undoing}
            aria-busy={undoing}
            className="press-quiet grid min-h-11 rounded-control px-3 text-sm font-semibold enabled:hover:bg-liner disabled:text-ink-3"
          >
            {/* Both words hold the space, so the button keeps its width while it works. */}
            <span className={`col-start-1 row-start-1 self-center ${undoing ? "invisible" : ""}`}>{t.undo}</span>
            <span
              aria-hidden={!undoing}
              className={`col-start-1 row-start-1 self-center ${undoing ? "" : "invisible"}`}
            >
              {t.undoing}
            </span>
          </button>
        ) : null}
      </div>
      {undo && !undoing ? (
        <span
          aria-hidden
          className="toast-drain absolute inset-x-0 bottom-0 h-0.5 origin-left bg-ink"
          style={{ animationDuration: `${duration}ms` }}
        />
      ) : null}
    </div>
  );
}

/**
 * The modal dialog on top, if one is open. A modal <dialog> sits in the browser's top
 * layer and makes the rest of the page inert, so a toast rendered outside it is painted
 * beneath it and can't be clicked: recording stock in the product drawer would hide its
 * own Undo. While one is open, the toasts move inside it.
 */
function subscribeModals(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"], childList: true });
  return () => observer.disconnect();
}
const topModal = () => [...document.querySelectorAll<HTMLDialogElement>("dialog:modal")].at(-1) ?? null;

/** Where toasts appear: bottom right at a desk, along the foot of a phone above the Record button. */
export function Toaster({ language }: { language: Language }) {
  const modal = useSyncExternalStore(subscribeModals, topModal, () => null);
  const toaster = (
    <Sonner
      position="bottom-right"
      gap={8}
      offset={24}
      mobileOffset={{ bottom: 88, left: 12, right: 12 }}
      containerAriaLabel={COMPONENT_COPY[language].notifications}
      toastOptions={{ unstyled: true }}
    />
  );
  return modal ? createPortal(toaster, modal) : toaster;
}
