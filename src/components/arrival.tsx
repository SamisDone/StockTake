"use client";

import { createContext, use, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { duration, easing, reducedMotion } from "@/lib/motion";

/** Whether the scope around an arriving line has printed its first lines yet. */
const Settled = createContext<{ current: boolean } | null>(null);

/**
 * Where lines can arrive: a ledger, an order's history. What prints with the scope is
 * already on the label; a line that mounts inside it later was just written (a movement
 * recorded, an order placed) and prints in. Renders no element of its own.
 */
export function ArrivalScope({ children }: { children: ReactNode }) {
  const settled = useRef(false);
  // Effects run children first, so every line printed with the scope sees `false`.
  useEffect(() => {
    settled.current = true;
  }, []);
  return <Settled value={settled}>{children}</Settled>;
}

/**
 * A line in an arrival scope: printed plainly with the scope, printed in (`print-in`,
 * or `print-row` for a table row) when it arrives later, while the lines below it slide
 * down to make room instead of dropping a line's height in one frame. The class comes
 * off when the animation ends, so a page kept alive while hidden doesn't print it again
 * on return.
 */
export function Arrival({
  as,
  className,
  children,
}: {
  as: "li" | "tr" | "div";
  className?: string;
  children: ReactNode;
}) {
  const settled = use(Settled);
  const element = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const line = element.current;
    if (!line || !settled?.current) return;
    const print = as === "tr" ? "print-row" : "print-in";
    const done = () => line.classList.remove(print);
    line.classList.add(print);
    line.addEventListener("animationend", done, { once: true });
    if (!reducedMotion()) {
      const room = line.getBoundingClientRect().height;
      const timing = { duration: duration("--dur-print", 260), easing: easing("--ease-out") };
      for (let below = line.nextElementSibling; below; below = below.nextElementSibling) {
        below.animate([{ translate: `0 ${-room}px` }, { translate: "0 0" }], timing);
      }
    }
    return () => line.removeEventListener("animationend", done);
  }, [as, settled]);

  const Line = as;
  return (
    <Line ref={element as never} className={className}>
      {children}
    </Line>
  );
}
