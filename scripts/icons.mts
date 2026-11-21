/**
 * Makes the favicons in src/app from the mark's drawings (src/lib/mark.ts). Run it after
 * changing the mark: `pnpm icons`. Rasterizing uses sharp, which Next installs.
 *
 * - icon.svg: the 16 px drawing, which stays on whole pixels at 16, 32 and 48. It turns
 *   white on a dark browser theme, so the tab never shows a black label on black.
 * - favicon.ico: 16, 32 and 48 px images: the 16 and 32 px drawings, and the 16 px one at 3×.
 * - apple-icon.png: 180 px, the mark on the liner, for home screens (which round it).
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { MARK_PATHS, type MarkGrid, markGrid } from "../src/lib/mark.ts";

const INK = "#0e0e0e";
const LINER = "#e5e6e1";
const out = (name: string) => new URL(`../src/app/${name}`, import.meta.url);

const svg = (grid: MarkGrid, size: number, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${grid} ${grid}" width="${size}" height="${size}">` +
  `${extra}<path fill="${INK}" fill-rule="evenodd" d="${MARK_PATHS[grid]}"/></svg>`;

/** 48 px comes from the 16 px drawing at exactly 3×, so it stays on whole pixels too. */
const png = (size: number) =>
  sharp(Buffer.from(svg(size === 48 ? 16 : markGrid(size), size)))
    .png()
    .toBuffer();

writeFileSync(
  out("icon.svg"),
  svg(16, 16, `<style>@media (prefers-color-scheme: dark) { path { fill: #fff } }</style>`) + "\n",
);

// An .ico is a directory of images; PNG entries are fine for every current browser.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(png));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const entry = 6 + 16 * i;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[i].length;
});
writeFileSync(out("favicon.ico"), Buffer.concat([header, ...images]));

const mark = await sharp(Buffer.from(svg(64, 128)))
  .png()
  .toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: LINER } })
  .composite([{ input: mark, left: 26, top: 26 }])
  .png()
  .toFile(out("apple-icon.png").pathname.replace(/^\/(\w:)/, "$1"));

console.log("Wrote src/app/icon.svg, favicon.ico and apple-icon.png");
