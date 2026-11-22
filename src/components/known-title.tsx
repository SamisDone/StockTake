"use client";

import type { LinkProps } from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { IntentLink } from "./intent-link";
import { RECORD_HEADING, type RecordKind, TitleMorph } from "./title-morph";

/** What a list row showed of a record, kept so its label can print it before its data arrives. */
type Known = { title: string; number?: string; status?: { text: string; mark: string } };

const known = new Map<string, Known>();

/**
 * A list row's link that remembers the name it showed as it's followed. The record's
 * label loads behind a placeholder, and a placeholder of grey bars has nothing for the
 * row's name to morph into; with the name remembered, the placeholder prints the real
 * heading from the first frame, the morph has both ends, and only the rest of the label
 * waits on the server.
 */
export function RememberLink<Route>({
  remember,
  onNavigate,
  ...props
}: LinkProps<Route> & { remember: { kind: RecordKind; id: number } & Known }) {
  return (
    <IntentLink
      {...props}
      onNavigate={(event) => {
        const { kind, id, ...shown } = remember;
        known.set(`${kind}-${id}`, shown);
        onNavigate?.(event);
      }}
    />
  );
}

/**
 * The heading of a record's label placeholder: what its row showed, if the record was
 * opened from one, set exactly as the label sets it; otherwise the bars. The record is
 * the one in the URL, so a name remembered for another record never prints here.
 */
export function KnownHeading({
  kind,
  titleBar,
  detailBar,
}: {
  kind: RecordKind;
  titleBar: ReactNode;
  detailBar: ReactNode;
}) {
  const { id } = useParams<{ id: string }>();
  const shown = known.get(`${kind}-${id}`);
  if (!shown) {
    return (
      <>
        {titleBar}
        {detailBar}
      </>
    );
  }
  return (
    <>
      <p className={RECORD_HEADING}>
        <TitleMorph kind={kind} id={id}>
          <span className="inline-block">{shown.title}</span>
        </TitleMorph>
      </p>
      {shown.number ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
          <TitleMorph kind={kind} id={id} part="number">
            <span className="inline-block font-mono text-xs">{shown.number}</span>
          </TitleMorph>
          {shown.status ? <span className={shown.status.mark}>{shown.status.text}</span> : null}
        </p>
      ) : (
        detailBar
      )}
    </>
  );
}
