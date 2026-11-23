"use client";

import { FileUp } from "lucide-react";
import Link from "next/link";
import { type DragEvent, type ReactNode, useRef, useState, useTransition } from "react";
import type { ImportColumn, PlannedRow } from "@/domain/product-import";
import { FaultLine, FaultText } from "@/components/fault";
import { FOUR_TALLIES, Tally } from "@/components/stock";
import { notify } from "@/components/toasts";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { DOLLARS, moneyFormat } from "@/lib/money";
import { type ImportCheck, checkImport, runImport } from "@/server/import-actions";
import { PRODUCTS_COPY } from "./copy";
import { IMPORT_COPY } from "./import-copy";

const MAX_BYTES = 512 * 1024;

type Phase = "idle" | "reading" | "importing" | "done";

/**
 * Bringing products in from a CSV file. The file is read in the browser and checked on
 * the server against the catalog as it is, which writes nothing: the label then prints
 * what importing would do, row by row, and any cell it can't read. Import writes it all
 * at once, or nothing.
 */
export function ImportForm({
  language,
  heading,
  action,
}: {
  language: Language;
  heading: ReactNode;
  action: ReactNode;
}) {
  const t = IMPORT_COPY[language];
  const f = formats(language);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const [fault, setFault] = useState<string>();
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  // Each file checked prints its preview afresh.
  const [checked, setChecked] = useState(0);
  const [, startTransition] = useTransition();

  function choose(chosen: File | undefined) {
    if (!chosen || phase === "reading" || phase === "importing") return;
    setFault(undefined);
    if (/\.(xlsx?|ods|numbers)$/i.test(chosen.name)) return setFault(t.spreadsheet);
    if (chosen.size > MAX_BYTES) return setFault(t.tooLarge);
    setPhase("reading");
    startTransition(async () => {
      try {
        const text = await chosen.text();
        const result = await checkImport(text);
        if (!result.ok) {
          setFault(result.message);
          setPhase("idle");
          return;
        }
        setFile({ name: chosen.name, text });
        setCheck(result.check);
        setChecked((n) => n + 1);
        setPhase("idle");
      } catch {
        setFault(t.failed);
        setPhase("idle");
      }
    });
  }

  function submit() {
    if (!file || phase !== "idle") return;
    setFault(undefined);
    setPhase("importing");
    startTransition(async () => {
      try {
        const result = await runImport(file.text);
        if (!result.ok) {
          setFault(result.message);
          setPhase("idle");
          return;
        }
        setCheck(result.check);
        if (!result.written) return setPhase("idle");
        setPhase("done");
        notify({ message: t.toast(f.count(result.check.rows.length)), language });
        // The result sentence replaces the button that was pressed, so it takes the focus.
        requestAnimationFrame(() => document.getElementById("import-result")?.focus());
      } catch {
        setFault(t.failed);
        setPhase("idle");
      }
    });
  }

  function reset() {
    setFile(null);
    setCheck(null);
    setFault(undefined);
    setPhase("idle");
    requestAnimationFrame(() => input.current?.focus());
  }

  function over(event: DragEvent) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDragging(true);
  }

  const busy = phase === "reading" || phase === "importing";
  const changing = check ? check.rows.filter((row) => row.action !== "unchanged" || row.count).length : 0;
  const blocked = !check || check.problems.length > 0 || changing === 0;

  return (
    <div>
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="min-w-0">
          {heading}
          <p className="mt-3 max-w-prose text-sm text-ink-2">{t.intro}</p>
        </div>
        {action}
      </header>

      {phase === "done" && check ? (
        <Done check={check} language={language} onAnother={reset} />
      ) : (
        <>
          {/* The file: a boxed field whose value is the file's name. The whole field takes a drop. */}
          <div
            onDragOver={over}
            onDragEnter={over}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              choose(event.dataTransfer.files[0]);
            }}
            className={`border-b-2 border-ink px-5 pt-2.5 pb-4 transition-colors duration-(--dur-press) sm:px-8 ${
              dragging ? "bg-liner" : "bg-label"
            } ${fault ? "fault-rule" : ""}`}
          >
            <p id="import-file-name" className="field-name">
              {t.file}
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <p
                className={`min-w-0 truncate text-lg font-medium ${file ? "font-mono text-base" : "text-ink-3"}`}
                aria-live="polite"
              >
                {dragging ? t.dropHere : (file?.name ?? t.noFile)}
              </p>
              <input
                ref={input}
                type="file"
                accept=".csv,text/csv"
                aria-labelledby="import-file-name"
                aria-describedby="import-file-hint"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  choose(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                data-autofocus
                disabled={busy}
                aria-describedby="import-file-hint"
                onClick={() => input.current?.click()}
                className="group flex h-12 shrink-0 items-center gap-2 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:w-full max-sm:justify-center"
              >
                <span className="flex items-center gap-2 transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
                  <FileUp aria-hidden size={18} strokeWidth={2.25} />
                  {phase === "reading" ? t.reading : file ? t.chooseAnother : t.choose}
                </span>
              </button>
            </div>
            <p id="import-file-hint" className="mt-2 max-w-prose text-xs text-ink-3">
              {t.dropHint} {t.template.before}{" "}
              <a
                href="/api/export/products"
                download
                className="font-semibold text-ink-2 underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
              >
                {t.template.link}
              </a>
              {t.template.after}
            </p>
            <FaultLine message={fault} className="pt-2" />
          </div>

          {check ? <Preview key={checked} check={check} language={language} /> : null}

          {check ? (
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3 px-5 pt-4 pb-6 sm:px-8">
              <p role="status" className="min-h-5 min-w-0 text-sm font-medium sm:flex-1">
                {phase === "importing"
                  ? t.importing
                  : check.problems.length > 0
                    ? t.blocked(check.problems.length)
                    : changing === 0
                      ? t.nothing
                      : null}
              </p>
              <button
                type="button"
                onClick={submit}
                disabled={blocked || busy}
                className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:bg-ink-2 data-[busy]:cursor-progress max-sm:w-full"
                data-busy={phase === "importing" ? "" : undefined}
              >
                <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
                  {t.submit(changing)}
                </span>
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** What importing the file would do: the tallies, anything to fix, and each row that changes. */
function Preview({ check, language }: { check: ImportCheck; language: Language }) {
  const t = IMPORT_COPY[language];
  const f = formats(language);
  const names = columnNames(language);
  const changing = check.rows.filter((row) => row.action !== "unchanged" || row.count);
  const matching = check.rows.length - changing.length;

  return (
    <div className="print-in">
      <dl className={`grid border-b-2 border-ink ${FOUR_TALLIES}`}>
        <Tally name={t.tallies[0]} value={check.tally.created} language={language} />
        <Tally name={t.tallies[1]} value={check.tally.updated} language={language} />
        <Tally name={t.tallies[2]} value={check.tally.counted} language={language} />
        <Tally name={t.tallies[3]} value={check.problems.length} language={language} />
      </dl>

      {check.problems.length > 0 ? (
        <section aria-labelledby="import-problems" className="border-b-2 border-ink px-5 pt-5 pb-4 sm:px-8">
          <h3 id="import-problems" className="text-lg font-bold">
            {t.problemsTitle}
          </h3>
          <p className="mt-1 max-w-prose text-sm text-ink-2">{t.problemsHelp}</p>
          <ol className="mt-3">
            {check.problems.map((problem, i) => (
              <li
                key={i}
                className="grid gap-x-4 gap-y-0.5 border-t border-hairline py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)]"
              >
                <p className="text-sm font-semibold">
                  {problem.line === null ? t.fileProblem : t.line(f.count(problem.line))}
                  {problem.column ? <span className="font-normal text-ink-2"> · {names[problem.column]}</span> : null}
                </p>
                <FaultText>{problem.message}</FaultText>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {check.newSuppliers.length > 0 || check.ignored.length > 0 ? (
        <div className="space-y-1 border-b border-ink px-5 py-3 text-sm text-ink-2 sm:px-8">
          {check.newSuppliers.length > 0 ? (
            <p className="max-w-prose">{t.newSuppliers(check.newSuppliers.join(", "))}</p>
          ) : null}
          {check.ignored.length > 0 ? <p className="max-w-prose">{t.ignored(check.ignored.join(", "))}</p> : null}
        </div>
      ) : null}

      {changing.length > 0 ? (
        <section aria-labelledby="import-changes" className="pt-5">
          <h3 id="import-changes" className="px-5 text-lg font-bold sm:px-8">
            {t.changesTitle}
          </h3>
          {matching > 0 ? <p className="mt-1 px-5 text-sm text-ink-2 sm:px-8">{t.matching(matching)}</p> : null}
          <table className="mt-3 w-full border-collapse text-left text-sm">
            <thead className="sticky-head">
              <tr className="border-b border-ink">
                <th scope="col" className="field-name pt-1 pr-4 pb-2 pl-5 sm:pl-8">
                  {t.columns.line}
                </th>
                <th scope="col" className="field-name pt-1 pr-4 pb-2">
                  {t.columns.product}
                </th>
                <th scope="col" className="field-name w-1/2 pt-1 pr-5 pb-2 sm:pr-8">
                  {t.columns.change}
                </th>
              </tr>
            </thead>
            <tbody>
              {changing.map((row) => (
                <tr key={row.line} className="border-b border-hairline align-top last:border-b-0">
                  <td className="tabular py-2.5 pr-4 pl-5 text-ink-2 sm:pl-8">{f.count(row.line)}</td>
                  <td className="py-2.5 pr-4">
                    <p className="font-semibold">{row.name}</p>
                    <p className="font-mono text-xs text-ink-3">{row.sku}</p>
                  </td>
                  <td className="py-2.5 pr-5 sm:pr-8">
                    <Changes row={row} language={language} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

/** One row's changes, a line each: "Unit cost $2.50 → $2.75", "Count 4 → 6". */
function Changes({ row, language }: { row: PlannedRow; language: Language }) {
  const t = IMPORT_COPY[language];
  const f = formats(language);
  const money = moneyFormat(DOLLARS, language).money;
  const names = columnNames(language);
  const show = (field: string, value: string | number | null) => {
    if (value === null || value === "") return t.blank;
    if (field === "unitCost" || field === "unitPrice") return money(Number(value));
    if (typeof value === "number") return f.count(value);
    return value;
  };
  return (
    <ul className="space-y-0.5">
      {row.action === "create" ? <li className="font-semibold">{t.added}</li> : null}
      {row.changes.map((change) => (
        <li key={change.field} className="break-words">
          <span className="text-ink-2">{names[change.field]}</span>{" "}
          <span className="tabular">
            {show(change.field, change.from)} {t.arrow}{" "}
            <span className="font-semibold">{show(change.field, change.to)}</span>
          </span>
        </li>
      ))}
      {row.count ? (
        <li>
          <span className="text-ink-2">{t.count}</span>{" "}
          <span className="tabular">
            {f.count(row.count.was)} {t.arrow} <span className="font-semibold">{f.count(row.count.counted)}</span>
          </span>
        </li>
      ) : null}
    </ul>
  );
}

/** The import's result, in one sentence, with the way back to the list or on to another file. */
function Done({ check, language, onAnother }: { check: ImportCheck; language: Language; onAnother: () => void }) {
  const t = IMPORT_COPY[language];
  const f = formats(language);
  const parts = (
    [
      ["created", check.tally.created],
      ["updated", check.tally.updated],
      ["counted", check.tally.counted],
      ["suppliers", check.tally.suppliers],
    ] as const
  )
    .filter(([, n]) => n > 0)
    .map(([key, n]) => t.doneParts[key](f.count(n)));
  return (
    <div className="print-in">
      <dl className={`grid border-b-2 border-ink ${FOUR_TALLIES}`}>
        <Tally name={t.tallies[0]} value={check.tally.created} language={language} />
        <Tally name={t.tallies[1]} value={check.tally.updated} language={language} />
        <Tally name={t.tallies[2]} value={check.tally.counted} language={language} />
        <Tally name={t.suppliersTally} value={check.tally.suppliers} language={language} />
      </dl>
      <div id="import-result" tabIndex={-1} className="border-b-2 border-ink px-5 py-3 outline-none sm:px-8">
        <p className="max-w-prose text-sm" role="status">
          <strong className="font-bold">{t.done}</strong> {t.doneText(parts)}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 px-5 pt-4 pb-6 sm:px-8">
        <button
          type="button"
          onClick={onAnother}
          className="min-h-12 rounded-control px-4 font-semibold text-ink-2 press-quiet hover:bg-liner hover:text-ink max-sm:flex-1"
        >
          {t.another}
        </button>
        <Link
          href="/products"
          className="group flex h-12 items-center rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 hover:bg-ink-lift max-sm:flex-1 max-sm:justify-center"
        >
          <span className="inline-block transition-transform duration-150 ease-out group-active:scale-[0.96]">
            {t.finish}
          </span>
        </Link>
      </div>
    </div>
  );
}

/** Each column by the name the product form gives it, in the reader's language. */
function columnNames(language: Language): Record<ImportColumn, string> {
  const p = PRODUCTS_COPY[language];
  return {
    sku: p.form.sku,
    name: p.form.name,
    category: p.form.category,
    supplier: p.form.supplier,
    unitCost: p.form.unitCost,
    unitPrice: p.form.unitPrice,
    reorderPoint: p.form.reorderPoint,
    reorderQuantity: p.form.reorderQuantity,
    onHand: p.onHand,
    description: p.form.description,
  };
}
