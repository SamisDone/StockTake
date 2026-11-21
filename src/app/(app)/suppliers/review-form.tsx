"use client";

import { Check, Star } from "lucide-react";
import { useActionState, useState } from "react";
import { Field, fieldProps } from "@/components/field";
import { type ReviewFormState, removeReview, saveReview } from "@/server/supplier-actions";

const WORDS = ["Poor", "Fair", "Good", "Very good", "Excellent"];
const initial: ReviewFormState = {};

/**
 * The signed-in person's review: five stars to choose from (native radios, so arrow
 * keys move between them) and a comment. Saving replaces their last review; removing
 * takes it off.
 */
export function ReviewForm({
  supplierId,
  supplierName,
  mine,
}: {
  supplierId: number;
  supplierName: string;
  mine: { rating: number; comment: string } | null;
}) {
  const [saved, save, saving] = useActionState(saveReview, initial);
  const [removed, remove, removing] = useActionState(removeReview, initial);
  const pending = saving || removing;

  // The stars are held here; React resets the comment after each send to its default,
  // which is what was typed (a refusal) or the review as saved.
  const [answered, setAnswered] = useState(saved);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [hovered, setHovered] = useState<number | null>(null);
  if (answered !== saved) {
    setAnswered(saved);
    if (saved.values) setRating(Number(saved.values.rating) || 0);
  }
  // A removed review clears the stars; a saved one keeps them.
  const [removedAt, setRemovedAt] = useState(removed.done?.at);
  if (removed.done?.at !== removedAt) {
    setRemovedAt(removed.done?.at);
    setRating(0);
  }

  const shown = hovered ?? rating;
  const ratingError = saved.fields?.rating;
  const done = [saved.done, removed.done].filter(Boolean).sort((a, b) => b!.at - a!.at)[0];
  const error = saved.error ?? removed.error;

  return (
    <form action={save} aria-busy={pending} className="mt-4">
      <input type="hidden" name="supplierId" value={supplierId} />
      <fieldset disabled={pending} className="min-w-0">
        <legend className="sr-only">Your review of {supplierName}</legend>

        <div className={`border-t border-ink px-5 pt-2.5 pb-2 sm:px-8 ${ratingError ? "bg-stock" : ""}`}>
          <fieldset aria-describedby={ratingError ? "rating-error" : undefined}>
            <legend className={`field-name ${ratingError ? "text-ink" : ""}`}>Your rating</legend>
            <div className="-ml-2.5 flex items-center" onPointerLeave={() => setHovered(null)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(n)}
                  className="press-quiet flex size-11 cursor-pointer items-center justify-center rounded-control has-focus-visible:outline-2 has-focus-visible:-outline-offset-4 has-focus-visible:outline-ink"
                >
                  <input
                    type="radio"
                    name="rating"
                    value={n}
                    checked={rating === n}
                    onChange={() => setRating(n)}
                    aria-label={`${n} ${n === 1 ? "star" : "stars"}, ${WORDS[n - 1].toLowerCase()}`}
                    className="sr-only"
                  />
                  <Star
                    aria-hidden
                    size={24}
                    strokeWidth={2}
                    className={`transition-colors duration-100 ${n <= shown ? "fill-ink text-ink" : "text-ink-3"}`}
                  />
                </label>
              ))}
              <span aria-hidden className="ml-2 min-w-20 text-sm font-semibold">
                {shown > 0 ? WORDS[shown - 1] : ratingError ? "" : "Not rated"}
              </span>
            </div>
            {ratingError ? (
              <p id="rating-error" role="alert" className="pb-1 text-sm font-medium">
                {ratingError}
              </p>
            ) : null}
          </fieldset>
        </div>

        <div className="border-y border-ink">
          <Field name="comment" label="Comment" optional error={saved.fields?.comment}>
            <textarea
              {...fieldProps("comment", { error: saved.fields?.comment })}
              defaultValue={saved.values?.comment ?? mine?.comment ?? ""}
              key={`${mine?.comment ?? ""}|${removed.done?.at ?? ""}`}
              maxLength={1000}
              rows={2}
              placeholder={`How ${supplierName} has been to order from`}
              className="field-input resize-y text-base font-normal placeholder:text-ink-3"
            />
          </Field>
        </div>

        {error ? (
          <p role="alert" className="bg-stock px-5 py-3 text-sm font-medium sm:px-8">
            {error.message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-3 px-5 pt-3 pb-5 sm:px-8">
          <p role="status" className="min-h-5 min-w-0 basis-full text-sm font-medium sm:flex-1 sm:basis-auto">
            {saving ? (
              "Saving…"
            ) : removing ? (
              "Removing…"
            ) : done ? (
              <span key={done.at} className="print-in flex items-start gap-1.5">
                <Check aria-hidden size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                {done.message}
              </span>
            ) : null}
          </p>
          {mine ? (
            <button
              type="submit"
              formAction={remove}
              formNoValidate
              className="press-quiet min-h-12 rounded-control px-4 font-semibold text-ink-2 enabled:hover:bg-liner enabled:hover:text-ink max-sm:flex-1"
            >
              Remove my review
            </button>
          ) : null}
          <button
            type="submit"
            className="group h-12 shrink-0 rounded-control bg-ink px-5 font-semibold text-label transition-colors duration-150 enabled:hover:bg-ink-lift disabled:cursor-progress disabled:bg-ink-2 max-sm:flex-1"
          >
            <span className="inline-block transition-transform duration-150 ease-out group-enabled:group-active:scale-[0.96]">
              {mine ? "Update review" : "Save review"}
            </span>
          </button>
        </div>
      </fieldset>
    </form>
  );
}
