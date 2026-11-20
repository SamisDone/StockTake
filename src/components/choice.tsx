import type { ReactNode } from "react";

/**
 * One option of a row of choices, printed like a nav item: the chosen one is reverse
 * print. It's a native radio underneath, so a group gets arrow-key movement and form
 * submission for free. It's styled from the radio's own checked state, so what shows
 * chosen is always what a form would send. The focus rule is drawn inside, in the
 * option's own ink, so a scrolling row never clips it. Pass `checked` to control it, or
 * `defaultChecked` inside a form that resets itself.
 */
export function Choice({
  name,
  value,
  checked,
  defaultChecked,
  onSelect,
  children,
}: {
  name: string;
  value?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`relative inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-control px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 select-none pointer-coarse:min-h-11 has-focus-visible:outline-2 has-focus-visible:-outline-offset-4 has-focus-visible:outline-current has-disabled:cursor-not-allowed has-checked:bg-ink has-checked:text-label not-has-checked:text-ink-2 not-has-checked:hover:bg-liner not-has-checked:hover:text-ink`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onSelect}
        className="sr-only"
      />
      {children}
    </label>
  );
}

/** A boxed field holding a row of choices: native radios, so arrow keys move between them. */
export function Choices({
  legend,
  className = "",
  children,
}: {
  legend: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={`min-w-0 border-b border-ink pt-2.5 pb-2 last:border-b-0 lg:border-b-0 ${className}`}>
      <legend className="sr-only">{legend}</legend>
      <p aria-hidden className="field-name px-5 sm:px-8">
        {legend}
      </p>
      {/* On a phone the choices scroll sideways rather than wrap. */}
      <div className="mt-1 flex gap-1 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] sm:px-8 lg:px-6">
        {children}
      </div>
    </fieldset>
  );
}
