import type { ReactNode } from "react";

/** A zone of the report: its heading, a line on how to read it, then its content. */
export function Zone({
  id,
  title,
  note,
  className = "border-b-2 border-ink",
  children,
}: {
  id: string;
  title: string;
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={`pt-6 pb-8 ${className}`}>
      <div className="px-5 sm:px-8">
        <h2 id={`${id}-title`} className="text-lg font-bold">
          {title}
        </h2>
        {note ? <p className="mt-1 max-w-prose text-sm text-ink-2">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A key for a chart's marks: each swatch beside the name it stands for. */
export function Key({ items }: { items: { swatch: ReactNode; name: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
      {items.map(({ swatch, name }) => (
        <li key={name} className="flex items-center gap-2">
          <span aria-hidden className="flex w-3.5 shrink-0 justify-center">
            {swatch}
          </span>
          {name}
        </li>
      ))}
    </ul>
  );
}
