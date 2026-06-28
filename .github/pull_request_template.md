<!--
ProjectOps360° — Pull Request
Documentation is necessary but not sufficient: a Product Brain rule is durable
only when an executable check protects it. Fill in the checklist honestly.
-->

## What & why

<!-- Short description. Link any REG-### / UX-### / CAP-### / ADR this touches. -->

## Regression / contract impact

<!-- Does this touch a protected area? (Isabella, Living Graph, navigation/BIM,
Resource Capacity, Project Memory/Scribe/Rythm, metrics/rollups, Execution
Status Engine.) If yes, name the relevant REG-### and Product UX Contract. -->

## Checklist

- [ ] Product Brain reviewed (relevant module doc + regression log + UX contracts).
- [ ] Product Brain updated if product behavior changed.
- [ ] Regression log updated if fixing a REG-### (with root cause + protection rule).
- [ ] Product UX Contracts checked if touching Isabella / Living Graph / navigation.
- [ ] **A test was added or updated for every regression fixed** (no test → not closed).
- [ ] `docs/product-brain/regression-test-map.md` updated if a REG/UX↔test link changed.
- [ ] No protected behavior was silently changed (see [No silent regressions rule]).
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:run` passes.
- [ ] `npm run build` passes.
- [ ] Manual QA completed for the affected area.

<!--
Reminders (see docs/product-brain/11-ai-development-rules.md and CLAUDE.md):
• No green test, no closed regression.
• No CI, no merge.
• No Product UX Contract, no UI overwrite.
-->
