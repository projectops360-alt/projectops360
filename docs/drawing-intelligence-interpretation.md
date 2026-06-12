# Drawing Intelligence — AI Interpretation + Living Graph (Prompt 4 of 5)

> Implemented 2026-06-12. Evidence-first insight generation, review workflow,
> Living Graph connection. No Autodesk APS, no automatic contractual records.

## Architecture

### Deterministic engine (always runs) — `src/lib/drawing-intelligence/interpretation.ts`
Pure module (9 unit tests). Keyword rules over extracted notes generate:
`rfi_candidate`, `submittal_requirement`, `inspection_requirement`,
`schedule_impact`, `cost_impact`, `missing_information`, `contradiction`,
`decision_required`. Revision-driven rules generate `risk` + `schedule_impact`
when a revision lands while tasks are active. Each candidate carries:
severity, confidence (rule confidence × note-extraction confidence), verbatim
evidence (page + excerpt), recommended action key, a structured payload per
type (RFI question/reason, submittal required_item, risk mitigation,
schedule/cost explanation — unknown values stay `null`, never invented), and
conservative task linking (≥2 significant shared words). `needs_review` when
confidence < 0.7 OR severity high/critical.

### AI enhancement (optional) — `interpretation-service.ts` + `ai-interpretation` prompt
- New `drawing_interpretation` template in `src/lib/ai/prompts.ts` (structured
  JSON, strict evidence-first system prompt), runs through the existing
  `runAi` service (logged in `ai_runs`).
- Only runs when an `OrgContext` is available (manual "Run extraction") AND
  `OPENAI_API_KEY` is set. Background fire-and-forget runs are deterministic
  only.
- **Evidence gate**: every AI insight's excerpts must be verbatim-traceable
  (case-insensitive) to the extracted notes/revisions corpus; otherwise the
  insight is dropped. Invalid types/severities/confidences are dropped.
  High-impact types (cost/schedule/contradiction/risk) always `needs_review`.

### Persistence + idempotency
`runDrawingInterpretation` soft-deletes previous `open`/`in_review` insights
for the file and re-generates; user-reviewed insights (accepted / dismissed /
converted / linked) are kept and never duplicated (type+title key). Evidence
rows reference the insight (`related_entity_type: "drawing_insight"`,
`related_entity_id: <insight id>`). Runs as the final stage of
`processDrawingFile`; updates the `ai_interpretation` job row
(processing → completed, with `insights_created` / `ai_used` metadata).

### Living Graph
New node types `drawing_event` + `drawing_insight`, source types
`drawing_files` + `drawing_insights`, edge types `generated_insight`
(drawing → insight) and `affects` (insight → task). Styles registered in
`living-graph-styles.ts` (DraftingCompass indigo / Lightbulb violet). Task
edges are only created when the task already has a graph node. Manual
linking from the UI also emits the `affects` edge.

### Migration `20260707000000_drawing_interpretation.sql`
- `drawing_insights.insight_type` CHECK += `inspection_requirement`.
- `drawing_insights.status` CHECK += `accepted/dismissed/converted/linked`.
- Living Graph CHECKs extended with the drawing types **and the labor values
  (`labor_risk`, `labor_constrained`, `construction_activities`) that existed
  in TS but were missing in the DB — labor graph emits were failing silently
  until now.**
- `ai_runs.prompt_type` CHECK += `drawing_interpretation`.

### Review workflow (UI)
Tabs Detected Risks / Generated RFIs / Submittal Requirements (includes
inspection) / Schedule Impact / Cost Impact / Recommended Actions now render
`DrawingInsightCard`s (sorted severity → confidence): type/severity/status
badges, confidence %, source drawing + page, quoted evidence excerpts,
recommended action label, linked task. Actions: **Accept / Dismiss / Mark
reviewed / Link to task** (task dropdown; emits graph edge). Statuses map:
`open`=Suggested, `in_review`=Needs review (+ inline note "needs human
review"). Nothing contractual is ever auto-created — all insights are
recommendations.

## Status mapping
Prompt vocabulary → DB: suggested=`open`, needs_review=`in_review`, plus
accepted/dismissed/converted/linked (added to CHECK). Legacy actioned/resolved
kept.

## ⚠️ Pending on hosted Supabase
THREE migrations now: `20260705` (tables), `20260706` (bucket), `20260707`
(interpretation CHECKs). Without the third, insight inserts with
`inspection_requirement` or review statuses will fail.

## Ready for Prompt 5
APS integration + hardening can plug into: `source_system` on files, the
OcrProvider interface, the job/stage contract, and the canonical JSON.
