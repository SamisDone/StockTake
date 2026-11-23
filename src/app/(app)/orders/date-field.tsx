"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { dayKey } from "@/lib/business-time";
import type { Language } from "@/lib/i18n";
import { ORDERS_COPY } from "./copy";

/**
 * A day, picked on a calendar printed in the reader's language (month names, weekdays
 * and digits in Bangla too), where the browser's own date input follows the browser's
 * locale instead. The value is a day key, "2026-11-27", or "" for none; the form gets
 * it from a hidden input. Days before `min` can't be chosen.
 *
 * Keyboard: the arrows move a day or a week, Page Up/Down a month, Enter picks, Escape
 * closes and returns to the field.
 */
export function DateField({
  id,
  name,
  value,
  min,
  onChange,
  language,
  ...aria
}: {
  id: string;
  name: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
  language: Language;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}) {
  const t = ORDERS_COPY[language].form;
  const locale = language === "bn" ? "bn-BD" : "en-US";
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // The day the keyboard is on, and so the month shown.
  const [focus, setFocus] = useState(() => value || min || todayKey());
  const [moved, setMoved] = useState(false);

  // Close on a press anywhere else.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // Keep the focused day's button focused as the keyboard moves it.
  useEffect(() => {
    if (open && moved) grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus();
  }, [open, moved, focus]);

  const show = () => {
    setFocus(value || (min && min > todayKey() ? min : todayKey()));
    setMoved(true);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const choose = (day: string) => {
    onChange(day);
    close();
  };
  const move = (day: string) => {
    setFocus(min && day < min ? min : day);
    setMoved(true);
  };

  const focused = parse(focus);
  const first = new Date(Date.UTC(focused.getUTCFullYear(), focused.getUTCMonth(), 1));
  const start = addDays(first, -first.getUTCDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weeks = days.at(35)!.getUTCMonth() === first.getUTCMonth() ? 6 : 5;
  const today = todayKey();
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options });
  const longDay = fmt({ weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const fullDay = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dayNumber = fmt({ day: "numeric" });
  const monthTitle = fmt({ month: "long", year: "numeric" }).format(first);
  const weekdays = days.slice(0, 7).map((d) => fmt({ weekday: "narrow" }).format(d));
  const monthStep = (step: number) => {
    const next = new Date(Date.UTC(focused.getUTCFullYear(), focused.getUTCMonth() + step, 1));
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(focused.getUTCDate(), lastDay));
    return key(next);
  };
  const canGoBack = !min || key(addDays(first, -1)) >= min;

  return (
    <div ref={wrapper} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        {...aria}
        onClick={() => (open ? setOpen(false) : show())}
        className="field-input flex cursor-pointer items-center justify-between gap-2 text-left"
      >
        <span className={value ? "" : "font-normal text-ink-2"}>
          {value ? longDay.format(parse(value)) : t.datePlaceholder}
        </span>
        <CalendarDays aria-hidden size={18} strokeWidth={2} className="shrink-0" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t.datePlaceholder}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
          className="absolute top-full left-0 z-20 mt-1 w-72 border border-ink bg-label p-3 shadow-label"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => move(monthStep(-1))}
              disabled={!canGoBack}
              className="press-quiet flex size-9 items-center justify-center rounded-control enabled:hover:bg-liner disabled:text-ink-3"
            >
              <ChevronLeft aria-hidden size={18} strokeWidth={2.25} />
              <span className="sr-only">{t.previousMonth}</span>
            </button>
            <p aria-live="polite" className="font-semibold">
              {monthTitle}
            </p>
            <button
              type="button"
              onClick={() => move(monthStep(1))}
              className="press-quiet flex size-9 items-center justify-center rounded-control hover:bg-liner"
            >
              <ChevronRight aria-hidden size={18} strokeWidth={2.25} />
              <span className="sr-only">{t.nextMonth}</span>
            </button>
          </div>

          <div aria-hidden className="mt-2 grid grid-cols-7 text-center">
            {weekdays.map((w, i) => (
              <span key={i} className="field-name py-1">
                {w}
              </span>
            ))}
          </div>
          <div
            ref={grid}
            className="grid grid-cols-7"
            onKeyDown={(event) => {
              const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
              if (step) {
                event.preventDefault();
                move(key(addDays(focused, step)));
              } else if (event.key === "PageUp" || event.key === "PageDown") {
                event.preventDefault();
                move(monthStep(event.key === "PageUp" ? -1 : 1));
              }
            }}
          >
            {days.slice(0, weeks * 7).map((d) => {
              const day = key(d);
              const outside = d.getUTCMonth() !== first.getUTCMonth();
              const before = Boolean(min && day < min);
              const chosen = day === value;
              return (
                <button
                  key={day}
                  type="button"
                  data-day={day}
                  tabIndex={day === focus ? 0 : -1}
                  disabled={before}
                  aria-label={fullDay.format(d)}
                  aria-pressed={chosen}
                  aria-current={day === today ? "date" : undefined}
                  onClick={() => choose(day)}
                  className={`tabular flex h-9 items-center justify-center rounded-control text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${
                    chosen
                      ? "bg-ink font-semibold text-label"
                      : before
                        ? "text-ink-3/60"
                        : `hover:bg-liner ${outside ? "text-ink-3" : ""}`
                  } ${day === today && !chosen ? "font-bold underline decoration-2 underline-offset-4" : ""}`}
                >
                  {dayNumber.format(d)}
                </button>
              );
            })}
          </div>

          {value ? (
            <div className="mt-2 flex justify-end border-t border-hairline pt-2">
              <button
                type="button"
                onClick={() => choose("")}
                className="press-quiet h-9 rounded-control px-3 text-sm font-semibold hover:bg-liner"
              >
                {t.dateClear}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const DAY = 86_400_000;
const parse = (day: string) => new Date(`${day}T00:00:00Z`);
const key = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY);

/** Today on the business's clock (Dhaka): the day orders are kept in. */
const todayKey = () => dayKey(new Date());
