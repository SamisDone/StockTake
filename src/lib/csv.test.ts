import { describe, expect, it } from "vitest";
import { parseCsv, readCsv, toCsv } from "./csv";

describe("toCsv", () => {
  it("writes a byte order mark, CRLF line ends, and quotes only where needed", () => {
    expect(
      toCsv([
        ["SKU", "Name"],
        ["AB-1", 'Tape, 48mm "clear"'],
        ["CD-2", 12.5],
      ]),
    ).toBe('\uFEFFSKU,Name\r\nAB-1,"Tape, 48mm ""clear"""\r\nCD-2,12.5\r\n');
  });

  it("keeps a text cell from running as a formula, but writes numbers as they are", () => {
    expect(toCsv([["=SUM(A1)", "+1", "@x", -3]])).toBe("\uFEFF'=SUM(A1),'+1,'@x,-3\r\n");
  });

  it("writes empty cells for null and undefined, and quotes a line break", () => {
    expect(toCsv([[null, undefined, "two\nlines"]])).toBe('\uFEFF,,"two\nlines"\r\n');
  });
});

describe("readCsv", () => {
  it("reads quoted cells, doubled quotes and a cell over several lines", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n"one\ntwo",3\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["one\ntwo", "3"],
    ]);
  });

  it("numbers each row by the line it starts on, skipping blank lines", () => {
    const rows = readCsv('a,b\n\n"one\ntwo",1\nlast,2');
    expect(rows.map((row) => row.line)).toEqual([1, 3, 5]);
  });

  it("drops a byte order mark and reads LF or CR line ends", () => {
    expect(parseCsv("\uFEFFa,b\nc,d\re,f")).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ]);
  });

  it("reads files that use semicolons or tabs", () => {
    expect(parseCsv("sku;cost\nA;1,50\n")).toEqual([
      ["sku", "cost"],
      ["A", "1,50"],
    ]);
    expect(parseCsv("sku\tname\nA\tTape\n")).toEqual([
      ["sku", "name"],
      ["A", "Tape"],
    ]);
  });

  it("reads back what toCsv wrote", () => {
    const rows = [
      ["SKU", "Name", "Note"],
      ["X-1", "কাগজ, A4", 'He said "no"\r\nthen left'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
