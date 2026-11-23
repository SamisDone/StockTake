import { Star } from "lucide-react";
import { type Language, localDigits } from "@/lib/i18n";
import { COMPONENT_COPY } from "./copy";

/**
 * A rating printed as five stars, filled to the nearest half star: 4.5 is four and a
 * half, 2.5 two and a half. Read out as the number, since five icons say nothing to a
 * screen reader.
 */
/**
 * Below this many reviews an average says little, so it's printed in grey: one person's
 * opinion. (Each person reviews a supplier once, so on a small team two is already a lot.)
 */
export const FEW_REVIEWS = 2;

export function Stars({
  rating,
  language,
  size = 16,
  muted = false,
}: {
  rating: number;
  language: Language;
  size?: number;
  /** Too few reviews to lean on: the filled stars print grey instead of ink. */
  muted?: boolean;
}) {
  const filled = muted ? "fill-ink-3 text-ink-3" : "fill-ink text-ink";
  const halves = Math.round(rating * 2);
  return (
    <span
      role="img"
      aria-label={COMPONENT_COPY[language].stars(formatRating(rating, language))}
      className="inline-flex shrink-0 gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        // How much of this star is filled: 0, a half or all of it.
        const fill = Math.min(Math.max(halves - (n - 1) * 2, 0), 2) / 2;
        return (
          <span key={n} aria-hidden className="relative inline-flex">
            <Star size={size} strokeWidth={2} className={fill === 1 ? filled : "text-ink-3"} />
            {fill === 0.5 ? (
              // The filled half: the same star in ink, cut at its middle.
              <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
                <Star size={size} strokeWidth={2} className={filled} />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

/** An average rating to one decimal: 4 → "4.0", 4.333 → "4.3" ("৪.৩" in Bangla). */
export function formatRating(rating: number, language: Language) {
  return localDigits((Math.round(rating * 10) / 10).toFixed(1), language);
}
