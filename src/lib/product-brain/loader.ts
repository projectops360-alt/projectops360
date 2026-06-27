import "server-only";

// ============================================================================
// ProjectOps360° — Product Intelligence™ document loader (server-only)
// ============================================================================
// Builds a navigable, searchable index from the Product Intelligence™ corpus.
//
// Content is sourced from a BUILD-GENERATED module (content.generated.ts), which
// the generator (scripts/generate-product-brain-content.mjs) produces from
// docs/product-brain/ on every build. This guarantees availability at runtime on
// Vercel without filesystem tracing of files outside src/. GitHub remains the
// version-control source of truth.
//
// SECURITY: this module is `server-only` and is only invoked AFTER the page has
// verified the caller's role (owner/admin). Content never reaches an
// unauthenticated client and is never served from an open API route. Document
// ids are validated to prevent unexpected lookups.
// ============================================================================

import { RAW_PRODUCT_BRAIN_DOCS } from "./content.generated";

const GITHUB_BASE =
  "https://github.com/projectops360-alt/projectops360/blob/master/docs/product-brain";

export interface ProductBrainDocMeta {
  /** Stable id = posix relative path without the .md extension (e.g. "adrs/ADR-001-..."). */
  id: string;
  title: string;
  /** Posix relative path with extension (e.g. "00-index.md"). */
  relPath: string;
  /** Grouping section for the navigation tree. */
  section: string;
  /** Sort order within a section (numeric filename prefix when present). */
  order: number;
  githubUrl: string;
}

export interface ProductBrainDoc extends ProductBrainDocMeta {
  content: string;
}

export interface ProductBrainSearchEntry extends ProductBrainDocMeta {
  searchText: string;
}

export const DEFAULT_DOC_ID = "00-index";

// ── id validation ─────────────────────────────────────────────────────────────

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;
function isSafeId(id: string): boolean {
  return ID_RE.test(id) && !id.includes("..") && !id.startsWith("/");
}

// ── derivation helpers ──────────────────────────────────────────────────────

function titleFromContent(content: string, fallbackId: string): string {
  for (const line of content.split("\n")) {
    const m = line.match(/^#\s+(.*\S)\s*$/);
    if (m) return m[1].replace(/\s*\(.*\)\s*$/, "").trim() || m[1].trim();
  }
  const base = fallbackId.split("/").pop() ?? fallbackId;
  return base.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function orderFromId(id: string): number {
  const base = id.split("/").pop() ?? id;
  const m = base.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 999;
}

/** Deterministic section grouping for the left navigation tree. */
function sectionForId(id: string): string {
  if (id.startsWith("adrs/")) return "ADRs";
  if (/README$/i.test(id)) return "Folders";
  if (id === "module-documentation-template") return "Modules";
  const base = id.split("/").pop() ?? id;
  const n = parseInt((base.match(/^(\d+)/) ?? [])[1] ?? "-1", 10);
  if (n >= 0 && n <= 4) return "Overview";
  if (n === 5 || n === 6) return "Registries";
  if (n === 7) return "ADRs";
  if (n >= 8 && n <= 11) return "Governance";
  if (n >= 12 && n <= 18) return "Strategy";
  if (n >= 19 && n <= 21) return "Foundation";
  if (n === 22) return "Modules";
  if (n === 23) return "Governance";
  if (n === 25) return "Governance";
  if (n === 26) return "Governance";
  if (n === 27) return "Governance";
  if (n === 28) return "Governance";
  if (n === 29) return "Governance";
  if (n === 30) return "Governance";
  if (n === 31) return "Strategy";
  return "Docs";
}

const SECTION_ORDER = [
  "Overview",
  "Foundation",
  "Modules",
  "Registries",
  "Governance",
  "Strategy",
  "ADRs",
  "Folders",
  "Docs",
];

export function sectionRank(section: string): number {
  const i = SECTION_ORDER.indexOf(section);
  return i === -1 ? SECTION_ORDER.length : i;
}

function toDoc(relPath: string, content: string): ProductBrainDoc {
  const id = relPath.replace(/\.md$/i, "");
  return {
    id,
    title: titleFromContent(content, id),
    relPath,
    section: sectionForId(id),
    order: orderFromId(id),
    githubUrl: `${GITHUB_BASE}/${relPath}`,
    content,
  };
}

function sortMetas<T extends ProductBrainDocMeta>(metas: T[]): T[] {
  return [...metas].sort((a, b) => {
    const sr = sectionRank(a.section) - sectionRank(b.section);
    if (sr !== 0) return sr;
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });
}

// ── public API (synchronous — content is bundled) ─────────────────────────────

function allDocs(): ProductBrainDoc[] {
  return RAW_PRODUCT_BRAIN_DOCS.map((d) => toDoc(d.relPath, d.content));
}

export function getAllProductBrainDocs(): ProductBrainDoc[] {
  return sortMetas(allDocs());
}

export function getProductBrainIndex(): ProductBrainDocMeta[] {
  return sortMetas(
    allDocs().map(({ content: _content, ...meta }) => {
      void _content;
      return meta;
    }),
  );
}

export function getProductBrainSearchIndex(): ProductBrainSearchEntry[] {
  return sortMetas(
    allDocs().map((d) => ({
      id: d.id,
      title: d.title,
      relPath: d.relPath,
      section: d.section,
      order: d.order,
      githubUrl: d.githubUrl,
      searchText: `${d.id}\n${d.content}`.toLowerCase(),
    })),
  );
}

export function getProductBrainDoc(id: string): ProductBrainDoc | null {
  if (!isSafeId(id)) return null;
  return allDocs().find((d) => d.id === id) ?? null;
}
