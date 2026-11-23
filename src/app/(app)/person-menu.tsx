"use client";

import { ChevronsUpDown } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

/**
 * The rail's name tag: who's signed in, and under it, behind one click, the person's own
 * settings (language, currency) and the way out. Settings are used rarely, so they stay
 * out of sight; the panel opens upward from the tag, at the foot of the rail. A press
 * elsewhere or Escape closes it.
 */
export function PersonMenu({
  name,
  role,
  label,
  children,
}: {
  name: string;
  role: string;
  /** What the button does, for screen readers: "Your settings". */
  label: string;
  children: ReactNode;
}) {
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          className="absolute inset-x-0 bottom-full mb-1.5 origin-bottom rounded-control bg-label px-3 pt-1.5 pb-1.5 shadow-label print-in"
        >
          {children}
        </div>
      ) : null}
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((was) => !was)}
        className="press-quiet flex w-full items-center justify-between gap-2 rounded-control bg-label px-3 py-2.5 text-left hover:bg-label/80"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{name}</span>
          <span className="block text-sm text-ink-2">
            {role}
            <span className="sr-only">. {label}</span>
          </span>
        </span>
        <ChevronsUpDown aria-hidden size={18} strokeWidth={2.25} className="shrink-0 text-ink-2" />
      </button>
    </div>
  );
}
