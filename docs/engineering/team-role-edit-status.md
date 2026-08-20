# Team role editing status

- Project-manager roster invariant: implemented and validated on staging.
- Inline role editor component: implemented with regression tests.
- Integration target: Team & Roles List member role cell.
- Production: untouched by this branch.

The role editor must be wired into `team-client.tsx` before this branch is eligible for production merge. The integration is deliberately kept separate from the database invariant so the PM roster protection can be validated independently.
