import type { ReactNode } from "react";
import type { Ref } from "@/assistant/tools";
import { NAV_FORWARD } from "@/components/transitions";
import { type Inline, localProse, parseAnswer, refHref } from "@/lib/answer-text";
import type { Language } from "@/lib/i18n";
import { IntentLink } from "@/components/intent-link";

/**
 * An answer, printed as prose in the reader's digits. Records it names link to their own
 * pages; SKUs and PO numbers keep the machine voice.
 */
export function AnswerText({ text, refs, language }: { text: string; refs: Ref[]; language: Language }) {
  const inlines = (content: Inline[]) => printed(content, language);
  return (
    <div className="max-w-prose space-y-3 leading-relaxed">
      {parseAnswer(text, refs).map((block, i) =>
        block.type === "paragraph" ? (
          <p key={i}>{inlines(block.content)}</p>
        ) : block.ordered ? (
          <ol key={i} className="list-decimal space-y-1 pl-6 marker:text-ink-2">
            {block.items.map((item, j) => (
              <li key={j}>{inlines(item)}</li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-6 marker:text-ink-2">
            {block.items.map((item, j) => (
              <li key={j}>{inlines(item)}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

function printed(content: Inline[], language: Language): ReactNode[] {
  return content.map((part, i) => {
    if (part.type === "text") return localProse(part.text, language);
    if (part.type === "bold") return <strong key={i}>{printed(part.children, language)}</strong>;
    const machine = part.ref.code !== undefined && part.text.toLowerCase() === part.ref.code.toLowerCase();
    // A product opens in the drawer over the conversation, which keeps its place; an
    // order or a supplier is a page of its own, deeper in.
    const product = part.ref.kind === "product";
    return (
      <IntentLink
        key={i}
        href={refHref(part.ref)}
        scroll={product ? false : undefined}
        transitionTypes={product ? undefined : NAV_FORWARD}
        className={`font-semibold underline decoration-ink-3 underline-offset-4 transition-colors duration-150 hover:decoration-ink ${
          machine ? "font-mono text-[0.875em] font-normal" : ""
        }`}
      >
        {machine ? part.text : localProse(part.text, language)}
      </IntentLink>
    );
  });
}
