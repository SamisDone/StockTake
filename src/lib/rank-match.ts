/**
 * How a search row ranks against what's typed (cmdk's `filter`): the whole query as
 * one piece first (the row starting with it, then a word in it starting with it, then
 * anywhere), then every typed word somewhere in it; otherwise it's out. Loose fuzzy
 * matching, which finds "pens" in "PO-008", is no help when names and numbers are short.
 */
export function rankMatch(_value: string, search: string, keywords: string[] = []) {
  const text = keywords.join(" ").toLowerCase();
  const query = search.trim().toLowerCase();
  if (!query) return 1;
  const at = text.indexOf(query);
  if (at === 0) return 1;
  if (at > 0) return /[\s\-(,.]/.test(text[at - 1]) ? 0.8 : 0.6;
  return query.split(/\s+/).every((word) => text.includes(word)) ? 0.4 : 0;
}
