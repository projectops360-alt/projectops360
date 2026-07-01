// ============================================================================
// ProjectOps360° — Unified People Directory engine (PURE, no server imports)
// ============================================================================
// Deterministic merge/classification. Given the raw person rows from each source
// table, produce ONE de-duplicated directory. Email is the strong matching
// signal (case-insensitive); ambiguous rows are kept distinct, never guessed.
// ============================================================================

import type { DirectoryPerson, PersonType } from "./types";

/** Map an external_contacts.contact_type to a directory PersonType. */
export function classifyContactType(contactType: string | null | undefined): PersonType {
  switch ((contactType ?? "").toLowerCase()) {
    case "client":
      return "client";
    case "vendor":
    case "contractor":
    case "subcontractor":
      return "vendor";
    case "sponsor":
      return "sponsor";
    case "approver":
      return "approver";
    default:
      return "external_contact";
  }
}

/** Normalize an email for matching (lowercased, trimmed). Empty → null. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return e.length > 0 ? e : null;
}

// Raw shapes handed in by the service (only the fields we read).
export interface RawInternalUser { id: string; display_name: string | null; email?: string | null }
export interface RawExternalContact { id: string; name: string; email: string | null; company_name: string | null; contact_type: string | null }
export interface RawStakeholder { id: string; name: string; email: string | null }

export interface MergeInput {
  internal: RawInternalUser[];
  external: RawExternalContact[];
  stakeholders: RawStakeholder[];
}

function emptySources() {
  return { userId: null, externalContactId: null, stakeholderId: null, projectMemberId: null };
}

/**
 * Merge every source into one de-duplicated directory. People are matched by
 * normalized email; when two rows share an email they become ONE person (sources
 * merged, internal-user identity preferred for name/type). Rows without email
 * stay distinct (never merged by fuzzy name — no guessing).
 */
export function mergeDirectory(input: MergeInput): DirectoryPerson[] {
  const byEmail = new Map<string, DirectoryPerson>();
  const noEmail: DirectoryPerson[] = [];

  const add = (person: DirectoryPerson) => {
    if (person.email) {
      const existing = byEmail.get(person.email);
      if (existing) {
        // Merge sources; internal user wins identity + type.
        existing.sources = {
          userId: existing.sources.userId ?? person.sources.userId,
          externalContactId: existing.sources.externalContactId ?? person.sources.externalContactId,
          stakeholderId: existing.sources.stakeholderId ?? person.sources.stakeholderId,
          projectMemberId: existing.sources.projectMemberId ?? person.sources.projectMemberId,
        };
        if (person.isInternalUser && !existing.isInternalUser) {
          existing.isInternalUser = true;
          existing.type = "internal_user";
          if (person.displayName) existing.displayName = person.displayName;
        }
        existing.company = existing.company ?? person.company;
        return;
      }
      byEmail.set(person.email, { ...person });
    } else {
      noEmail.push(person);
    }
  };

  // Internal users first so they win identity on email collisions.
  for (const u of input.internal) {
    const email = normalizeEmail(u.email);
    add({
      key: email ?? `user:${u.id}`,
      displayName: (u.display_name ?? "").trim() || (email ?? "Unknown user"),
      email,
      type: "internal_user",
      company: null,
      isInternalUser: true,
      sources: { ...emptySources(), userId: u.id },
    });
  }
  for (const c of input.external) {
    const email = normalizeEmail(c.email);
    add({
      key: email ?? `contact:${c.id}`,
      displayName: (c.name ?? "").trim() || (email ?? "Unnamed contact"),
      email,
      type: classifyContactType(c.contact_type),
      company: (c.company_name ?? "").trim() || null,
      isInternalUser: false,
      sources: { ...emptySources(), externalContactId: c.id },
    });
  }
  for (const s of input.stakeholders) {
    const email = normalizeEmail(s.email);
    add({
      key: email ?? `stakeholder:${s.id}`,
      displayName: (s.name ?? "").trim() || (email ?? "Unnamed stakeholder"),
      email,
      type: "stakeholder",
      company: null,
      isInternalUser: false,
      sources: { ...emptySources(), stakeholderId: s.id },
    });
  }

  const all = [...byEmail.values(), ...noEmail];
  all.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return all;
}

/** Label for the "no person assigned yet" state — intentional, not an error. */
export function unassignedLabel(locale: "en" | "es"): string {
  return locale === "es" ? "Sin asignar" : "Unassigned";
}
