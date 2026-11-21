import { describe, expect, it } from "vitest";
import type { Ref } from "@/assistant/tools";
import { parseAnswer, refHref } from "./answer-text";

const tape: Ref = { kind: "product", id: 4, label: "Packing tape 48mm", code: "PKG-TAPE-48" };
const tapeShort: Ref = { kind: "product", id: 5, label: "Tape", code: "TAPE-1" };
const harbor: Ref = { kind: "supplier", id: 1, label: "Harbor Packaging Co." };
const order: Ref = { kind: "order", id: 12, label: "PO-0012", code: "PO-0012" };

describe("parseAnswer", () => {
  it("splits paragraphs on blank lines and joins wrapped lines", () => {
    expect(parseAnswer("One\ntwo.\n\nThree.")).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "One two." }] },
      { type: "paragraph", content: [{ type: "text", text: "Three." }] },
    ]);
  });

  it("reads - and 1. lists, with indented continuation lines", () => {
    expect(parseAnswer("Low:\n- A\n- B\n  more\n1. C")).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Low:" }] },
      { type: "list", ordered: false, items: [[{ type: "text", text: "A" }], [{ type: "text", text: "B more" }]] },
      { type: "list", ordered: true, items: [[{ type: "text", text: "C" }]] },
    ]);
  });

  it("keeps bold, and drops headings, code marks and stray asterisks", () => {
    expect(parseAnswer("## Stock\nYou have **14** `units` *left*.")).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Stock" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "You have " },
          { type: "bold", children: [{ type: "text", text: "14" }] },
          { type: "text", text: " units left." },
        ],
      },
    ]);
  });

  it("never passes markup through", () => {
    const [block] = parseAnswer('<img src=x onerror="alert(1)"> [click](javascript:alert(1))');
    expect(block).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: '<img src=x onerror="alert(1)"> [click](javascript:alert(1))' }],
    });
  });

  it("links the first mention of each record, preferring the longest name", () => {
    const [block] = parseAnswer(
      "Order Packing tape 48mm from Harbor Packaging Co. on PO-0012. Tape again: packing tape 48mm.",
      [tapeShort, tape, harbor, order],
    );
    expect(block).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Order " },
        { type: "ref", ref: tape, text: "Packing tape 48mm" },
        { type: "text", text: " from " },
        { type: "ref", ref: harbor, text: "Harbor Packaging Co." },
        { type: "text", text: " on " },
        { type: "ref", ref: order, text: "PO-0012" },
        { type: "text", text: ". " },
        { type: "ref", ref: tapeShort, text: "Tape" },
        { type: "text", text: " again: packing tape 48mm." },
      ],
    });
  });

  it("matches whole words only, and links inside bold", () => {
    const [block] = parseAnswer("Tapes are fine; **Tape** is low.", [tapeShort]);
    expect(block).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Tapes are fine; " },
        { type: "bold", children: [{ type: "ref", ref: tapeShort, text: "Tape" }] },
        { type: "text", text: " is low." },
      ],
    });
  });
});

describe("refHref", () => {
  it("points at the record's own page", () => {
    expect([tape, harbor, order].map(refHref)).toEqual(["/products/4", "/suppliers/1", "/orders/12"]);
  });
});
