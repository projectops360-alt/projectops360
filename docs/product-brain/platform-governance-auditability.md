# Platform Governance and Auditability

**Plan:** Phase 8 · P8-T3B
**Status:** Implemented foundation

Every platform access or governance decision can be represented as a tenant-scoped, purpose-bound,
sanitized audit record. Records carry policy version, actor classification, decision, reasons,
evidence references, sequence and a SHA-256 link to the previous record.

The audit chain is append-only. Updates and deletes are rejected in the database, authenticated users
cannot insert, and raw communication, memory, transcript, token or secret payloads are prohibited.
Cross-organization records cannot form one valid chain.

Executable source: `src/lib/platform-governance/audit.ts`.
