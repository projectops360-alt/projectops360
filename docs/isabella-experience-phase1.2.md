# Isabella Experience — Phase 1.2

**Conversation Intelligence + Screen Intelligence + Hologram Preview**

Phase 1.2 turns Isabella from a chat assistant into a *present executive advisor*: she
understands the language you actually write in, understands the screen you are looking at,
and materializes on a dedicated stage instead of popping up as a chat window.

Knowledge OS, retrieval, confidence, provenance and Project Memory are **unchanged**. This
phase is the **experience** and the **presentation layer** only.

---

## 1. Architecture changes

### Presentation layer is fully decoupled (the hologram seam)
A new `src/components/isabella/` module owns *everything visual*. Knowledge code never
imports it and it never imports knowledge code.

```
src/components/isabella/
  avatar/
    presence.ts            # PresenceState + PresenceRenderer contract (the seam)
    svg-avatar.tsx         # default renderer: original animated executive SVG
    svg-avatar.module.css  # transform/opacity-only animations, reduced-motion aware
    index.tsx              # IsabellaPresence — renderer registry (svg today)
  isabella-experience.tsx        # immersive stage + conversation
  isabella-experience.module.css # dim/blur scrim, stage entrance, materialization
  index.ts
```

The **only** thing a future Lottie / Live2D / Three.js / Ready Player Me / MetaHuman / video
avatar must do is register under `PresenceRenderer` in `avatar/index.tsx`. The stage and the
conversation engine do not change. Unimplemented renderer kinds fall back to SVG, so a future
flag flip can never produce a blank stage.

### Conversation Intelligence (UI language ≠ conversation language)
- `detectLanguage(text)` in `src/lib/knowledge-os/language.ts` — dependency-free EN/ES
  detector (hard signal on `ñ/¿/¡`/accents, else stop-word scoring; returns `null` when
  ambiguous so the current language sticks).
- `AskGuideInput.answerLanguage` threads the **conversation language** (the language of the
  user's latest message) through to generation, independent of the UI locale. The service
  uses it for the reply, the honest-fallback text, and the persisted `answer_language`.
  Retrieval still searches the whole corpus, so a Spanish question reaches English-authored
  knowledge — only the reply is rendered in the user's language.

### Screen Intelligence (explain the actual screen)
- `src/lib/knowledge-os/screens.ts` — a route→screen registry (`SCREEN_REGISTRY`,
  `resolveScreen`, `enrichContextWithScreen`). Each entry carries a bilingual title, the
  primary workflow, the **visible UI components**, and **screen-specific follow-up
  questions**. Longest-prefix match wins.
- `GuideContext` gained `pathname`, `pageTitle`, `tab`, `workflow`, `components`.
- The experience reads the live `usePathname()`, resolves the screen, and merges it into the
  context. The server prompt now serializes that screen context, and two grounding-safe rules
  were added so Isabella explains the **actual** screen, names the **listed** components, and
  ends a screen explanation by asking what the user is trying to accomplish (goal-oriented
  coaching) — without inventing UI.

---

## 2. Files changed

**New**
- `src/lib/knowledge-os/screens.ts`
- `src/components/isabella/avatar/presence.ts`
- `src/components/isabella/avatar/svg-avatar.tsx`
- `src/components/isabella/avatar/svg-avatar.module.css`
- `src/components/isabella/avatar/index.tsx`
- `src/components/isabella/isabella-experience.tsx`
- `src/components/isabella/isabella-experience.module.css`
- `src/components/isabella/index.ts`
- `docs/isabella-experience-phase1.2.md` (this file)

**Modified**
- `src/lib/knowledge-os/language.ts` — `detectLanguage()`.
- `src/lib/knowledge-os/types.ts` — `answerLanguage`; screen fields on `GuideContext`.
- `src/lib/knowledge-os/service.ts` — conversation language; screen-aware context + retrieval recall.
- `src/lib/ai/prompts.ts` — grounding-safe screen-awareness + goal-close rules.
- `src/lib/knowledge-os/config.ts` — base prompt version → `knowledge-os-base@1.1.0`.
- `src/components/living-guide/living-guide-widget.tsx` — launcher opens the immersive experience (classic panel kept as `immersive={false}` fallback).
- `src/lib/knowledge-os/__tests__/language.test.ts` — tests for detection + screen resolution.

---

## 3. Libraries introduced

**None.** Zero new dependencies. The avatar is hand-authored SVG; all motion is CSS
(`transform`/`opacity`/`backdrop-filter`). This keeps the bundle flat and avoids GPU-heavy
runtimes for a prototype presentation layer.

---

## 4. Performance considerations

- Animations are **transform/opacity only** → compositor-friendly, no layout/paint thrash.
- Every keyframe set is disabled under `prefers-reduced-motion: reduce`.
- One inline SVG (~3 KB) + two small CSS modules; no canvas, no WebGL, no Lottie JSON.
- The avatar mounts only while the experience is open; nothing animates in the background
  when Isabella is closed.

---

## 5. Regression report

Validation: `tsc --noEmit` → 0 errors · `eslint` (changed files) → clean · `next build`
→ green · `vitest run src/lib/knowledge-os` → **26 passed** (was 17; +9 new).

Existing capabilities verified intact:

| Capability | Status |
|---|---|
| People workspace (`/team`) — cards, Manage user, Create login | ✅ unchanged |
| Rename / full member edit / reset password / remove / permanent delete | ✅ unchanged (server actions untouched) |
| Knowledge OS retrieval, hybrid fusion, dedupe | ✅ unchanged (tests pass) |
| Confidence tiers + badge + sources/provenance | ✅ unchanged (rendered identically on the new stage) |
| Isabella persona / greeting / experts registry | ✅ unchanged |
| English ↔ Spanish answers | ✅ improved (now follows the message, not the locale) |

**Explicit, intentional presentation change (per the no-silent-regressions rule):** the
`/team` launcher now opens the **immersive experience** instead of the slide-over panel. No
capability was removed — the same questions, confidence, sources and feedback are present, and
the classic `LivingGuidePanel` remains exported and reachable via `immersive={false}`.

---

## 6. Before / After (UX)

| | Before (1.1) | After (1.2) |
|---|---|---|
| Activation | Right-side slide-over chat | Workspace dims + blurs; Isabella **materializes** on a dedicated stage and stays present |
| Avatar | Static gradient orb | Original executive avatar: breathing, blinking, idle sway, **thinking / speaking / listening / greeting** states |
| Language | Followed UI locale | Follows the **language of your message** |
| "Explain this screen" | Generic module guidance | Explains the **actual screen**, names visible components, ends with a goal question |
| Suggestions | Fixed quick actions | Quick actions **+ screen-specific** follow-ups |
| Micro-interactions | Minimal | Entrance, materialization, status pulse, answer rise-in, exit |

---

## 7. Future hologram roadmap

The seam is `PresenceRenderer` (`avatar/presence.ts`) + the registry in `avatar/index.tsx`.
Each step is additive and swaps **only** the renderer:

1. **2D motion** — Lottie renderer (`renderer="lottie"`) for richer facial motion; same states.
2. **Live2D** — parametric rig driven by `PresenceState`; lip-sync hook on `speaking`.
3. **3D** — Three.js / Ready Player Me head; `voiceId`/`hologramId` (already reserved on the
   persona) wire TTS + visemes.
4. **MetaHuman / video** — streamed avatar; the stage already provides the framed, dimmed
   presentation surface and the state machine.
5. **AR/VR/holographic** — the stage becomes a portal; `PresenceState` is the same contract.

No knowledge, retrieval, confidence, provenance, Project Memory or Living Graph code is touched
by any of these.

---

## 8. Known limitations

- The widget is currently mounted only on `/team`, so Screen Intelligence is exercised there;
  the registry already covers members/teams/billing/projects/import/settings and resolves by
  live pathname, so mounting globally (Phase 1.3) lights those up with no code change here.
- Language detection is a fast EN/ES heuristic — extremely short or mixed-language messages
  fall back to the current language (by design). Other languages are out of scope for 1.2.
- The avatar is an original stylized executive portrait, not a photoreal likeness (intentional:
  premium + no uncanny valley + tiny footprint).
- No audio/voice yet (`voiceId`/`hologramId` are reserved, not wired).

---

## 9. Recommendations for Phase 1.3

1. **Mount Isabella globally** (app shell) so she is present on every screen; pass the route as
   base context. The screen registry already supports it.
2. **Component-level holographic guidance** — let "show me" highlight the named component on the
   real screen (the registry already enumerates them; add anchors/refs).
3. **Voice** — wire `voiceId` to TTS and drive the `speaking` viseme from audio.
4. **Lottie renderer** as the first non-SVG presence to validate the seam end-to-end.
5. **Proactive briefings** — when real project signals exist, open with Isabella's briefing
   style (persona already supports it, gated on real data).
6. **Expand `detectLanguage`** to more locales as the corpus grows.
