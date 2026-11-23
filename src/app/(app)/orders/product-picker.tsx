"use client";

import { ProductPicker as Picker } from "@/components/product-picker";
import type { ProductChoice } from "./draft-values";
import { formats } from "@/lib/format";
import type { Language } from "@/lib/i18n";
import { type MoneyPrefs, moneyFormat } from "@/lib/money";
import { ORDERS_COPY } from "./copy";

/**
 * Adds a product to a draft. Running-low products come first with the quantity the
 * forecast suggests; each row shows what the choice needs: SKU, units on hand, and the
 * usual cost.
 */
export function ProductPicker({
  low,
  rest,
  placeholder,
  disabled,
  onPick,
  money,
  language,
}: {
  low: ProductChoice[];
  rest: ProductChoice[];
  placeholder: string;
  disabled: boolean;
  onPick: (product: ProductChoice) => void;
  money: MoneyPrefs;
  language: Language;
}) {
  const t = ORDERS_COPY[language].form;
  const f = formats(language);
  const m = moneyFormat(money, language);
  return (
    <Picker
      id="add-product"
      groups={[
        { name: t.runningLow, items: low },
        { name: low.length > 0 ? t.everythingElse : null, items: rest },
      ]}
      placeholder={placeholder}
      disabled={disabled}
      onPick={onPick}
      listLabel={t.addProduct}
      noMatch={t.pickerNoMatch}
      detail={(p) => (
        <>
          <span className="font-mono text-xs">{p.sku}</span> · {t.pickerOnHand(f.count(p.onHand))}
        </>
      )}
      aside={(p) => (
        <>
          {p.suggested > 0 ? <span className="block font-semibold">{t.pickerOrder(f.count(p.suggested))}</span> : null}
          <span className="block text-ink-2">{t.pickerCost(m.money(p.unitCostCents))}</span>
        </>
      )}
    />
  );
}
