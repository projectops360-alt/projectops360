# Platform Security and Tenant Isolation

**Plan:** Phase 8 · P8-T3A
**Status:** Implemented foundation

Platform access is deny-by-default and derives scope only from a trusted session. A caller cannot widen
its organization, project membership or capabilities through request data. Cross-organization and
out-of-project access is rejected without resource-existence disclosure.

AI actors receive sanitized evidence only. They cannot receive raw communication or memory payloads,
approve governance transitions, mutate canonical data or export restricted information. Human approval
requires an active owner/admin session. Confidential access records its purpose, minimizes returned
fields and applies redaction obligations.

Executable source: `src/lib/platform-governance/security.ts`.
