/**
 * The axis top: the smallest clean step × a power of ten at or above `value`. Each step
 * halves to a clean middle tick too (1,500 → 750), and they're close enough that the
 * tallest mark fills most of the plot. A plain module, so server pages can use it too.
 */
export function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * power >= value)!;
  return step * power;
}
