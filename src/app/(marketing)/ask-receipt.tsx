import type { ReactNode } from "react";
import { type Inline, parseAnswer } from "@/lib/answer-text";
import { parseDayKey } from "@/lib/business-time";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { ASK_EXAMPLE } from "./ask-example";
import { COPY } from "./copy";

/**
 * A real exchange with the assistant, printed as a receipt: the question, each lookup it
 * ran (the tool named as the machine names it), the answer, and the order it proposed,
 * which stays a proposal until a person writes it. The exchange itself is English as it
 * was asked (`lang="en"`); the receipt's own labels are the reader's.
 *
 * Its lines print in as they scroll into view, like the ledger above it (landing.css).
 */

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (cents: number) => usd.format(cents / 100);

export function AskReceipt({ language }: { language: Language }) {
  const t = COPY[language].exchange;
  const f = formats(language);
  const { proposal } = ASK_EXAMPLE;
  const asked = parseDayKey(ASK_EXAMPLE.askedOn)!;

  return (
    <figure className="receipt torn-top ask-receipt">
      <div className="border-b-2 border-ink px-5 pt-3 pb-3 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="field-name">{t.question}</p>
          <p className="field-name text-right">{t.asked(f.date(asked, asked))}</p>
        </div>
        <p lang="en" className="max-w-120 text-lg leading-snug font-bold text-pretty">
          {ASK_EXAMPLE.question}
        </p>
      </div>

      <div className="px-5 pt-3 sm:px-6">
        <p className="field-name">{t.lookups}</p>
        <ol lang="en" className="mt-1 border-t border-hairline">
          {ASK_EXAMPLE.steps.map((step) => (
            <li
              key={step.summary}
              className="ask-line grid gap-x-4 border-b border-hairline py-2 text-sm sm:grid-cols-[10.5rem_minmax(0,1fr)]"
            >
              <span className="pt-0.5 font-mono text-xs text-ink-3">{step.tool}</span>
              <span>{step.summary}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="ask-line px-5 pt-4 sm:px-6">
        <p className="field-name">{t.answer}</p>
        <div lang="en" className="mt-1 max-w-prose space-y-3 leading-relaxed">
          {parseAnswer(ASK_EXAMPLE.answer).map((block, i) =>
            block.type === "paragraph" ? <p key={i}>{printed(block.content)}</p> : null,
          )}
        </div>
      </div>

      <section aria-label={t.proposed} className="ask-line mx-5 mt-5 border-t border-ink sm:mx-6">
        <div className="flex items-baseline justify-between gap-4 border-b border-ink pt-2.5 pb-3">
          <div className="min-w-0">
            <p className="field-name">{t.proposed}</p>
            <p lang="en" className="text-lg font-bold">
              {proposal.supplierName}
            </p>
          </div>
        </div>
        <table className="w-full border-collapse text-left">
          <tbody lang="en">
            {proposal.lines.map((line) => (
              <tr key={line.sku} className="border-b border-hairline align-baseline">
                <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                  <span className="font-semibold">{line.name}</span>
                  <span className="block text-sm text-ink-3">
                    <span className="font-mono text-xs">{line.sku}</span>
                    {" · "}
                    <span lang={language === "bn" ? "bn" : undefined}>{t.onHand(f.count(line.onHand))}</span>
                  </span>
                </th>
                <td className="tabular py-2.5 text-right whitespace-nowrap">
                  {money(line.quantity * line.unitCostCents)}
                  <span className="block text-sm text-ink-3">
                    {line.quantity} × {money(line.unitCostCents)}
                  </span>
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-2.5 text-left font-semibold">
                <span lang={language === "bn" ? "bn" : undefined}>{t.total}</span>
              </th>
              <td className="tabular py-2.5 text-right font-bold whitespace-nowrap">{money(proposal.totalCents)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="mt-1 bg-ink px-5 pt-3 pb-4 text-sm text-label sm:px-6">
        <p className="font-semibold">{t.handover}</p>
        {t.inEnglish ? <p className="mt-1 text-label/80">{t.inEnglish}</p> : null}
      </div>
    </figure>
  );
}

/** The answer's inline runs: plain text and bold, exactly as the model wrote them. */
function printed(content: Inline[]): ReactNode[] {
  return content.map((part, i) =>
    part.type === "bold" ? <strong key={i}>{printed(part.children)}</strong> : part.type === "text" ? part.text : null,
  );
}
