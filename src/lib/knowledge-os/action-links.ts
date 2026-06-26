// ============================================================================
// ProjectOps360° — Knowledge OS — Internal Action Link registry (client-safe)
// ============================================================================
// Hotfix (Isabella Action Links): make Isabella's answers navigable. When she
// explains a workflow she can include SAFE internal links to the relevant screen
// — but only links that are real and resolved here. URLs are NEVER invented:
//   • The service hands this exact, locale-resolved list to the model.
//   • The renderer only turns a markdown link into a real link if its href is in
//     this same allow-list. Anything else renders as plain text.
//
// Routing note: next-intl runs `localePrefix: "as-needed"` with defaultLocale
// "en", so English routes are UNPREFIXED (`/team`) and Spanish is prefixed
// (`/es/team`). `localizedPath` produces the actually-working route — emitting
// `/en/team` would just redirect. The route follows the UI locale; the answer
// language follows the conversation (handled in the service).
//
// Pure data + pure functions. No server imports, no business knowledge.
// ============================================================================

import type { Locale } from "@/types/database";
import type { GuideContext } from "./types";

/** Build a working internal path for a locale under `as-needed` prefixing. */
export function localizedPath(path: string, locale: Locale): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return locale === "en" ? clean : `/${locale}${clean}`;
}

export interface ActionDestination {
  /** Stable key (namespaced), e.g. "people.teamDirectory". */
  key: string;
  label: { en: string; es: string };
  /**
   * Base internal route (locale-agnostic, e.g. "/team"). When present the
   * destination is deep-linkable. Omit for actions that have no URL yet.
   */
  route?: string;
  /**
   * Button/action name to MENTION when there is no deep link yet (modals etc.).
   * Isabella names the button instead of fabricating a link.
   */
  action?: { en: string; es: string };
  /** Modules this destination is most relevant to (for ordering the list). */
  modules: string[];
}

/**
 * Known internal destinations. Add an entry here — never hardcode links in
 * prompt text. `route` omitted ⇒ not deep-linkable yet (mention the button).
 */
export const ACTION_DESTINATIONS: ActionDestination[] = [
  {
    key: "people.teamDirectory",
    label: { en: "People", es: "Personas" },
    route: "/team",
    modules: ["people_permissions", "teams", "organization"],
  },
  {
    key: "people.addPerson",
    label: { en: "Add person", es: "Agregar persona" },
    // No URL-addressable modal yet on /team — Isabella names the button.
    action: { en: "Create login", es: "Crear acceso" },
    modules: ["people_permissions"],
  },
  {
    key: "organization.members",
    label: { en: "Organization Members", es: "Miembros de la organización" },
    route: "/organization/members",
    modules: ["people_permissions", "organization"],
  },
  {
    key: "organization.teams",
    label: { en: "Company Teams", es: "Equipos de la empresa" },
    route: "/organization/teams",
    modules: ["teams", "organization"],
  },
  {
    key: "organization.billing",
    label: { en: "Billing & Plan", es: "Facturación y plan" },
    route: "/organization/billing",
    modules: ["billing", "organization"],
  },
  {
    key: "projects.list",
    label: { en: "Projects", es: "Proyectos" },
    route: "/projects",
    modules: ["projects"],
  },
  {
    key: "import.wizard",
    label: { en: "Project Import", es: "Importar proyecto" },
    route: "/import",
    modules: ["import", "projects"],
  },
  {
    key: "settings.workspace",
    label: { en: "Settings", es: "Configuración" },
    route: "/settings",
    modules: ["settings"],
  },
];

export interface ResolvedLink {
  key: string;
  label: string;
  /** Working internal href for the UI locale, or null when not deep-linkable. */
  href: string | null;
  /** Button name to mention when href is null. */
  action: string | null;
}

/**
 * Resolve destinations for the UI locale, ordered with the current module first.
 * Returns BOTH deep-linkable destinations (href set) and mention-only actions
 * (href null, action set) so Isabella can name buttons she cannot link yet.
 */
export function buildActionLinks(uiLocale: Locale, context: GuideContext): ResolvedLink[] {
  const k: "en" | "es" = uiLocale === "es" ? "es" : "en";
  const mod = context.module;
  const ranked = [...ACTION_DESTINATIONS].sort((a, b) => {
    const aHit = mod && a.modules.includes(mod) ? 0 : 1;
    const bHit = mod && b.modules.includes(mod) ? 0 : 1;
    return aHit - bHit;
  });
  return ranked.map((d) => ({
    key: d.key,
    label: d.label[k],
    href: d.route ? localizedPath(d.route, uiLocale) : null,
    action: d.action ? d.action[k] : null,
  }));
}

/** The set of hrefs we will allow the renderer to turn into real links. */
export function allowedHrefSet(links: ResolvedLink[]): Set<string> {
  const set = new Set<string>();
  for (const l of links) if (l.href) set.add(l.href);
  return set;
}

/**
 * Defense-in-depth href check used by the renderer. A link is allowed ONLY if it
 * is an internal app path that is also present in the resolved allow-list. This
 * blocks invented URLs, external links, protocol-relative (`//evil`), and any
 * `javascript:`/`data:`/`http(s):` scheme.
 */
export function isSafeInternalHref(href: string, allowed: Set<string>): boolean {
  if (!href) return false;
  const h = href.trim();
  if (!h.startsWith("/")) return false; // internal absolute paths only
  if (h.startsWith("//")) return false; // protocol-relative
  if (/[a-z][a-z0-9+.-]*:/i.test(h)) return false; // any scheme (defensive)
  return allowed.has(h);
}

/** Build the prompt block listing the links Isabella may use, verbatim. */
export function describeActionLinksForPrompt(links: ResolvedLink[]): string {
  const linkable = links.filter((l) => l.href);
  const mentionOnly = links.filter((l) => !l.href && l.action);
  const lines: string[] = [];
  if (linkable.length) {
    lines.push("Internal links you MAY use (use the markdown form [label](path) with the path EXACTLY as written; never invent a URL):");
    for (const l of linkable) lines.push(`- ${l.label} → ${l.href}`);
  }
  if (mentionOnly.length) {
    lines.push("Actions that cannot be linked yet — name the button, do NOT fabricate a link:");
    for (const l of mentionOnly) lines.push(`- "${l.action}" (${l.label})`);
  }
  return lines.join("\n") || "No internal links available for this screen.";
}
