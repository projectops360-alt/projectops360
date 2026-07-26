"use client";

// ============================================================================
// Accessible modal dialog
// ============================================================================
// The repo had three hand-rolled overlays before this one (the subtask form,
// the navigator drawer, the executive drawer) and none of them trapped focus,
// closed on Escape, or gave focus back to the control that opened them. Rather
// than add a fourth partial implementation, this is one primitive that does the
// four things a dialog has to do:
//
//   1. `role="dialog"` + `aria-modal="true"` + a labelled title, so a screen
//      reader announces it as a dialog and not as more page content.
//   2. Escape closes it.
//   3. Focus is trapped inside: Tab from the last control wraps to the first,
//      Shift+Tab from the first wraps to the last. Without this, tabbing walks
//      invisibly into the page behind the overlay.
//   4. Focus returns to the element that opened the dialog on close. Losing
//      focus to <body> strands keyboard users at the top of the document.
//
// Deliberately NOT a portal. The dialog renders inside the graph shell's own
// stacking context, and the shell already establishes the z-layers the canvas
// overlays rely on. A portal to document.body would escape those and force the
// z-index of every graph overlay to be re-reasoned.
// ============================================================================

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Elements that can hold focus. Used by the tab trap to find its bounds. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional sub-heading, wired to aria-describedby. */
  description?: string;
  /** Sticky action bar at the bottom. Kept out of the scrolling body. */
  footer?: ReactNode;
  children: ReactNode;
  /** Accessible name for the close button. */
  closeLabel: string;
  /**
   * Max width. The whole reason this component exists is that a 260px rail is
   * too cramped to build a scenario in, so the default is generous.
   */
  widthClassName?: string;
}

export function ModalDialog({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  closeLabel,
  widthClassName = "max-w-4xl",
}: ModalDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Remembered at open time, restored at close time. Reading it during the
  // close would be too late: by then focus has usually already moved.
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Move focus into the dialog so the very next Tab stays inside it.
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? panel)?.focus();

    return () => {
      // Restore focus to whatever opened the dialog. Guarded because the
      // trigger can legitimately be gone (e.g. it was conditionally rendered).
      const trigger = triggerRef.current;
      if (trigger && document.contains(trigger)) trigger.focus();
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, which is what makes it a trap rather than a hint.
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
      // Clicking the backdrop closes; clicks inside the panel must not, hence
      // the check against the event target rather than a stopPropagation on
      // the panel (which would swallow legitimate bubbling inside the form).
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`flex max-h-[92vh] w-full ${widthClassName} flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl outline-none`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-extrabold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-0.5 text-xs text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        {/* Only the body scrolls, so the action bar never scrolls out of reach
            on a long scenario. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
