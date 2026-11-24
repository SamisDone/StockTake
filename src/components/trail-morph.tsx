import { ViewTransition, type ReactNode } from "react";

/**
 * The dashboard's stock figure and its small line, which grow into the analytics stock
 * chart's readout and plot when the figure is opened: the figure shows where it went.
 * Both ends carry the same names; `default="none"` keeps them still in every other
 * transition. The plot pair is a "grow": its snapshots stretch to the box, so the line
 * keeps its shape on the way (see globals.css).
 */
export function TrailMorph({ part, children }: { part: "value" | "plot"; children: ReactNode }) {
  return (
    <ViewTransition name={`stock-trail-${part}`} share={part === "plot" ? "grow" : "morph"} default="none">
      {children}
    </ViewTransition>
  );
}
