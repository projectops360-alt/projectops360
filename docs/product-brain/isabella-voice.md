# Isabella Voice — Realtime Interface Layer (ISABELLA-VOICE-REALTIME-BRIDGE)

**Status:** implemented behind `ISABELLA_VOICE_ENABLED` (default **OFF** — fully dark).
**Principle:** the realtime speech model is Isabella's **voice, not her brain**. It never
replaces Isabella's engines; it is a conversational interface ON TOP of them.

---

## 1. Architecture

```
┌──────────────┐  mic audio (WebRTC)   ┌──────────────────────┐
│   Browser    │ ◄──────────────────►  │  OpenAI Realtime      │
│ IsabellaVoice│  spoken audio + events│  (gpt-realtime,       │
│ Live control │                       │   voice "marin")      │
└──────┬───────┘                       └──────────┬───────────┘
       │ 1. POST /api/isabella/voice/session      │ tool call: ask_isabella(question)
       │    (auth + flag → ephemeral secret)      ▼
       │ 2. tool call forwarded by the client ┌──────────────────────────────┐
       └────► POST /api/isabella/voice/bridge │ Isabella Voice Context Bridge │
              (auth via session cookie)       └──────────┬───────────────────┘
                                                         │ askLivingGuideAction (UNCHANGED)
                                                         ▼
                       deterministic query engine → tool-use gateway (approved read-only
                       tools) → process intelligence → provenance → Knowledge OS RAG
                       (RBAC · tenant isolation · project scope · ai_runs audit — all existing)
```

Isabella's 4 intelligence levels are reached exactly as the text panel reaches them —
through `askLivingGuideAction`, which is **not modified**:

1. **System tables** — deterministic query engine + approved read-only tool loop.
2. **Business/process logic** — daily diagnosis, root cause, recommendations, briefings.
3. **Unstructured data** — Knowledge OS RAG over pgvector (`match_knowledge`).
4. **Screens/product knowledge** — app-screens corpus + screen-help + Product Brain.

### Components

| Piece | File | Role |
|---|---|---|
| Feature flag | `src/lib/isabella/voice/flag.ts` | `ISABELLA_VOICE_ENABLED === "true"` only; server-side |
| Persona | `src/lib/isabella/voice/persona.ts` | Senior PMO Director character + hard guardrails |
| Tool contract | `src/lib/isabella/voice/tool-contract.ts` | **Exactly one tool**: `ask_isabella`; session config |
| Bridge core | `src/lib/isabella/voice/bridge.ts` | Zod validation → `askLivingGuideAction` → speech text |
| Speech sanitizer | `src/lib/isabella/voice/speech-text.ts` | markdown → bounded listenable text (≤1200 chars) |
| Audit | `src/lib/isabella/voice/audit.ts` | compact rows in `ai_runs` (`model: "isabella-voice"`) |
| Session endpoint | `src/app/api/isabella/voice/session/route.ts` | mints ephemeral OpenAI client secret |
| Bridge endpoint | `src/app/api/isabella/voice/bridge/route.ts` | executes one `ask_isabella` call |
| Client hook | `src/components/isabella/voice/useRealtimeVoice.ts` | WebRTC + data-channel event loop |
| UI control | `src/components/isabella/voice/voice-live.tsx` | flag-gated control inside the Isabella panel |

### Conversation context

The **realtime model holds the spoken conversation** (it hears everything). Its
instructions require every `ask_isabella` question to be **self-contained** (it resolves
pronouns itself: "that task" → the task name). The bridge is therefore stateless per
call, exactly like the text panel, and passes `recentConversation` only for audit.
Screen context (module/screen/pathname/pageTitle/tab/currentEntity + projectId) travels
with each call and maps to `GuideContext` — same shape as the panel.

## 2. Security model

- **The speech model has no data access.** Its session config contains exactly ONE tool
  (`ask_isabella`, guarded by `tool-contract.test.ts`). No SQL, no query tool, no write
  tool. All reads run through Isabella's already-approved layers; **there is no write
  path anywhere in the voice layer**.
- **Identity is never client-claimed.** The bridge builds an `AskGuideInput` with no
  identity fields; `askLivingGuideAction` re-stamps `userId`/`organizationId`/`role`
  from the trusted session cookie (unchanged code). RBAC, tenant isolation, and project
  scope are enforced by the existing pipeline (`resolveIsabellaProjectAccess`, RLS).
- **Strict input validation.** Zod `.strict()` schemas with bounded lengths on every
  endpoint body; unknown fields (e.g. smuggled `sql`) are rejected before execution.
- **The permanent `OPENAI_API_KEY` never reaches the browser.** The session endpoint
  mints a short-lived ephemeral client secret server-side; upstream error bodies are
  never forwarded to the client.
- **Flag OFF → dark.** Both endpoints return 404 before touching auth or OpenAI; no
  voice UI is rendered (server-evaluated flag passed down from the app layout).
- **Audit.** Every session start and every bridge call inserts a compact, non-sensitive
  row into `ai_runs` (`model: "isabella-voice"`): event, screen summary, question/answer
  lengths, tier, grounded, error codes, timing. The tool-use gateway additionally logs
  its own tool audit as today. No raw audio and no full transcripts are stored.
- **Prompt-injection posture.** The persona forbids following user instructions to
  bypass rules, never reveals instructions/internals, and must disclose non-verified
  tiers. Data answers can only contain what Isabella's guarded pipeline returned.

## 3. Limits (by design)

- **Read-only.** Voice can inform and advise; every mutation stays on screen.
- **Bounded speech.** Answers are truncated at a sentence boundary near 1200 chars and
  flagged `truncated`; Isabella offers the panel for long detail.
- **Single-turn bridge.** One `ask_isabella` call = one pipeline run (the pipeline's own
  tool loop is bounded at 5 iterations, unchanged).
- **Session lifetime** is governed by the ephemeral secret; when OpenAI closes the data
  channel the client tears everything down (mic released).
- **Browser support:** requires WebRTC + `getUserMedia` (Chrome/Edge/Safari current).

## 4. Configuration

```
ISABELLA_VOICE_ENABLED=true        # master flag (default OFF)
OPENAI_API_KEY=sk-…                # required (already used by Isabella tool-use)
ISABELLA_VOICE_MODEL=gpt-realtime  # optional override
ISABELLA_VOICE_NAME=marin          # optional override (warm female default)
```

Rollback = unset `ISABELLA_VOICE_ENABLED`. No migration exists; nothing else changes.

## 5. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| No "Live voice conversation" button | Flag OFF (or the panel was opened before the flag was set — reload). |
| Button shows "not configured on this server" | `OPENAI_API_KEY` missing → session endpoint returns 503. |
| 404 from `/api/isabella/voice/*` | Flag OFF — expected dark behavior. |
| 401 | No authenticated session (login expired). |
| 502 from session endpoint | OpenAI upstream rejected the session (check key validity/quota; details are in server logs only, never in the response). |
| Mic error after clicking | Browser permission denied — the UI explains; check the lock icon. |
| Isabella speaks but answers "couldn't check the data" | Bridge returned an error (`ai_runs` rows with `model=isabella-voice`, `status=failed` show the code). |
| Wrong/robotic voice | Check `ISABELLA_VOICE_NAME`; default is `marin`. |
| She answers project data without checking | Should not happen — guardrails + single tool; if observed, capture the transcript and file a regression. |

## 6. Tests

- `src/lib/isabella/voice/__tests__/voice-flag.test.ts` — default-OFF boundary.
- `src/lib/isabella/voice/__tests__/voice-bridge.test.ts` — strict validation, no
  client-claimed identity, speech sanitation, safe failure codes.
- `src/lib/isabella/voice/__tests__/tool-contract.test.ts` — exactly one tool; persona
  guardrails (no direct data / no writes / no invention / bilingual PMO character).
- `src/lib/isabella/voice/__tests__/speech-text.test.ts` — markdown → speech + bounds.
- `src/app/api/isabella/voice/__tests__/voice-routes.test.ts` — endpoint integration:
  dark when OFF, 401 unauthenticated, ephemeral secret without key leakage, bridge
  answer + audit row, invalid body rejection.

## 7. What was intentionally NOT changed

`askLivingGuideAction`, the query engine, the tool-use gateway/runtime/registry, process
intelligence, Knowledge OS/RAG, briefings, the Isabella panel behavior (UX-001 hero
lifecycle untouched — the voice control renders below the conversation, above the
composer, only when the flag is ON), and the existing browser SpeechSynthesis voice
(`use-speech.ts`) — both voice paths coexist; the realtime layer is purely additive.
