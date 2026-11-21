import { Star } from "lucide-react";
import { type Language, localDigits } from "@/lib/i18n";
import { COMPONENT_COPY } from "./copy";

/**
 * A rating printed as five stars, filled up to the rating rounded to the nearest whole
 * star. Read out as the number, since five icons say nothing to a screen reader.
 */
export function Stars({ rating, language, size = 16 }: { rating: number; language: Language; size?: number }) {
  const filled = Math.round(rating);
  return (
    <span
      role="img"
      aria-label={COMPONENT_COPY[language].stars(formatRating(rating, language))}
      className="inline-flex shrink-0 gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          size={size}
          strokeWidth={2}
          className={n <= filled ? "fill-ink text-ink" : "text-ink-3"}
        />
      ))}
    </span>
  );
}

/** An average rating to one decimal: 4 → "4.0", 4.333 → "4.3" ("৪.৩" in Bangla). */
export function formatRating(rating: number, language: Language) {
  return localDigits((Math.round(rating * 10) / 10).toFixed(1), language);
}
