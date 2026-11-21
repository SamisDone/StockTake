import type { ReactNode } from "react";
import type { Language } from "@/lib/i18n";

/**
 * Prints something in both languages and lets the reader's language, the `lang` the
 * app shell sets, show one. For the parts of a page that print before the request is
 * read (a page's title, the placeholders a page shows while its data loads): they
 * can't read the language cookie without making every navigation wait on the server,
 * so they arrive with the prefetched page in both languages instead. The hidden one is
 * `display: none`, so screen readers skip it too.
 */
export function EitherLanguage({
  children,
  inline = false,
}: {
  children: (language: Language) => ReactNode;
  /** Wrap in spans, for a heading or a line of text. */
  inline?: boolean;
}) {
  const Wrapper = inline ? "span" : "div";
  return (
    <>
      <Wrapper className="contents lang-bn:hidden">{children("en")}</Wrapper>
      <Wrapper className="hidden lang-bn:contents">{children("bn")}</Wrapper>
    </>
  );
}
