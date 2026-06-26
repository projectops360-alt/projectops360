"use client";

// ============================================================================
// Living Guide™ / Isabella — Safe answer renderer
// ============================================================================
// Renders Isabella's answer text with SAFE internal action links. Only a tiny,
// allow-listed subset of markdown is honored:
//   • [label](href) → a real internal link ONLY when href is in the allow-list
//     (isSafeInternalHref). Otherwise the label is rendered as plain text — the
//     link is dropped, never followed. No external links, no raw HTML.
//   • **bold** → <strong> (used for button names that aren't deep-linkable yet).
// Newlines are preserved. This is intentionally not a full markdown engine —
// keeping the surface tiny keeps it safe and dependency-free.
// ============================================================================

import { Fragment } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { isSafeInternalHref, type ResolvedLink, allowedHrefSet } from "@/lib/knowledge-os/action-links";

// Allow-listed markdown: [label](href) and **bold**. A fresh instance is created
// per render so there is no shared mutable `lastIndex` across components.
const TOKEN_SOURCE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;

export function AnswerText({
  text,
  links,
  linkClassName,
}: {
  text: string;
  links: ResolvedLink[];
  /** Tailwind classes for the rendered link (theme differs by surface). */
  linkClassName?: string;
}) {
  const allowed = allowedHrefSet(links);
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  const token = new RegExp(TOKEN_SOURCE.source, "g");
  while ((m = token.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>);

    if (m[1] !== undefined && m[2] !== undefined) {
      // [label](href)
      const label = m[1];
      const href = m[2];
      if (isSafeInternalHref(href, allowed)) {
        out.push(
          <Link
            key={i++}
            href={href}
            className={
              linkClassName ??
              "inline-flex items-center gap-0.5 font-medium text-brand-600 underline decoration-brand-400/40 underline-offset-2 hover:text-brand-700 dark:text-brand-400"
            }
          >
            {label}
            <ArrowUpRight className="h-3 w-3" />
          </Link>,
        );
      } else {
        // Not allow-listed → drop the link, keep the label as plain text.
        out.push(<Fragment key={i++}>{label}</Fragment>);
      }
    } else if (m[3] !== undefined) {
      // **bold**
      out.push(<strong key={i++} className="font-semibold">{m[3]}</strong>);
    }
    last = token.lastIndex;
  }
  if (last < text.length) out.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);

  return <span className="whitespace-pre-line">{out}</span>;
}
