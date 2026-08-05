# Creating a governed project (V2)

## What happens when someone presses "New project"

```
create-project-dialog.tsx
  → loadProjectCreationScopeAction()   organizations where the caller holds project.create
  → loadGovernanceUnitsAction(orgId)   active, non-deleted units of that organization
  → createProjectAction(...)           server action, session-bound client
  → rpc create_project_v2              one transaction
      → projects
      → project_governance_contracts   contract_key = 'multi_pmo_v2', status active
      → project_governance_assignments relationship_type owner, status active
  → /projects/{id}/charter?onboard=true
```

Three rows or none. There is no partial state to clean up.

## Why the selectors and the command share a predicate

`v2_creatable_organizations` and `v2_creatable_units` are scoped by the same rule
`create_project_v2` enforces. The form therefore cannot offer an organization or
a unit the command would refuse. A selector that shows a rejected option is
worse than no selector: the user discovers the rule by colliding with it.

## What the command will not accept

No `p_user_id`, no `p_member_id`, no `p_owner_id`. The actor is `auth.uid()`.
The organization and unit come from the client and are both re-checked against
that identity — a selector proposes, it never decides. Authorisation is the
capability resolver's answer to `project.create`, never a role name compared in
SQL, so changing who may create a project is a data change and not a code change.

## The trigger override

`sync_new_project_governance_owner` fires on the projects INSERT and assigns the
organization's **system-default** unit as owner. Correct for a legacy project,
wrong here, because the caller chose a unit. The command retires what the trigger
created and records the chosen one. The DEFERRED constraint trigger
`trg_v2_single_active_owner` proves the end state is exactly one active owner —
deferred because the question only has a stable answer at COMMIT, not after each
of the three statements.

## Tenancy is structural, not remembered

Composite foreign keys carry `organization_id`, so a contract or an owner
pointing at another tenant's project cannot be stored at all. The explicit
same-organization checks in the command exist to produce an honest error message,
not to be the only defence.

## Absence of a contract means legacy

Nothing here backfills, migrates or reads an existing project. The 17 production
projects remain legacy and untouched. `v2_assert_single_active_owner` returns
early for any project without an active contract, which is what keeps the two
models from interfering.

## Manual test (Stage)

`.env.local` points at Stage (`gcxcljfzleasrleyyyda`). Sign in as
`pmo@xxx-demo.io`, whose `pmo_manager` membership in `xxx-demo` is the only real
Stage account currently holding `project.create`.

Evidence that a created project is V2:

```sql
SELECT p.slug, c.contract_key, c.status,
       a.relationship_type, a.status AS owner_status, u.name AS owning_pmo
FROM projects p
JOIN project_governance_contracts c ON c.project_id = p.id
JOIN project_governance_assignments a ON a.project_id = p.id
 AND a.relationship_type='owner' AND a.status='active'
JOIN governance_units u ON u.id = a.governance_unit_id
WHERE p.slug = '<the new slug>';
```

One row, `contract_key = multi_pmo_v2`, and `owning_pmo` equal to the PMO chosen
in the form rather than the organization's default.
