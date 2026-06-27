import "server-only";

// ============================================================================
// ProjectOps360° — Product Intelligence™ document loader (server-only)
// ============================================================================
// Reads the Product Intelligence™ markdown from `docs/product-brain/` at request
// time and builds a navigable, searchable index. The folder lives outside `src/`,
// so `next.config.ts` traces it into this route's function bundle
// (`outputFileTracingIncludes`).
//
// SECURITY: this module is `server-only` and is only ever invoked AFTER the page
// has verified the caller's role (owner/admin). Document content never reaches an
// unauthenticated client and is never served from an open API route. Document ids
// are validated to prevent path traversal outside the docs root.
// ============================================================================

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "docs", "product-brain");
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
  /** Lowercased plain-text content for client-side search. */
  searchText: string;
}

// ── id validation (anti path-traversal) ──────────────────────────────────────

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;

function isSafeId(id: string): boolean {
  if (!ID_RE.test(id)) return false;
  if (id.includes("..")) return false;
  if (id.startsWith("/")) return false;
  return true;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function titleFromContent(content: string, fallbackId: string): string {
  for (const line of content.split("\n")) {
    const m = line.match(/^#\s+(.*\S)\s*$/);
    if (m) return m[1].replace(/\s*\(.*\)\s*$/, "").trim() || m[1].trim();
  }
  // Fallback: prettify the file name.
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
  const base = id.split("/").pop() ?? id;
  const n = parseInt((base.match(/^(\d+)/) ?? [])[1] ?? "-1", 10);
  if (n === 0) return "Overview";
  if (n >= 1 && n <= 4) return "Overview";
  if (n === 5 || n === 6) return "Registries";
  if (n === 7) return "ADRs";
  if (n >= 8 && n <= 11) return "Governance";
  if (n >= 12 && n <= 18) return "Strategy";
  if (n >= 19 && n <= 21) return "Foundation";
  return "Docs";
}

const SECTION_ORDER = [
  "Overview",
  "Foundation",
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

// ── directory walk ──────────────────────────────────────────────────────────

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(abs)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(abs);
    }
  }
  return out;
}

function toId(abs: string): string {
  const rel = path.relative(ROOT, abs).split(path.sep).join("/");
  return rel.replace(/\.md$/i, "");
}

// ── public API ────────────────────────────────────────────────────────────────

/** Lightweight index (no content) — for the navigation tree. */
export async function getProductBrainIndex(): Promise<ProductBrainDocMeta[]> {
  const files = await walk(ROOT);
  const metas = await Promise.all(
    files.map(async (abs) => {
      const id = toId(abs);
      const relPath = path.relative(ROOT, abs).split(path.sep).join("/");
      let content = "";
      try {
        content = await fs.readFile(abs, "utf8");
      } catch {
        /* unreadable file — fall back to filename title */
      }
      const meta: ProductBrainDocMeta = {
        id,
        title: titleFromContent(content, id),
        relPath,
        section: sectionForId(id),
        order: orderFromId(id),
        githubUrl: `${GITHUB_BASE}/${relPath}`,
      };
      return meta;
    }),
  );
  return sortMetas(metas);
}

/** Full search index (includes plain-text content). Only sent to authorized clients. */
export async function getProductBrainSearchIndex(): Promise<ProductBrainSearchEntry[]> {
  const files = await walk(ROOT);
  const entries = await Promise.all(
    files.map(async (abs) => {
      const id = toId(abs);
      const relPath = path.relative(ROOT, abs).split(path.sep).join("/");
      let content = "";
      try {
        content = await fs.readFile(abs, "utf8");
      } catch {
        /* ignore */
      }
      const entry: ProductBrainSearchEntry = {
        id,
        title: titleFromContent(content, id),
        relPath,
        section: sectionForId(id),
        order: orderFromId(id),
        githubUrl: `${GITHUB_BASE}/${relPath}`,
        searchText: `${id}\n${content}`.toLowerCase(),
      };
      return entry;
    }),
  );
  return sortMetas(entries);
}

/**
 * Full docs WITH content, sorted. Sent only to authorized clients so the Center
 * can navigate + full-text search instantly (the corpus is small). Access is
 * gated by the page BEFORE this is called.
 */
export async function getAllProductBrainDocs(): Promise<ProductBrainDoc[]> {
  const files = await walk(ROOT);
  const docs = await Promise.all(
    files.map(async (abs) => {
      const id = toId(abs);
      const relPath = path.relative(ROOT, abs).split(path.sep).join("/");
      let content = "";
      try {
        content = await fs.readFile(abs, "utf8");
      } catch {
        /* ignore unreadable file */
      }
      const d: ProductBrainDoc = {
        id,
        title: titleFromContent(content, id),
        relPath,
        section: sectionForId(id),
        order: orderFromId(id),
        githubUrl: `${GITHUB_BASE}/${relPath}`,
        content,
      };
      return d;
    }),
  );
  return sortMetas(docs);
}

/** Read a single document by id. Returns null when not found or id is unsafe. */
export async function getProductBrainDoc(id: string): Promise<ProductBrainDoc | null> {
  if (!isSafeId(id)) return null;
  const abs = path.join(ROOT, `${id}.md`);
  // Defense in depth: ensure the resolved path stays inside ROOT.
  const resolved = path.resolve(abs);
  if (resolved !== abs || !resolved.startsWith(path.resolve(ROOT))) return null;
  let content: string;
  try {
    content = await fs.readFile(abs, "utf8");
  } catch {
    return null;
  }
  const relPath = `${id}.md`;
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

export const DEFAULT_DOC_ID = "00-index";

function sortMetas<T extends ProductBrainDocMeta>(metas: T[]): T[] {
  return [...metas].sort((a, b) => {
    const sr = sectionRank(a.section) - sectionRank(b.section);
    if (sr !== 0) return sr;
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });
}
