// ============================================================================
// ProjectOps360° — Time Tracking · Who effort can be attributed to (pure)
// ============================================================================
// Building this list has exactly two ways to go wrong, and the product hit both:
//
//   1. Reading the workspace from `profiles.organization_id`. That column is a
//      profile's HOME org, not every org the person works in — the same trap
//      REG-038 already documented for report owners. In the Agro project seven
//      of eight members have a different home org, so the query returned ONE
//      row (the owner) and the picker looked broken.
//
//   2. Offering "Myself" as its own entry alongside the same person's real row,
//      so one human appeared twice as if they were two resources.
//
// The membership question is therefore answered by PROJECT membership, and the
// caller is folded into the same list rather than bolted on beside it.
// ============================================================================

/** One option in the "Whose effort" picker. */
export interface TimeLogPerson {
  /** auth user id — what `subtask_time_entries.user_id` stores. */
  id: string;
  name: string;
  /** Shown as secondary information. Null when it could not be resolved. */
  email: string | null;
  /** The signed-in user. Rendered once, labelled, and sorted first. */
  isSelf: boolean;
  /** Their role on this project, when it is known. Context, never identity. */
  projectRole: string | null;
}

export interface RawProjectMember {
  user_id: string | null;
  display_name: string | null;
  project_role: string | null;
  status: string | null;
}

/**
 * The people effort may be attributed to on one project.
 *
 * The caller is ALWAYS included, even when they hold no project-team row: an
 * org owner or admin can open any project in their organization, and a picker
 * that cannot offer the person using it could not log their own time. That is
 * not a special case bolted on — it is the same list, with one guaranteed
 * member.
 *
 * Rows without a `user_id` are dropped. They are role placeholders or
 * login-less contacts, and `subtask_time_entries.user_id` is a NOT NULL foreign
 * key to `auth.users`, so there is nothing valid to store for them. They are
 * reported separately rather than silently rendered as unselectable noise.
 */
export function buildTimeLogPeople(input: {
  members: RawProjectMember[];
  /** Resolved by id, never by org — see REG-038. */
  nameById: Map<string, string>;
  emailById: Map<string, string>;
  selfId: string;
  selfName: string;
  selfEmail: string | null;
}): TimeLogPerson[] {
  const byId = new Map<string, TimeLogPerson>();

  const put = (
    id: string,
    name: string | null,
    role: string | null,
    isSelf: boolean,
  ): void => {
    const existing = byId.get(id);
    if (existing) {
      // Same human, second row (a person may hold several project roles). Keep
      // the first real name and the first known role rather than duplicating.
      if (!existing.name && name) existing.name = name.trim();
      if (!existing.projectRole && role) existing.projectRole = role;
      return;
    }
    byId.set(id, {
      id,
      name: (name ?? "").trim() || input.nameById.get(id) || "",
      email: input.emailById.get(id) ?? null,
      isSelf,
      projectRole: role,
    });
  };

  // Self first, so a later membership row can only enrich the entry — never
  // create a second one for the same person.
  put(input.selfId, input.selfName, null, true);
  if (input.selfEmail && !byId.get(input.selfId)!.email) {
    byId.get(input.selfId)!.email = input.selfEmail;
  }

  for (const m of input.members) {
    if (!m.user_id) continue; // no login → nothing storable in user_id
    if (m.status === "removed") continue;
    put(m.user_id, m.display_name, m.project_role, m.user_id === input.selfId);
  }

  // A person with no resolvable name is still selectable — dropping a valid
  // member because their profile is thin would hide real people.
  for (const person of byId.values()) {
    if (!person.name) person.name = input.emailById.get(person.id) ?? person.id.slice(0, 8);
  }

  return [...byId.values()].sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/** Members that cannot receive time under the current model, for reporting. */
export function membersWithoutLogin(members: RawProjectMember[]): string[] {
  return members
    .filter((m) => !m.user_id && m.status !== "removed")
    .map((m) => (m.display_name ?? "").trim() || "(sin nombre)");
}

/** Above this many options the picker needs a search box to stay usable. */
export const PEOPLE_SEARCH_THRESHOLD = 8;

/** Case- and accent-insensitive filter over name, email and role. */
export function filterPeople(people: TimeLogPerson[], query: string): TimeLogPerson[] {
  const q = normalize(query);
  if (!q) return people;
  return people.filter((p) =>
    normalize(`${p.name} ${p.email ?? ""} ${p.projectRole ?? ""}`).includes(q),
  );
}

/** Same accent-stripping the report filters use (REG-038), same spelling. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .trim();
}
