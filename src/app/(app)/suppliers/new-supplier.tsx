import type { ReactNode } from "react";
import { getCurrentUser } from "@/server/dal";
import { SupplierForm } from "./supplier-form";
import { getLanguage } from "@/server/preferences";
import type { Language } from "@/lib/i18n";
import { SUPPLIERS_COPY } from "./copy";

/**
 * A blank supplier label to fill in. Adding suppliers is an admin's job, so anyone else
 * is told so plainly, with what they can do instead.
 */
export async function NewSupplier({ action }: { action: ReactNode }) {
  const user = await getCurrentUser();
  const language = await getLanguage();
  const t = SUPPLIERS_COPY[language];
  if (user.role !== "admin") {
    return (
      <div>
        <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
          <h1 id="supplier-title" className="print-display text-4xl text-balance sm:text-5xl">
            {t.newTitle}
          </h1>
          {action}
        </header>
        <p className="max-w-prose px-5 py-5 text-ink-2 sm:px-8">{t.adminOnly}</p>
      </div>
    );
  }
  return (
    <SupplierForm
      language={language}
      defaults={{ name: "", email: "", phone: "", leadTimeDays: "7" }}
      action={action}
    />
  );
}

/** The blank label, unprinted: its header and the boxed fields hold their space. */
export function NewSupplierPlaceholder({ language, action }: { language: Language; action?: ReactNode }) {
  const t = SUPPLIERS_COPY[language].form;
  return (
    <div aria-hidden>
      <div className="flex items-start justify-between gap-4 px-5 pt-6 pb-3 sm:px-8 sm:pt-8">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">{t.newTitle}</p>
          <div className="mt-2 h-4 w-4/5 bg-liner/70" />
        </div>
        {action}
      </div>
      <div className="grid grid-cols-2 gap-px border-y-2 border-ink bg-ink">
        {[t.name, t.email, t.phone, t.leadTime].map((name, i) => (
          <div
            key={name}
            className={`bg-label px-5 pt-2.5 pb-3 sm:px-8 ${i === 0 || i === 3 ? "col-span-2" : "max-sm:col-span-2"}`}
          >
            <p className="field-name">{name}</p>
            <div className={`mt-1.5 bg-liner/70 ${i === 0 ? "h-9" : "h-6"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
