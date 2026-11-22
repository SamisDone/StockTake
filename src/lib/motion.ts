/**
 * The motion tokens from globals.css, for motion that has to run in script (a figure
 * counting over, a line closing), so it times and eases like everything CSS moves.
 * Browser only: call these from effects and event handlers.
 */

/** A CSS time in milliseconds: the built stylesheet minifies "150ms" to ".15s". */
export function milliseconds(time: string) {
  const value = parseFloat(time);
  return time.trim().endsWith("ms") ? value : value * 1000;
}

/** Whether the reader asked for less motion. */
export function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A duration token (`--dur-fade`) in milliseconds, or `fallback` if the stylesheet hasn't got it. */
export function duration(token: `--dur-${string}`, fallback: number) {
  return milliseconds(getComputedStyle(document.documentElement).getPropertyValue(token)) || fallback;
}

/** An easing token (`--ease-out`) as CSS gives it, for the Web Animations API. */
export function easing(token: `--ease-${string}`) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "ease-out";
}

/**
 * An easing token as a function of progress (0 to 1), for motion stepped frame by frame.
 * It solves the token's cubic-bezier the way the browser does; a keyword falls back to
 * the linear curve, which no token uses.
 */
export function easingCurve(token: `--ease-${string}`): (t: number) => number {
  const match = /cubic-bezier\(([^)]+)\)/.exec(easing(token));
  const points = match?.[1].split(",").map(Number);
  if (!points || points.length !== 4 || points.some(Number.isNaN)) return (t) => t;
  return cubicBezier(points[0], points[1], points[2], points[3]);
}

/** CSS's cubic-bezier(x1, y1, x2, y2): y for a given x, x found by Newton's method, then bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const coordinate = (t: number, p1: number, p2: number) =>
    3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
  const slope = (t: number, p1: number, p2: number) =>
    3 * (1 - t) * (1 - t) * p1 + 6 * (1 - t) * t * (p2 - p1) + 3 * t * t * (1 - p2);

  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = coordinate(t, x1, x2) - x;
      if (Math.abs(error) < 1e-6) return t;
      const d = slope(t, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      t -= error / d;
    }
    let low = 0;
    let high = 1;
    t = x;
    while (high - low > 1e-6) {
      if (coordinate(t, x1, x2) < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return t;
  };

  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : coordinate(solve(x), y1, y2));
}
