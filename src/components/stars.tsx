import { Star } from "lucide-react";

/**
 * A rating printed as five stars, filled up to the rating rounded to the nearest whole
 * star. Read out as the number, since five icons say nothing to a screen reader.
 */
export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const filled = Math.round(rating);
  return (
    <span role="img" aria-label={`${formatRating(rating)} out of 5 stars`} className="inline-flex shrink-0 gap-0.5">
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

/** An average rating to one decimal: 4 → "4.0", 4.333 → "4.3". */
export function formatRating(rating: number) {
  return (Math.round(rating * 10) / 10).toFixed(1);
}
