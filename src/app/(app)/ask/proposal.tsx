"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import type { Proposal } from "@/assistant/tools";
import { NAV_FORWARD } from "@/components/transitions";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { type MoneyPrefs, moneyFormat } from "@/lib/money";
import { type ProposalFormState, draftFromProposal } from "@/server/order-actions";
import { ASK_COPY } from "./copy";
import { FaultLine } from "@/components/fault";

/**
 * An order the assistant proposed. Nothing exists until the person writes it; the
 * draft then opens on its own label, where it can still be changed before an admin
 * places it. Once written, the proposal says which draft it became, so coming back to
 * the conversation can't write it twice.
 */
export function ProposalSlip({
  proposal,
  money,
  language,
  written,
  onWritten,
}: {
  proposal: Proposal;
  money: MoneyPrefs;
  language: Language;
  written: { id: number; number: string } | null;
  onWritten: (draft: { id: number; number: string }) => void;
}) {
  const router = useRouter();
  const m = moneyFormat(money, language);
  const f = formats(language);
  const t = ASK_COPY[language].proposal;
  const [state, formAction, pending] = useActionState(async (previous: ProposalFormState, formData: FormData) => {
    const result = await draftFromProposal(previous, formData);
    if (result.saved) {
      onWritten(result.saved);
      router.push(`/orders/${result.saved.id}`, { transitionTypes: NAV_FORWARD });
    }
    return result;
  }, {});
  const units = proposal.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <section aria-label={t.label(proposal.supplierName)} className="mt-5 border-y border-ink">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink pt-2.5 pb-3">
        <div>
          <p className="field-name">{t.title}</p>
          <p className="text-lg font-bold">{proposal.supplierName}</p>
        </div>
        <p className="text-sm text-ink-2">{t.units(units, f.count(units))}</p>
      </header>

      <table className="w-full border-collapse text-left">
        <thead className="sr-only">
          <tr>
            <th scope="col">{t.product}</th>
            <th scope="col">{t.quantity}</th>
            <th scope="col">{t.cost}</th>
          </tr>
        </thead>
        <tbody>
          {proposal.lines.map((line) => (
            <tr key={line.productId} className="border-b border-hairline align-baseline">
              <td className="py-2.5 pr-3">
                <span className="font-semibold">{line.name}</span>
                <span className="block text-sm text-ink-3">
                  <span className="font-mono text-xs">{line.sku}</span>
                  {t.onHand(f.count(line.onHand))}
                </span>
              </td>
              <td className="tabular py-2.5 pr-3 text-right whitespace-nowrap">{f.count(line.quantity)}</td>
              <td className="tabular py-2.5 text-right whitespace-nowrap text-ink-2">
                {m.money(line.quantity * line.unitCostCents)}
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row" className="py-2.5 text-left font-semibold" colSpan={2}>
              {t.total}
            </th>
            <td className="tabular py-2.5 text-right font-bold whitespace-nowrap">{m.money(proposal.totalCents)}</td>
          </tr>
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ink py-3">
        {written ? (
          <p className="text-sm">
            {t.written[0]}
            <Link
              href={`/orders/${written.id}`}
              transitionTypes={NAV_FORWARD}
              className="font-mono text-[0.875em] underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink"
            >
              {written.number}
            </Link>
            {t.written[1]}
          </p>
        ) : (
          <form action={formAction} aria-busy={pending} className="contents">
            <input type="hidden" name="supplierId" value={proposal.supplierId} />
            {proposal.lines.map((line) => (
              <span key={line.productId} hidden>
                <input type="hidden" name="productId" value={line.productId} />
                <input type="hidden" name="quantity" value={line.quantity} />
              </span>
            ))}
            <button
              type="submit"
              disabled={pending}
              className="group h-11 rounded-control bg-ink px-4 text-sm font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:w-full"
            >
              <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
                {t.write}
              </span>
            </button>
            <p className="max-w-sm text-sm text-ink-2">{t.writeNote}</p>
            <p role="status" className="sr-only">
              {pending ? t.writing(proposal.supplierName) : ""}
            </p>
          </form>
        )}
        {/* Takes no room while closed: the negative margin cancels the row's gap, and the
            line carries the gap inside itself as it opens. */}
        <div className="-mt-3 w-full">
          <FaultLine message={pending ? undefined : state.error?.message} hold={false} className="pt-3" />
        </div>
      </div>
    </section>
  );
}
