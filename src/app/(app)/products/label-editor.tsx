"use client";

import { Pencil } from "lucide-react";
import { createContext, use, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Editor = {
  /** Swap the printed label for the form. */
  edit: () => void;
  /** Print the label again; `said` is announced, e.g. "Saved changes." */
  close: (said?: string) => void;
  /**
   * Once the label prints again, focus its way back in: Edit, or Restore on an archived
   * product. Call it when a form that may unmount itself is sent.
   */
  returnFocus: () => void;
};

const EditorContext = createContext<Editor | null>(null);

/** The label editor this form or button sits in, if any. */
export function useLabelEditor() {
  return use(EditorContext);
}

/**
 * Edits a product in place. The printed label (`children`) and its form (`form`) take
 * turns in the same spot on the sheet: no route, no history entry, so Back still means
 * "close". Switching fades the new side in (never on first render), the way a filter
 * change does.
 */
export function LabelEditor({ form, children }: { form: ReactNode; children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [switches, setSwitches] = useState(0);
  const [said, setSaid] = useState("");
  // Set while the label should take focus back: the element that asked, which the focus
  // must move away from (Restore asks, then gives way to Edit). Undefined when nobody asked.
  const [focusFrom, setFocusFrom] = useState<Element | null | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);

  // The product can stop being editable under the form: archiving it refreshes the
  // label with no form. Print the label again, which now carries Restore.
  if (editing && !form) {
    setEditing(false);
    setSwitches((n) => n + 1);
    setFocusFrom((from) => (from === undefined ? null : from));
    setSaid("Archived. It can be restored from its label.");
  }

  // Leaving the route keeps it alive, hidden in <Activity>; come back to the label.
  useLayoutEffect(() => () => setEditing(false), []);

  // When the label should take focus back: as soon as its control is here, which is
  // once the editor closes or the refreshed label arrives.
  useEffect(() => {
    if (focusFrom === undefined) return;
    const target = root.current?.querySelector<HTMLElement>("[data-return-focus]");
    if (!target || target === focusFrom) return;
    setFocusFrom(undefined);
    target.focus();
  }, [focusFrom, editing, children]);

  const switchTo = (next: boolean) => {
    setEditing(next);
    setSwitches((n) => n + 1);
  };
  const editor: Editor = {
    edit: () => {
      setSaid("");
      switchTo(true);
    },
    close: (message = "") => {
      setFocusFrom(document.activeElement);
      setSaid(message);
      switchTo(false);
    },
    returnFocus: () => setFocusFrom(document.activeElement),
  };

  return (
    <EditorContext value={editor}>
      <div ref={root} key={editing ? "form" : "label"} className={switches > 0 ? "swap-in" : undefined}>
        {editing ? form : children}
      </div>
      <p role="status" className="sr-only">
        {said}
      </p>
    </EditorContext>
  );
}

/** Opens the label's form. Sits in the header, beside the way out. */
export function EditButton() {
  const editor = useLabelEditor();
  if (!editor) return null;
  return (
    <button
      type="button"
      data-return-focus
      onClick={editor.edit}
      className="press-quiet -mt-3 flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-liner hover:text-ink"
    >
      <Pencil aria-hidden size={18} strokeWidth={2.25} />
      Edit
    </button>
  );
}
