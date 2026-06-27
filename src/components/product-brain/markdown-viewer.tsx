"use client";

// ============================================================================
// ProjectOps360° — Product Intelligence™ markdown viewer
// ============================================================================
// Safe markdown rendering (GFM tables/lists/code) with sanitization. Internal
// links between Product Intelligence docs are intercepted and navigated INSIDE
// the Center (never sending the user to a raw file). External links open in a
// new tab.
// ============================================================================

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

// ── Internal-link resolution (relative to the current doc) ────────────────────

function posixDirname(id: string): string {
  const i = id.lastIndexOf("/");
  return i === -1 ? "" : id.slice(0, i);
}

function normalizeSegments(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out;
}

/**
 * Resolve a markdown link href to an internal doc id, or null if it is external
 * / an anchor / not a markdown doc. `currentId` is the id of the doc being viewed.
 */
export function resolveInternalDocId(
  currentId: string,
  href: string | undefined,
): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (
    /^(https?:|mailto:|tel:)/i.test(trimmed) ||
    trimmed.startsWith("#")
  ) {
    return null;
  }
  // Strip any anchor; only resolve the path portion.
  const pathPart = trimmed.split("#")[0];
  if (!pathPart) return null;
  // Only treat .md targets (or extension-less relative refs) as internal docs.
  const isMd = /\.md$/i.test(pathPart);
  const looksRelative = !pathPart.includes("://");
  if (!isMd && !looksRelative) return null;

  const base = pathPart.startsWith("/")
    ? normalizeSegments(pathPart.slice(1).split("/"))
    : normalizeSegments(`${posixDirname(currentId)}/${pathPart}`.split("/"));
  const joined = base.join("/").replace(/\.md$/i, "");
  return joined || null;
}

// ── Styled element overrides (no typography plugin; corporate styling) ────────

const components: import("react-markdown").Components = {
  h1: ({ children }) => (
    <h1 className="mt-2 mb-4 text-2xl font-bold tracking-tight text-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 mb-3 border-b border-border pb-1.5 text-xl font-semibold text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 mb-2 text-base font-semibold text-foreground">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h4>
  ),
  p: ({ children }) => <p className="my-3 text-sm leading-relaxed text-foreground/90">{children}</p>,
  ul: ({ children }) => <ul className="my-3 ml-5 list-disc space-y-1.5 text-sm text-foreground/90">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 ml-5 list-decimal space-y-1.5 text-sm text-foreground/90">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-brand-500/60 bg-muted/40 px-4 py-2 text-sm italic text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  code: ({ className, children }) => {
    const isBlock = (className ?? "").includes("language-");
    if (isBlock) {
      return <code className={`${className ?? ""} font-mono text-[12.5px]`}>{children}</code>;
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 text-foreground">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-3 py-2 align-top text-foreground/90">{children}</td>
  ),
};

interface MarkdownViewerProps {
  content: string;
  currentId: string;
  /** Navigate to another Product Intelligence doc (internal link click). */
  onNavigate: (id: string) => void;
}

function MarkdownViewerComponent({ content, currentId, onNavigate }: MarkdownViewerProps) {
  const linkComponent: import("react-markdown").Components["a"] = ({ href, children }) => {
    const internal = resolveInternalDocId(currentId, href);
    if (internal) {
      return (
        <a
          href={`?doc=${encodeURIComponent(internal)}`}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(internal);
          }}
          className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
        >
          {children}
        </a>
      );
    }
    // Anchor (same-page) → keep default; external → new tab.
    const isAnchor = href?.startsWith("#");
    return (
      <a
        href={href}
        {...(isAnchor ? {} : { target: "_blank", rel: "noopener noreferrer" })}
        className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
      >
        {children}
      </a>
    );
  };

  return (
    <div className="max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{ ...components, a: linkComponent }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownViewer = memo(MarkdownViewerComponent);
MarkdownViewer.displayName = "MarkdownViewer";
