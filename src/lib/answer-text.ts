import { type Language, banglaDigits } from "./i18n";
import type { Ref } from "@/assistant/tools";

/**
 * Turns the model's answer into blocks to render. Only a small, safe subset of Markdown
 * is understood (paragraphs, "- " and "1. " lists, **bold**); anything else is printed as
 * plain text, so the model can't inject markup. The first mention of each record a tool
 * returned becomes a link to it: links come from what was looked up, never from the text.
 */

export type Inline =
  { type: "text"; text: string } | { type: "bold"; children: Inline[] } | { type: "ref"; ref: Ref; text: string };

export type Block = { type: "paragraph"; content: Inline[] } | { type: "list"; ordered: boolean; items: Inline[][] };

export function refHref(ref: Ref) {
  if (ref.kind === "product") return `/products/${ref.id}` as const;
  if (ref.kind === "supplier") return `/suppliers/${ref.id}` as const;
  return `/orders/${ref.id}` as const;
}

const LIST_ITEM = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds record names in text: longest first, whole words only, case-insensitive. */
function linker(refs: Ref[]) {
  const byName = new Map<string, Ref>();
  for (const ref of refs) {
    for (const name of [ref.label, ref.code]) {
      if (name && name.length >= 3 && !byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), ref);
    }
  }
  if (byName.size === 0) return null;
  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escape);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.join("|")})(?![\\p{L}\\p{N}])`, "giu");
  return { pattern, byName };
}

type Linker = ReturnType<typeof linker>;

function linkText(text: string, link: Linker, linked: Set<string>): Inline[] {
  if (!link || text === "") return text ? [{ type: "text", text }] : [];
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(link.pattern)) {
    const ref = link.byName.get(match[0].toLowerCase())!;
    const key = `${ref.kind}:${ref.id}`;
    if (linked.has(key)) continue;
    linked.add(key);
    if (match.index > last) out.push({ type: "text", text: text.slice(last, match.index) });
    out.push({ type: "ref", ref, text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** Bold runs, then links inside each run. Stray Markdown marks are dropped. */
function inline(text: string, link: Linker, linked: Set<string>): Inline[] {
  const out: Inline[] = [];
  const parts = text.split(/\*\*(.+?)\*\*/g);
  parts.forEach((part, i) => {
    const clean = part
      .replace(/`/g, "")
      .replace(/(^|\s)\*(\S)/g, "$1$2")
      .replace(/(\S)\*(?=\s|$|[.,;:!?])/g, "$1");
    if (i % 2 === 1) out.push({ type: "bold", children: linkText(clean, link, linked) });
    else out.push(...linkText(clean, link, linked));
  });
  return out;
}

export function parseAnswer(text: string, refs: Ref[] = []): Block[] {
  const link = linker(refs);
  const linked = new Set<string>();
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", content: inline(paragraph.join(" "), link, linked) });
      paragraph = [];
    }
    if (list) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items.map((item) => inline(item, link, linked)) });
      list = null;
    }
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    // A heading prints as a paragraph of its own, a quote as an ordinary line.
    const heading = /^\s*#{1,6}\s+/.test(raw);
    const line = raw.replace(/^\s*(?:#{1,6}|>)\s*/, "").trimEnd();
    const item = line.match(LIST_ITEM);
    if (heading) {
      flush();
      paragraph.push(line.trim());
      flush();
    } else if (line.trim() === "") {
      flush();
    } else if (item) {
      const ordered = item[2] !== undefined;
      if (paragraph.length > 0 || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push(item[3]);
    } else if (list && /^\s{2,}/.test(raw)) {
      // An indented line continues the item above it.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      if (list) flush();
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

/**
 * An answer's prose in the reader's digits. In Bangla every figure takes Bangla digits,
 * except identifiers, which stay as the records print them: PO numbers and SKUs (a run
 * of capitals and digits joined by dashes, dots or underscores, with a letter in it).
 */
export function localProse(text: string, language: Language) {
  if (language !== "bn") return text;
  return text
    .split(/(\bPO-\d+\b|\b(?=[A-Z0-9._-]*[A-Z])[A-Z0-9]+(?:[-_.][A-Z0-9]+)+\b)/)
    .map((part, i) => (i % 2 === 1 ? part : banglaDigits(part)))
    .join("");
}
