import { ViewTransition, type ReactNode } from "react";

/** The records whose list row grows into their label's heading when opened. */
export type RecordKind = "order" | "supplier";

/** A record label's heading type, shared by the label and its placeholder so the two line up exactly. */
export const RECORD_HEADING = "print-display text-4xl text-balance sm:text-5xl";

/**
 * One part of a record's name that is the same thing in its list row and on its label
 * (the supplier's name, an order's number), so opening the row morphs that text into
 * the heading: it shows exactly which row was opened. Only on the way in: going back
 * reprints the list (its rows load again), and the browser's back restores it at once.
 *
 * The child must be one element sized to its text (an inline-block span): the morph
 * scales a snapshot of that box, and a full-width block would squash the text into the
 * other end's width. `default="none"` keeps it still in every unrelated transition.
 */
export function TitleMorph({
  kind,
  id,
  part = "title",
  children,
}: {
  kind: RecordKind;
  id: number | string;
  part?: "title" | "number";
  children: ReactNode;
}) {
  return (
    <ViewTransition name={`${kind}-${id}-${part}`} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
