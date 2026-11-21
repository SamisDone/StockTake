/**
 * The Stocktake mark's drawings: a thermal label with a small stocktake cut through it.
 * Four units stand on a shelf, one is received, two are sold (hollow: they've gone) and
 * three are left, so the mark reads as a running total that adds up, like the ledger.
 *
 * Each drawing is one even-odd path on its own pixel grid, so at its own size every edge
 * lands on a whole pixel; 16 px merges the units into solid steps. `Mark` in
 * src/components/logo.tsx draws them on the page; scripts/icons.mts makes the favicons.
 */

/** A rounded rectangle as a path, for the label itself. */
const label = (x: number, y: number, size: number, r: number) =>
  `M${x + r} ${y}H${x + size - r}A${r} ${r} 0 0 1 ${x + size} ${y + r}V${y + size - r}` +
  `A${r} ${r} 0 0 1 ${x + size - r} ${y + size}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + size - r}` +
  `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

/** A rectangle as a path: inside the label it's a cut; inside a cut it's ink again. */
const box = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}Z`;

export type MarkGrid = 16 | 32 | 64;

export const MARK_PATHS: Record<MarkGrid, string> = {
  64: [
    label(4, 4, 56, 10),
    box(8, 51, 48, 3),
    ...[43, 35, 27, 19].map((y) => box(10, y, 8, 6)),
    box(22, 11, 8, 6),
    ...[11, 19].flatMap((y) => [box(34, y, 8, 6), box(36, y + 2, 4, 2)]),
    ...[43, 35, 27].map((y) => box(46, y, 8, 6)),
  ].join(""),
  32: [
    label(1, 1, 30, 5),
    box(4, 25, 24, 2),
    ...[21, 17, 13, 9].map((y) => box(5, y, 4, 3)),
    box(11, 5, 4, 3),
    ...[5, 9].flatMap((y) => [box(17, y, 4, 3), box(18, y + 1, 2, 1)]),
    ...[21, 17, 13].map((y) => box(23, y, 4, 3)),
  ].join(""),
  16: [label(0, 0, 16, 3), box(2, 13, 12, 1), box(3, 4, 2, 8), box(6, 2, 2, 2), box(9, 2, 2, 4), box(12, 6, 2, 6)].join(
    "",
  ),
};

/** The drawing made for a size: the 16 px one up to 20, the 32 px one up to 40, then 64. */
export const markGrid = (size: number): MarkGrid => (size <= 20 ? 16 : size <= 40 ? 32 : 64);
