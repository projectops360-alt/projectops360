# Platform Memory Architecture

**Plan:** Phase 8 · P8-T1B
**Status:** Implemented foundation

Memory is separated into interaction, working, durable project record and organizational learning
boundaries. Project Memory remains the durable project evidence store; working and interaction memory
expire explicitly. Legal hold overrides expiry.

Retrieval is purpose-bound and tenant/project scoped. AI receives safe summaries and evidence
references only, never raw memory or restricted transcripts. Organizational memory accepts only
human-validated, deidentified learning and cannot silently promote project-bound raw content.

Executable source: `src/lib/platform-memory/policy.ts`.
