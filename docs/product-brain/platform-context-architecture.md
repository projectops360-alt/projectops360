# Platform Context Architecture

**Plan:** Phase 8 · P8-T1A
**Status:** Implemented foundation

Context follows an explicit hierarchy:

`Organization → Portfolio → Project → Work Item → Interaction`

The assembler accepts only authorized, sanitized fragments within the trusted request scope. Expired
fragments and foreign projects are excluded. Conflicts resolve deterministically by specificity,
freshness and declared priority, while preserving a visible conflict record. Size budgets prevent
unbounded context growth and disclose truncation.

Executable source: `src/lib/platform-context/assembler.ts`.
