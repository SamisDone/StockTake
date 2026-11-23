/**
 * Comma-separated values, as spreadsheets write and read them (RFC 4180). Plain module:
 * the export routes write with it, the import parses with it, and the tests run it under
 * Node.
 */

export type Cell = string | number | null | undefined;

const BOM = "\uFEFF";

/**
 * A text cell a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, or a leading tab
 * or carriage return) gets an apostrophe in front, so a product named "=HYPERLINK(...)"
 * opens as text. Numbers are written as numbers and never touched.
 */
const FORMULA = /^[=+\-@\t\r]/;

function cell(value: Cell) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = FORMULA.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * The rows as a CSV file: CRLF line ends, quoted only where needed, and a byte order mark
 * first, which is what makes Excel read the file as UTF-8 (Bangla names, the taka sign).
 */
export function toCsv(rows: Cell[][]) {
  return `${BOM}${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

/**
 * The delimiter a file uses: a comma, or the semicolon spreadsheets write where the comma
 * is the decimal mark, or a tab. Read from the first line, outside quotes.
 */
export function delimiterOf(text: string) {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && char in counts) counts[char as keyof typeof counts] += 1;
  }
  const [best] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return best[1] > 0 ? best[0] : ",";
}

/** One row of a CSV file and the line it starts on (1 for the first), as a spreadsheet numbers it. */
export type CsvRow = { line: number; cells: string[] };

/**
 * The rows of a CSV file, each a list of cells as written (quotes removed, doubled quotes
 * read as one). Accepts CRLF, LF or CR line ends, a byte order mark, and a quoted cell
 * running over several lines. Blank lines are left out.
 */
export function readCsv(input: string): CsvRow[] {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const delimiter = delimiterOf(text);
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let value = "";
  let quoted = false;
  let line = 1;
  let start = 1;

  const endRow = () => {
    cells.push(value);
    if (cells.length > 1 || cells[0].trim() !== "") rows.push({ line: start, cells });
    cells = [];
    value = "";
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const lineEnd = char === "\n" || (char === "\r" && text[i + 1] !== "\n");
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"' && value.trim() === "") {
      quoted = true;
      value = "";
    } else if (char === delimiter) {
      cells.push(value);
      value = "";
    } else if (lineEnd) {
      endRow();
      start = line + 1;
    } else if (char !== "\r") {
      value += char;
    }
    if (lineEnd) line++;
  }
  if (value !== "" || cells.length > 0) endRow();
  return rows;
}

/** The cells of each row of a CSV file; see `readCsv`. */
export const parseCsv = (input: string) => readCsv(input).map((row) => row.cells);

/** A CSV download's response: the file, named, never cached. */
export function csvResponse(filename: string, rows: Cell[][]) {
  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
