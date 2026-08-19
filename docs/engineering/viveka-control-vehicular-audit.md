# Control Vehicular membership audit

Production audit on 2026-08-19 established:

- The project manager pointer belongs to Nestor Parra (PMO).
- Viveka is an active organization member but has no current or removed `project_team_members` row for Control Vehicular.
- Viveka does have explicit Team & Roles memberships in other projects, including AGRO as Project Manager.
- Therefore no synthetic Viveka membership is created for Control Vehicular without a source-of-truth relationship.

This prevents fixing a visibility report by inventing project authority that the canonical project record does not currently grant.
