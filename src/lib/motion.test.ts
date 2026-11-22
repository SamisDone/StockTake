import { describe, expect, it } from "vitest";
import { cubicBezier, milliseconds } from "./motion";

describe("cubicBezier", () => {
  it("starts at 0 and ends at 1", () => {
    const ease = cubicBezier(0.23, 1, 0.32, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-0.5)).toBe(0);
    expect(ease(2)).toBe(1);
  });

  it("is the identity for the linear curve", () => {
    const linear = cubicBezier(0, 0, 1, 1);
    for (const x of [0.1, 0.25, 0.5, 0.9]) expect(linear(x)).toBeCloseTo(x, 5);
  });

  it("matches CSS's ease-out where the browser puts it", () => {
    // CSS ease-out is cubic-bezier(0, 0, 0.58, 1); at x = 0.5 the browser gives about 0.684.
    expect(cubicBezier(0, 0, 0.58, 1)(0.5)).toBeCloseTo(0.684, 2);
  });

  it("front-loads the app's strong ease-out and never runs past the end", () => {
    const ease = cubicBezier(0.23, 1, 0.32, 1);
    expect(ease(0.25)).toBeGreaterThan(0.7);
    let last = 0;
    for (let x = 0; x <= 1; x += 0.01) {
      const y = ease(x);
      expect(y).toBeGreaterThanOrEqual(last - 1e-9);
      expect(y).toBeLessThanOrEqual(1 + 1e-9);
      last = y;
    }
  });
});

describe("milliseconds", () => {
  it("reads both units the stylesheet may serve", () => {
    expect(milliseconds("150ms")).toBe(150);
    expect(milliseconds(".15s")).toBe(150);
    expect(milliseconds(" 0.4s ")).toBe(400);
  });
});
