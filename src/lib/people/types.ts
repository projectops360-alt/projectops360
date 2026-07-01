// ============================================================================
// ProjectOps360° — Unified People Directory (CAP-044 / PD-014) — types
// ============================================================================
// People are NOT module-specific data. The directory is a READ-ONLY PROJECTION
// that unifies the person records already stored across the product — internal
// users (profiles + organization_members), external contacts (external_contacts),
// stakeholders (stakeholders) — into ONE typed identity so any assignment screen
// can "select an existing person" instead of retyping. It never forks the truth
// into a parallel table (CLAUDE.md rule #5); the canonical project assignment
// model remains `project_team_members`.
//
// Pure types, no server imports — safe to import from a client component.
// ============================================================================

/** What kind of person a directory entry represents. */
export type PersonType =
  | "internal_user"
  | "external_contact"
  | "stakeholder"
  | "vendor"
  | "client"
  | "sponsor"
  | "approver"
  | "unknown";

/** Which source table(s) contributed to a unified person. */
export interface PersonSourceRefs {
  /** auth user id, when this person is (or links to) an internal user. */
  userId: string | null;
  /** external_contacts.id, when present. */
  externalContactId: string | null;
  /** stakeholders.id, when present. */
  stakeholderId: string | null;
  /** project_team_members.id, when this person is assigned to the project. */
  projectMemberId: string | null;
}

/** One unified person in the directory. */
export interface DirectoryPerson {
  /** Stable de-dupe key (normalized email when present, else source id). */
  key: string;
  displayName: string;
  email: string | null;
  type: PersonType;
  company: string | null;
  /** True when this person is an internal workspace user. */
  isInternalUser: boolean;
  sources: PersonSourceRefs;
}

/** A person's assignment on a project (projection over project_team_members). */
export interface ProjectPersonAssignment {
  personKey: string;
  displayName: string;
  email: string | null;
  participationType: string | null; // member_type
  projectRole: string | null;
  governanceRole: string | null;
  responsibility: string | null;
  authorityLevel: string | null;
  isActive: boolean;
}

/** Result wrapper for the directory service. */
export type PeopleDirectoryResult =
  | { ok: true; people: DirectoryPerson[] }
  | { ok: false; reason: "not_authorized" | "unavailable" };
