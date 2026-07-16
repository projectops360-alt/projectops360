# Communication Intelligence Foundation

**Plan:** Phase 8 · P8-T2A/B
**Status:** Implemented foundation

Communication ingestion normalizes existing email, meeting, phone, Teams, Slack, in-person, document
and manual-note sources. It preserves business time separately from recording time, records consent and
provenance, and computes a deterministic fingerprint for idempotent ingestion.

Knowledge extraction produces candidates only. Every candidate requires a verbatim source excerpt,
confidence, communication evidence and human owner/admin review. Acceptance does not automatically
create a Knowledge Object, decision, risk, action or other canonical record.

Executable source: `src/lib/communication-intelligence/`.
