"use client";

// ============================================================================
// Living Guide™ / Isabella — Safe answer renderer + guided action links
// ============================================================================
// Renders Isabella's answer with SAFE internal action links. Only a tiny,
// allow-listed subset of markdown is honored:
//   • [label](href) → a guided action pill ("Open <label>" / "Abrir <label>")
//     ONLY when href is in the allow-list (isSafeInternalHref). Clicking it
//     navigates AND notifies the host (onNavigate) so Isabella can say
//     "I'll take you there" and (in Guide mode) continue the walkthrough.
//     A non-allow-listed link is rendered as plain text — never followed.
//   • **bold** → <strong> (button names without a deep link yet).
// No external links, no raw HTML. Newlines preserved.
// ============================================================================

import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { isSafeInternalHref, type ResolvedLink, allowedHrefSet } from "@/lib/knowledge-os/action-links";

const TOKEN_SOURCE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;

export function AnswerText({
  text,
  links,
  locale = "en",
  onNavigate,
  linkClassName,
}: {
  text: string;
  links: ResolvedLink[];
  /** For the "Open"/"Abrir" verb on guided links. */
  locale?: "en" | "es";
  /** Called with the href when a guided link is clicked (host may guide/continue). */
  onNavigate?: (href: string, label: string) => void;
  /** Optional override for the pill classes (surface theme). */
  linkClassName?: string;
}) {
  const allowed = allowedHrefSet(links);
  const verb = locale === "es" ? "Abrir" : "Open";
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  const pill =
    linkClassName ??
    "mx-0.5 inline-flex items-center gap-1 rounded-full border border-brand-500/40 bg-brand-500/10 px-2 py-0.5 align-baseline text-[12px] font-semibold text-brand-700 transition hover:border-brand-500 hover:bg-brand-500/20 dark:text-brand-300";

  const token = new RegExp(TOKEN_SOURCE.source, "g");
  while ((m = token.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>);

    if (m[1] !== undefined && m[2] !== undefined) {
      const label = m[1];
      const href = m[2];
      if (isSafeInternalHref(href, allowed)) {
        out.push(
          <Link
            key={i++}
            href={href}
            onClick={() => onNavigate?.(href, label)}
            className={pill}
            title={`${verb} ${label}`}
          >
            <ArrowRight className="h-3 w-3" />
            {verb} {label}
          </Link>,
        );
      } else {
        out.push(<Fragment key={i++}>{label}</Fragment>);
      }
    } else if (m[3] !== undefined) {
      out.push(<strong key={i++} className="font-semibold">{m[3]}</strong>);
    }
    last = token.lastIndex;
  }
  if (last < text.length) out.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);

  return <span className="whitespace-pre-line">{out}</span>;
}
