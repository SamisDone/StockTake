/*
 * Direction contract. Seed 1969b5e6.
 * THESIS: Every screen is a label. One value per boxed field, field names small, values
 *   printed large, the way a stockroom label is read at arm's length. Refuses the
 *   category default of an indigo sidebar with icon tiles and white KPI cards.
 * OWN-WORLD: direct-thermal white label stock on a liner-gray ground, ink-black type,
 *   2px rules between zones and 1px between fields, reverse print (white on black) for
 *   the active and urgent, hi-vis yellow label stock only for "needs attention", and
 *   fault red (the second ink of two-colour thermal stock) only for errors. Archivo
 *   from condensed to normal width; Martian Mono only for identifiers and literal machine
 *   text (SKUs, PO numbers, SQL, the database's own messages).
 * STORY: the operator sees what's on hand and what's running out, sees why each number
 *   is what it is, and acts on it.
 * FIRST VIEWPORT: login is one label on liner gray: wordmark zone, tear-off demo stubs
 *   (Admin / Staff), boxed email and password fields, black "Sign in" bar. The app is a
 *   rail on the liner beside a single label sheet whose header zone carries the title.
 * FORM: Thermal Label, candidate 3 of 7 (GS1 logistics labels).
 *   Signature motion: content prints, revealing top to bottom as a label feeds out.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
 *   review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
 */
import type { Metadata, Viewport } from "next";
import { Archivo, Martian_Mono, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
});

/**
 * Bengali script, behind Archivo: the taka sign (৳) and Bangla text. Only its Bengali
 * range is declared, so it's fetched only on a page that prints one of those characters.
 */
const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  axes: ["wdth"],
  variable: "--font-bengali",
  preload: false,
});

const martianMono = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-martian-mono",
});

export const metadata: Metadata = {
  title: { default: "Stocktake", template: "%s · Stocktake" },
  description: "Inventory you can audit: every unit on hand traces back to a ledger entry.",
};

export const viewport: Viewport = {
  themeColor: "#e5e6e1",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${notoBengali.variable} ${martianMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
