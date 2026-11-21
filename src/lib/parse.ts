/**
 * Numbers as a person types them into a form. Shared by the forms, which work out
 * what an entry will do before it's sent, and the Server Actions, which have the last
 * word. Plain module: no server or client code. Bangla digits read the same as Latin
 * ones, so a Bangla keyboard can type into any number field.
 */

const latinDigits = (text: string) => text.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));

/** Whole units: digits only, thousands separators and spaces allowed. Null for anything else. */
export function parseUnits(text: string) {
  const digits = latinDigits(text).trim().replace(/[,\s]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/**
 * Dollars as integer cents: "12", "12.5", "$1,234.05", "১,২৩৪.০৫" (grouped in thousands or lakhs). Read from the digits, never
 * through floating point, so "1.13" is 113. Null for negatives and fractions of a cent.
 */
export function parseCents(text: string) {
  const plain = latinDigits(text)
    .trim()
    .replace(/^\$\s*/, "")
    .replace(/,(?=\d{2,3}(\D|$))/g, "");
  const match = /^(\d*)(?:\.(\d{1,2}))?$/.exec(plain);
  if (!match || (!match[1] && !match[2])) return null;
  return Number(match[1] || "0") * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** Cents as a form value: no dollar sign or separators, so it reads back unchanged. */
export function centsToInput(cents: number) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
