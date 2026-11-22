"use client";

import { CircleAlert } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";

/**
 * What went wrong, printed in fault red beside a small alert mark. Text only, never a
 * fill: the field or band it belongs to stays white label stock, so an error never reads
 * as the yellow "needs attention" of Reorder and Late.
 */
export function FaultText({
  children,
  className = "",
  ...props
}: { children: ReactNode; className?: string } & Omit<ComponentProps<"p">, "children" | "className">) {
  return (
    <p {...props} className={`flex items-start gap-1.5 text-sm font-medium text-fault ${className}`}>
      <CircleAlert aria-hidden size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * A fault line that opens by height when its message arrives and closes when it clears,
 * keeping the last message while it closes so the text doesn't vanish before the space
 * does. It's announced as an alert while open, and hidden from assistive tech on its way
 * out. Present from the first render with a message, it shows at once: no entrance.
 */
export function FaultLine({
  id,
  message,
  hold = true,
  className = "",
}: {
  id?: string;
  message?: string;
  /** Keep the last message while closing; off where something else takes the line at once
   *  (a status line, where "Saving…" replaces the refusal on the next submit). */
  hold?: boolean;
  /** Spacing for the line itself (padding goes inside, so the closed line is truly 0 tall). */
  className?: string;
}) {
  const [last, setLast] = useState(message);
  if (message && message !== last) setLast(message);
  const open = Boolean(message);

  return (
    <div className="fault-reveal" data-open={open || undefined}>
      <div className="min-h-0 overflow-hidden">
        {open ? (
          <FaultText key="open" id={id} role="alert" className={className}>
            {message}
          </FaultText>
        ) : hold && last ? (
          <FaultText key="closing" aria-hidden className={className}>
            {last}
          </FaultText>
        ) : null}
      </div>
    </div>
  );
}
