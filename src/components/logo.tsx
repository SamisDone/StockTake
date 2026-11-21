import { MARK_PATHS, markGrid } from "@/lib/mark";

/**
 * The Stocktake mark (drawings and meaning in src/lib/mark.ts). It's drawn in
 * `currentColor` and its cuts show whatever is behind the label, so it reverse-prints by
 * changing the text color. Decorative: it always sits beside the name.
 */
export function Mark({ size, className }: { size: number; className?: string }) {
  const grid = markGrid(size);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${grid} ${grid}`}
      width={size}
      height={size}
      className={`shrink-0 ${className ?? ""}`}
    >
      <path fill="currentColor" fillRule="evenodd" d={MARK_PATHS[grid]} />
    </svg>
  );
}
