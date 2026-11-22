"use client";

import { type ComponentProps, useState } from "react";

/**
 * A password field with Show beside it, for checking what was typed on a phone keyboard
 * before sending it. Show is a toggle (pressed while the text shows); it keeps its width
 * when it turns to Hide, so the field never shifts.
 */
export function PasswordInput({
  show,
  hide,
  label = show,
  className = "",
  ...input
}: Omit<ComponentProps<"input">, "type"> & {
  show: string;
  hide: string;
  /** The toggle's name, when "Show" alone would be vague ("Show new password"). */
  label?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input {...input} type={shown ? "text" : "password"} className={`min-w-0 flex-1 ${className}`} />
      <button
        type="button"
        // A toggle keeps one name; pressed says the text is showing.
        aria-label={label}
        aria-pressed={shown}
        aria-controls={input.id}
        onClick={() => setShown((now) => !now)}
        className="press-quiet -mr-2 mb-1.5 grid min-h-11 shrink-0 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-liner hover:text-ink"
      >
        <span aria-hidden className={`col-start-1 row-start-1 self-center ${shown ? "invisible" : ""}`}>
          {show}
        </span>
        <span aria-hidden className={`col-start-1 row-start-1 self-center ${shown ? "" : "invisible"}`}>
          {hide}
        </span>
      </button>
    </div>
  );
}
