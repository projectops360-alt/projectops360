-- ============================================================================
-- EKI Macrophase 1 — knowledge scope, governance vocabulary, canonical relations
-- ============================================================================
-- Implements ADR-013, ADR-014 and ADR-015. No engine, no lifecycle beyond what
-- already exists, no findings, no evidence collection — those are later phases.
--
-- ADR-013: governance knowledge is scoped explicitly. `organization_id` stays
-- NOT NULL at every scope, so tenant isolation is untouched and no existing RLS
-- policy changes. `project_id` becomes nullable but its nullability is GOVERNED
-- by a constraint tied to `scope_type`, so a NULL is only reachable when the
-- scope says so.
--
-- ORDER MATTERS. The constraints are added BEFORE the NOT NULL is relaxed, so no
-- ungoverned NULL can ever be written. Reversing the order opens a window in
-- which the rejected "nullable project_id" semantics are representable, and rows
-- written in that window would later need interpretation.
--
-- The child tables reference the parent through a composite key that includes
-- `project_id`. Postgres foreign keys default to MATCH SIMPLE, under which a
-- composite FK is SKIPPED ENTIRELY when any column is NULL. Relaxing project_id
-- without acting would therefore silently remove referential integrity from
-- every organization-scoped child row. Each child gains a second FK keyed on
-- (knowledge_object_id, organization_id, scope_type) — all NOT NULL — which is
-- always enforced. The original FK is retained: it still binds project-scoped
-- rows to the same project.
-- ============================================================================

-- ── 1. Scope column ─────────────────────────────────────────────────────────
-- Default 'project' is correct for every existing row by construction: the
-- column it replaces has always been NOT NULL. The backfill is therefore a
-- no-op and requires no interpretation.

alter table public.project_knowledge_objects
  add column scope_type text not null default 'project'
  check (scope_type in ('organization', 'project'));

alter table public.project_knowledge_object_versions
  add column scope_type text not null default 'project'
  check (scope_type in ('organization', 'project'));

alter table public.project_knowledge_object_evidence
  add column scope_type text not null default 'project'
  check (scope_type in ('organization', 'project'));

alter table public.project_knowledge_object_transitions
  add column scope_type text not null default 'project'
  check (scope_type in ('organization', 'project'));

-- ── 2. Ownership ────────────────────────────────────────────────────────────
-- Ownership is an attribute, not an object (EKI gate §2.1). Exactly one
-- accountable person, never a team.

alter table public.project_knowledge_objects
  add column owner_user_id uuid references auth.users(id) on delete set null;

-- ── 3. Scope coherence, enforced by the database ────────────────────────────
-- This is the constraint that separates the accepted decision from the rejected
-- "nullable project_id" option: a NULL project is only reachable when the scope
-- explicitly says organization. Any other combination is rejected.

alter table public.project_knowledge_objects
  add constraint project_knowledge_objects_scope_coherent
  check (
    (scope_type = 'project' and project_id is not null)
    or (scope_type = 'organization' and project_id is null)
  ) not valid;

alter table public.project_knowledge_object_versions
  add constraint project_knowledge_versions_scope_coherent
  check (
    (scope_type = 'project' and project_id is not null)
    or (scope_type = 'organization' and project_id is null)
  ) not valid;

alter table public.project_knowledge_object_evidence
  add constraint project_knowledge_evidence_scope_coherent
  check (
    (scope_type = 'project' and project_id is not null)
    or (scope_type = 'organization' and project_id is null)
  ) not valid;

alter table public.project_knowledge_object_transitions
  add constraint project_knowledge_transitions_scope_coherent
  check (
    (scope_type = 'project' and project_id is not null)
    or (scope_type = 'organization' and project_id is null)
  ) not valid;

alter table public.project_knowledge_objects validate constraint project_knowledge_objects_scope_coherent;
alter table public.project_knowledge_object_versions validate constraint project_knowledge_versions_scope_coherent;
alter table public.project_knowledge_object_evidence validate constraint project_knowledge_evidence_scope_coherent;
alter table public.project_knowledge_object_transitions validate constraint project_knowledge_transitions_scope_coherent;

-- ── 4. Always-enforced parent linkage ───────────────────────────────────────
-- See the header note on MATCH SIMPLE. Every column in this key is NOT NULL, so
-- the constraint is enforced for organization-scoped rows too. Including
-- scope_type also guarantees a child cannot disagree with its parent about scope.

alter table public.project_knowledge_objects
  add constraint project_knowledge_objects_scope_key unique (id, organization_id, scope_type);

alter table public.project_knowledge_object_versions
  add constraint project_knowledge_versions_parent_scope_fk
  foreign key (knowledge_object_id, organization_id, scope_type)
  references public.project_knowledge_objects(id, organization_id, scope_type) on delete cascade;

alter table public.project_knowledge_object_evidence
  add constraint project_knowledge_evidence_parent_scope_fk
  foreign key (knowledge_object_id, organization_id, scope_type)
  references public.project_knowledge_objects(id, organization_id, scope_type) on delete cascade;

alter table public.project_knowledge_object_transitions
  add constraint project_knowledge_transitions_parent_scope_fk
  foreign key (knowledge_object_id, organization_id, scope_type)
  references public.project_knowledge_objects(id, organization_id, scope_type) on delete cascade;

-- ── 5. Relax project_id, now that scope governs it ──────────────────────────

alter table public.project_knowledge_objects alter column project_id drop not null;
alter table public.project_knowledge_object_versions alter column project_id drop not null;
alter table public.project_knowledge_object_evidence alter column project_id drop not null;
alter table public.project_knowledge_object_transitions alter column project_id drop not null;

-- ── 6. Idempotency at organization scope ────────────────────────────────────
-- `unique (project_id, idempotency_key)` stops enforcing anything once
-- project_id is NULL, because NULLs are distinct. Organization-scoped objects
-- need their own uniqueness or the create RPC's idempotency guarantee silently
-- disappears at that scope.

create unique index project_knowledge_objects_org_idempotency_idx
  on public.project_knowledge_objects (organization_id, idempotency_key)
  where scope_type = 'organization';

-- ── 7. Governance vocabulary (ADR-014) ──────────────────────────────────────
-- The existing vocabulary is EXTENDED, never replaced. `finding` is deliberately
-- reused rather than duplicated as a governance type: a finding is a finding,
-- and scope plus relationships distinguish governance from delivery. A second
-- finding type would be the start of the divergence ADR-014 exists to prevent.
--
-- Normative kinds (Principle, Policy, Standard, Obligation) are NOT here: they
-- live in knowledge_packages per ADR-015, because they have no lifecycle, no
-- evidence and no owner.
--
-- `evidence_record` is NOT here either: it is a projection over the canonical
-- event log, not a stored object. Persisting it would create the copy that
-- Charter P5 forbids — a copy is not tamper-evident because its original was.

alter table public.project_knowledge_objects
  drop constraint project_knowledge_objects_knowledge_type_check;

alter table public.project_knowledge_objects
  add constraint project_knowledge_objects_knowledge_type_check
  check (knowledge_type in (
    -- delivery learning (unchanged)
    'finding', 'pattern', 'best_practice', 'lesson_learned',
    'recommendation', 'prediction', 'root_cause',
    -- governance instance layer
    'control', 'control_mapping', 'evidence_binding', 'risk',
    'exception', 'asset', 'vendor', 'trust_boundary',
    -- governance observed layer
    'assessment'
  ));

-- ── 8. Canonical relations (EKI §4) ─────────────────────────────────────────
-- One graph. Endpoints are knowledge objects (instance and observed layers) or
-- knowledge packages (the normative layer, ADR-015), so a relation such as
-- `satisfies` can bind a Control object to an Obligation package.
--
-- Relations to PEOPLE are deliberately absent. `owned_by` is the owner_user_id
-- column added above, `approved_by` is the actor on a transition, `generated_by`
-- is provenance. Modelling ownership as an edge would add a join to every
-- ownership question and a lifecycle to a fact (EKI gate §2.1).

create table public.project_knowledge_relations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope_type text not null check (scope_type in ('organization', 'project')),
  project_id uuid references public.projects(id) on delete cascade,

  relation_type text not null check (relation_type in (
    'derived_from', 'implements', 'governed_by', 'satisfies', 'maps_to',
    'applies_to', 'tested_by', 'failed_by', 'mitigates', 'threatens',
    'accepted_as_exception_by', 'depends_on', 'supports', 'contradicts',
    'supersedes'
  )),

  source_endpoint_kind text not null check (source_endpoint_kind in ('knowledge_object', 'knowledge_package')),
  source_object_id uuid,
  source_package_id uuid references public.knowledge_packages(id) on delete cascade,
  source_version_no integer check (source_version_no is null or source_version_no > 0),

  target_endpoint_kind text not null check (target_endpoint_kind in ('knowledge_object', 'knowledge_package')),
  target_object_id uuid,
  target_package_id uuid references public.knowledge_packages(id) on delete cascade,
  target_version_no integer check (target_version_no is null or target_version_no > 0),

  -- How the relation is known. `inferred` may never change a compliance status
  -- (EKI gate §3.1); that rule is enforced by the consuming engines, and the
  -- basis is recorded here so it can be.
  basis text not null default 'declared' check (basis in ('declared', 'derived', 'observed', 'inferred')),

  -- Contradictions are first-class and are never deleted. Most compliance
  -- systems cannot represent an inconsistency, so they resolve it by deleting
  -- one side, and the knowledge survives as neither a record nor a decision.
  resolution_status text not null default 'unresolved'
    check (resolution_status in ('unresolved', 'accepted', 'resolved')),
  resolution_rationale text,

  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,

  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_knowledge_relations_scope_coherent check (
    (scope_type = 'project' and project_id is not null)
    or (scope_type = 'organization' and project_id is null)
  ),

  -- Exactly one endpoint reference per side, matching its declared kind.
  constraint project_knowledge_relations_source_endpoint check (
    (source_endpoint_kind = 'knowledge_object' and source_object_id is not null and source_package_id is null)
    or (source_endpoint_kind = 'knowledge_package' and source_package_id is not null and source_object_id is null)
  ),
  constraint project_knowledge_relations_target_endpoint check (
    (target_endpoint_kind = 'knowledge_object' and target_object_id is not null and target_package_id is null)
    or (target_endpoint_kind = 'knowledge_package' and target_package_id is not null and target_object_id is null)
  ),

  -- No self-relation. An object cannot supersede or contradict itself.
  constraint project_knowledge_relations_no_self check (
    source_object_id is distinct from target_object_id
    or source_package_id is distinct from target_package_id
  ),

  -- A resolved or accepted contradiction states why. Silent resolution is the
  -- behaviour this table exists to prevent.
  constraint project_knowledge_relations_resolution_rationale check (
    resolution_status = 'unresolved'
    or nullif(btrim(coalesce(resolution_rationale, '')), '') is not null
  ),

  constraint project_knowledge_relations_approval_pair check (
    (approved_by is null and approved_at is null)
    or (approved_by is not null and approved_at is not null)
  ),

  foreign key (source_object_id, organization_id, scope_type)
    references public.project_knowledge_objects(id, organization_id, scope_type) on delete cascade,
  foreign key (target_object_id, organization_id, scope_type)
    references public.project_knowledge_objects(id, organization_id, scope_type) on delete cascade
);

-- One relation of a given type between one pair. Re-asserting is an update, not
-- a duplicate row.
create unique index project_knowledge_relations_unique_idx
  on public.project_knowledge_relations (
    organization_id, relation_type,
    coalesce(source_object_id, source_package_id),
    coalesce(target_object_id, target_package_id)
  );

create index project_knowledge_relations_source_idx
  on public.project_knowledge_relations (organization_id, source_object_id, relation_type);
create index project_knowledge_relations_target_idx
  on public.project_knowledge_relations (organization_id, target_object_id, relation_type);
create index project_knowledge_relations_open_contradiction_idx
  on public.project_knowledge_relations (organization_id, created_at)
  where relation_type = 'contradicts' and resolution_status = 'unresolved';

-- ── 9. Relation semantics, enforced ─────────────────────────────────────────
-- The endpoint kinds a relation type accepts, and whether it binds to a version.
-- A closed vocabulary is only closed if something rejects the values outside it.

create or replace function public.project_knowledge_assert_relation(
  p_relation_type text,
  p_source_kind text,
  p_target_kind text,
  p_source_version integer,
  p_target_version integer
) returns void language plpgsql immutable set search_path = public, pg_temp as $$
declare
  expected_source text;
  expected_target text;
  version_sensitive boolean;
begin
  case p_relation_type
    -- normative → normative (packages both sides)
    when 'derived_from' then expected_source := 'knowledge_package'; expected_target := 'knowledge_package'; version_sensitive := false;
    when 'implements'   then expected_source := 'knowledge_package'; expected_target := 'knowledge_package'; version_sensitive := false;
    -- instance → normative
    when 'governed_by'  then expected_source := 'knowledge_object';  expected_target := 'knowledge_package'; version_sensitive := false;
    when 'satisfies'    then expected_source := 'knowledge_object';  expected_target := 'knowledge_package'; version_sensitive := true;
    when 'maps_to'      then expected_source := 'knowledge_object';  expected_target := 'knowledge_package'; version_sensitive := true;
    -- normative → instance
    when 'applies_to'   then expected_source := 'knowledge_package'; expected_target := 'knowledge_object';  version_sensitive := false;
    -- instance → instance / observed
    when 'tested_by'    then expected_source := 'knowledge_object';  expected_target := 'knowledge_object';  version_sensitive := true;
    when 'failed_by'    then expected_source := 'knowledge_object';  expected_target := 'knowledge_object';  version_sensitive := true;
    when 'mitigates'    then expected_source := 'knowledge_object';  expected_target := 'knowledge_object';  version_sensitive := false;
    when 'threatens'    then expected_source := 'knowledge_object';  expected_target := 'knowledge_object';  version_sensitive := false;
    when 'accepted_as_exception_by' then expected_source := 'knowledge_object'; expected_target := 'knowledge_object'; version_sensitive := true;
    when 'depends_on'   then expected_source := 'knowledge_object';  expected_target := 'knowledge_object';  version_sensitive := false;
    when 'supports'     then expected_source := 'knowledge_object';  expected_target := 'knowledge_object';  version_sensitive := true;
    -- any → any
    when 'contradicts'  then expected_source := null;                expected_target := null;                version_sensitive := true;
    when 'supersedes'   then expected_source := null;                expected_target := null;                version_sensitive := true;
    else raise exception 'knowledge_relation_unknown_type';
  end case;

  if expected_source is not null and p_source_kind <> expected_source then
    raise exception 'knowledge_relation_invalid_source_kind';
  end if;
  if expected_target is not null and p_target_kind <> expected_target then
    raise exception 'knowledge_relation_invalid_target_kind';
  end if;

  -- `supersedes` joins two endpoints of the same kind by definition.
  if p_relation_type = 'supersedes' and p_source_kind <> p_target_kind then
    raise exception 'knowledge_relation_supersedes_kind_mismatch';
  end if;

  -- A version-sensitive relation binds to a specific version on its object
  -- endpoints. A control's new assertion does not inherit the old assertion's
  -- evidence or approval.
  if version_sensitive then
    if p_source_kind = 'knowledge_object' and p_source_version is null then
      raise exception 'knowledge_relation_source_version_required';
    end if;
    if p_target_kind = 'knowledge_object' and p_target_version is null then
      raise exception 'knowledge_relation_target_version_required';
    end if;
  end if;
end
$$;

create or replace function public.project_knowledge_relations_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.project_knowledge_assert_relation(
    new.relation_type, new.source_endpoint_kind, new.target_endpoint_kind,
    new.source_version_no, new.target_version_no
  );

  -- A referenced version must exist on the referenced object.
  if new.source_object_id is not null and new.source_version_no is not null
     and not exists (
       select 1 from public.project_knowledge_object_versions v
       where v.knowledge_object_id = new.source_object_id and v.version_no = new.source_version_no
     ) then
    raise exception 'knowledge_relation_source_version_not_found';
  end if;
  if new.target_object_id is not null and new.target_version_no is not null
     and not exists (
       select 1 from public.project_knowledge_object_versions v
       where v.knowledge_object_id = new.target_object_id and v.version_no = new.target_version_no
     ) then
    raise exception 'knowledge_relation_target_version_not_found';
  end if;

  -- A package endpoint must be readable by this organization: global packages
  -- (organization_id null) or the organization's own. Anything else would be a
  -- cross-tenant reference.
  if new.source_package_id is not null and not exists (
       select 1 from public.knowledge_packages p
       where p.id = new.source_package_id
         and (p.organization_id is null or p.organization_id = new.organization_id)
     ) then
    raise exception 'knowledge_relation_source_package_out_of_scope';
  end if;
  if new.target_package_id is not null and not exists (
       select 1 from public.knowledge_packages p
       where p.id = new.target_package_id
         and (p.organization_id is null or p.organization_id = new.organization_id)
     ) then
    raise exception 'knowledge_relation_target_package_out_of_scope';
  end if;

  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists project_knowledge_relations_guard_trigger on public.project_knowledge_relations;
create trigger project_knowledge_relations_guard_trigger
  before insert or update on public.project_knowledge_relations
  for each row execute function public.project_knowledge_relations_guard();

-- ── 10. Scope-aware mutations ───────────────────────────────────────────────
-- The create RPC gains organization scope. Everything else about it is
-- unchanged: same idempotency, same evidence validation, same actor gate, same
-- service-role requirement.

create or replace function public.create_project_knowledge_object(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  object_id uuid := gen_random_uuid();
  org_id uuid := (p_input->>'organization_id')::uuid;
  scope text := coalesce(nullif(btrim(p_input->>'scope_type'), ''), 'project');
  input_project_id uuid := nullif(p_input->>'project_id', '')::uuid;
  actor_id uuid := (p_input->>'actor_id')::uuid;
  owner_id uuid := nullif(p_input->>'owner_user_id', '')::uuid;
  fingerprint text := encode(digest((p_input - 'actor_id')::text, 'sha256'), 'hex');
  existing public.project_knowledge_objects%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'knowledge_service_role_required'; end if;
  perform public.project_knowledge_assert_input(p_input);

  if scope not in ('organization', 'project') then raise exception 'knowledge_input_invalid_scope'; end if;
  if scope = 'project' and input_project_id is null then raise exception 'knowledge_input_project_required'; end if;
  if scope = 'organization' and input_project_id is not null then raise exception 'knowledge_input_project_forbidden_at_org_scope'; end if;

  if coalesce(p_input->>'knowledge_type','') not in (
    'finding','pattern','best_practice','lesson_learned','recommendation','prediction','root_cause',
    'control','control_mapping','evidence_binding','risk','exception','asset','vendor','trust_boundary','assessment'
  ) then
    raise exception 'knowledge_input_invalid_type';
  end if;

  if nullif(btrim(p_input->>'idempotency_key'),'') is null then raise exception 'knowledge_idempotency_key_required'; end if;

  if scope = 'project' and not exists (
    select 1 from public.projects p
    where p.id = input_project_id and p.organization_id = org_id and p.deleted_at is null
  ) then
    raise exception 'knowledge_project_out_of_scope';
  end if;

  if coalesce(public.project_knowledge_actor_role(org_id, actor_id),'') not in ('owner','admin','member') then
    raise exception 'knowledge_action_forbidden';
  end if;

  if scope = 'project' then
    select * into existing from public.project_knowledge_objects
      where project_knowledge_objects.project_id = input_project_id
        and idempotency_key = p_input->>'idempotency_key';
  else
    select * into existing from public.project_knowledge_objects
      where project_knowledge_objects.organization_id = org_id
        and project_knowledge_objects.scope_type = 'organization'
        and idempotency_key = p_input->>'idempotency_key';
  end if;

  if found then
    if existing.creation_fingerprint <> fingerprint then raise exception 'knowledge_idempotency_conflict'; end if;
    return jsonb_build_object('knowledge_object_id', existing.id, 'version_no', existing.current_version_no, 'status', existing.current_status, 'deduped', true);
  end if;

  insert into public.project_knowledge_objects(
    id, organization_id, scope_type, project_id, knowledge_type, owner_user_id, idempotency_key, creation_fingerprint, created_by
  ) values (
    object_id, org_id, scope, input_project_id, p_input->>'knowledge_type', owner_id, p_input->>'idempotency_key', fingerprint, actor_id
  );

  insert into public.project_knowledge_object_versions(
    knowledge_object_id, organization_id, scope_type, project_id, version_no, title, summary, body,
    structured_content, confidence, confidence_reason, provenance, content_hash, created_by
  ) values (
    object_id, org_id, scope, input_project_id, 1, p_input->>'title', p_input->>'summary', p_input->>'body',
    coalesce(p_input->'structured_content','{}'::jsonb), p_input->>'confidence', p_input->>'confidence_reason',
    p_input->'provenance', fingerprint, actor_id
  );

  perform public.project_knowledge_insert_evidence(object_id, org_id, input_project_id, 1, actor_id, p_input->'evidence');

  insert into public.project_knowledge_object_transitions(
    knowledge_object_id, organization_id, scope_type, project_id, version_no, from_status, to_status, actor_id, rationale
  ) values (
    object_id, org_id, scope, input_project_id, 1, null, 'proposed', actor_id, p_input->>'proposal_rationale'
  );

  return jsonb_build_object('knowledge_object_id', object_id, 'version_no', 1, 'status', 'proposed', 'deduped', false);
end
$$;

-- Evidence insertion becomes scope-aware. A project_event reference is only
-- checkable at project scope; at organization scope the same evidence type is
-- rejected rather than silently accepted unverified.

create or replace function public.project_knowledge_insert_evidence(
  p_object_id uuid, p_organization_id uuid, p_project_id uuid, p_version_no integer, p_actor_id uuid, p_evidence jsonb
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  item jsonb;
  scope text := case when p_project_id is null then 'organization' else 'project' end;
begin
  for item in select value from jsonb_array_elements(p_evidence) loop
    if coalesce(item->>'evidence_type','') not in ('project_event','project_object','document','metric','engine_finding','external_reference')
      or coalesce(item->>'role','') not in ('supports','contradicts','context')
      or coalesce(item->>'confidence','') not in ('high','medium','low','unknown')
      or nullif(btrim(item->>'evidence_ref'),'') is null then
      raise exception 'knowledge_input_invalid_evidence';
    end if;

    if item->>'evidence_type' = 'project_event' then
      if scope = 'organization' then
        raise exception 'knowledge_project_event_requires_project_scope';
      end if;
      if not exists (
        select 1 from public.project_event_log e
        where e.event_id = (item->>'evidence_ref')::uuid
          and e.organization_id = p_organization_id and e.project_id = p_project_id
      ) then
        raise exception 'knowledge_project_event_out_of_scope';
      end if;
    end if;

    insert into public.project_knowledge_object_evidence(
      knowledge_object_id, organization_id, scope_type, project_id, version_no,
      evidence_type, evidence_ref, role, confidence, note, metadata, created_by
    ) values (
      p_object_id, p_organization_id, scope, p_project_id, p_version_no,
      item->>'evidence_type', item->>'evidence_ref', item->>'role',
      item->>'confidence', item->>'note', coalesce(item->'metadata','{}'::jsonb), p_actor_id
    );
  end loop;
end
$$;

-- Revision carries the parent's scope onto the new version rather than assuming
-- a project.

create or replace function public.revise_project_knowledge_object(
  p_knowledge_object_id uuid, p_expected_version_no integer, p_input jsonb
) returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  actor_id uuid := (p_input->>'actor_id')::uuid;
  object_row public.project_knowledge_objects%rowtype;
  next_version integer;
  matched_version integer;
  fingerprint text := encode(digest((p_input - 'actor_id')::text, 'sha256'), 'hex');
begin
  if auth.role() <> 'service_role' then raise exception 'knowledge_service_role_required'; end if;
  perform public.project_knowledge_assert_input(p_input);
  select * into object_row from public.project_knowledge_objects where id = p_knowledge_object_id for update;
  if not found then raise exception 'knowledge_object_not_found'; end if;
  if coalesce(public.project_knowledge_actor_role(object_row.organization_id, actor_id),'') not in ('owner','admin','member') then
    raise exception 'knowledge_action_forbidden';
  end if;

  select version_no into matched_version from public.project_knowledge_object_versions
    where knowledge_object_id = p_knowledge_object_id and content_hash = fingerprint;
  if matched_version = object_row.current_version_no and matched_version = p_expected_version_no + 1 then
    return jsonb_build_object('knowledge_object_id', object_row.id, 'version_no', matched_version, 'status', object_row.current_status, 'deduped', true);
  end if;
  if object_row.current_version_no <> p_expected_version_no then raise exception 'knowledge_version_conflict'; end if;

  next_version := object_row.current_version_no + 1;

  insert into public.project_knowledge_object_versions(
    knowledge_object_id, organization_id, scope_type, project_id, version_no, title, summary, body,
    structured_content, confidence, confidence_reason, provenance, content_hash, created_by
  ) values (
    object_row.id, object_row.organization_id, object_row.scope_type, object_row.project_id, next_version,
    p_input->>'title', p_input->>'summary', p_input->>'body', coalesce(p_input->'structured_content','{}'::jsonb),
    p_input->>'confidence', p_input->>'confidence_reason', p_input->'provenance', fingerprint, actor_id
  );

  perform public.project_knowledge_insert_evidence(
    object_row.id, object_row.organization_id, object_row.project_id, next_version, actor_id, p_input->'evidence'
  );

  insert into public.project_knowledge_object_transitions(
    knowledge_object_id, organization_id, scope_type, project_id, version_no, from_status, to_status, actor_id, rationale
  ) values (
    object_row.id, object_row.organization_id, object_row.scope_type, object_row.project_id, next_version,
    null, 'proposed', actor_id, p_input->>'proposal_rationale'
  );

  update public.project_knowledge_objects
    set current_version_no = next_version, current_status = 'proposed', updated_at = now()
    where id = object_row.id;

  return jsonb_build_object('knowledge_object_id', object_row.id, 'version_no', next_version, 'status', 'proposed', 'deduped', false);
end
$$;

create or replace function public.transition_project_knowledge_object(
  p_knowledge_object_id uuid, p_expected_version_no integer, p_target_status text, p_actor_id uuid, p_rationale text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare object_row public.project_knowledge_objects%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'knowledge_service_role_required'; end if;
  select * into object_row from public.project_knowledge_objects where id = p_knowledge_object_id for update;
  if not found then raise exception 'knowledge_object_not_found'; end if;
  if coalesce(public.project_knowledge_actor_role(object_row.organization_id, p_actor_id),'') not in ('owner','admin') then
    raise exception 'knowledge_action_forbidden';
  end if;
  if object_row.current_version_no <> p_expected_version_no then raise exception 'knowledge_version_conflict'; end if;
  if object_row.current_status = p_target_status and exists (
    select 1 from public.project_knowledge_object_transitions t
    where t.knowledge_object_id = object_row.id and t.version_no = object_row.current_version_no and t.to_status = p_target_status
  ) then
    return jsonb_build_object('knowledge_object_id', object_row.id, 'version_no', object_row.current_version_no, 'status', p_target_status, 'deduped', true);
  end if;
  if not ((object_row.current_status = 'proposed' and p_target_status = 'validated')
       or (object_row.current_status = 'validated' and p_target_status = 'active')) then
    raise exception 'knowledge_invalid_transition';
  end if;
  if not exists (
    select 1 from public.project_knowledge_object_versions v
    join public.project_knowledge_object_evidence e
      on e.knowledge_object_id = v.knowledge_object_id and e.version_no = v.version_no
    where v.knowledge_object_id = object_row.id and v.version_no = object_row.current_version_no
      and v.confidence <> 'unknown' and e.role = 'supports' and e.confidence <> 'unknown'
  ) then raise exception 'knowledge_insufficient_evidence'; end if;

  insert into public.project_knowledge_object_transitions(
    knowledge_object_id, organization_id, scope_type, project_id, version_no, from_status, to_status, actor_id, rationale
  ) values (
    object_row.id, object_row.organization_id, object_row.scope_type, object_row.project_id,
    object_row.current_version_no, object_row.current_status, p_target_status, p_actor_id, p_rationale
  );

  update public.project_knowledge_objects
    set current_status = p_target_status,
        active_version_no = case when p_target_status = 'active' then current_version_no else active_version_no end,
        updated_at = now()
    where id = object_row.id;

  return jsonb_build_object('knowledge_object_id', object_row.id, 'version_no', object_row.current_version_no, 'status', p_target_status, 'deduped', false);
end
$$;

-- ── 11. Read model ──────────────────────────────────────────────────────────

create or replace view public.project_knowledge_object_current with (security_invoker = true) as
select o.id, o.organization_id, o.scope_type, o.project_id, o.knowledge_type, o.owner_user_id,
  o.current_status, o.current_version_no, o.active_version_no,
  v.title, v.summary, v.body, v.structured_content, v.confidence, v.confidence_reason, v.provenance,
  (select count(*)::integer from public.project_knowledge_object_evidence e
     where e.knowledge_object_id = o.id and e.version_no = o.current_version_no) as evidence_count,
  o.created_by, o.created_at, o.updated_at
from public.project_knowledge_objects o
join public.project_knowledge_object_versions v
  on v.knowledge_object_id = o.id and v.version_no = o.current_version_no;

-- ── 12. RLS ─────────────────────────────────────────────────────────────────
-- The tenant boundary is unchanged: is_org_member(organization_id), with
-- organization_id NOT NULL at every scope. No policy gains a null test on
-- project_id, which is the property that keeps ADR-013 safe.

alter table public.project_knowledge_relations enable row level security;

create policy "Members read project_knowledge_relations" on public.project_knowledge_relations
  for select using (public.is_org_member(organization_id));

create policy "Service role project_knowledge_relations" on public.project_knowledge_relations
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

revoke insert, update, delete on public.project_knowledge_relations from anon, authenticated;
grant select on public.project_knowledge_relations to authenticated;

revoke all on function public.project_knowledge_assert_relation(text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.project_knowledge_relations_guard() from public, anon, authenticated;

comment on table public.project_knowledge_relations is
  'EKI canonical relations. One graph, many lenses (ADR-016). Endpoints are knowledge objects or knowledge packages; relations to people are attributes, not edges.';
comment on column public.project_knowledge_objects.scope_type is
  'ADR-013. organization or project. Governs project_id nullability by constraint, so a NULL project is only reachable when the scope says so.';
comment on column public.project_knowledge_objects.owner_user_id is
  'Exactly one accountable person. Ownership is an attribute, never an object.';
