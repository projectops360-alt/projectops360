import type { AiPromptType } from "@/types/database";

// ── Prompt Template ─────────────────────────────────────────────────────────────

export interface PromptTemplate {
  /** Machine-readable key matching an AiPromptType value. */
  name: AiPromptType;
  /** Human-readable label for UI/debug. */
  label: string;
  /** System prompt sent to the model. */
  systemPrompt: string;
  /** User prompt template. Use {variableName} placeholders replaced at call time. */
  userPromptTemplate: string;
  /** Default model for this template. */
  defaultModel: string;
  /** Whether this template requires JSON output. */
  requiresJson: boolean;
  /** Description of the expected output shape (documentation only for MVP-0). */
  outputSchema: Record<string, string>;
}

// ── Template Definitions ─────────────────────────────────────────────────────────

export const PROMPT_TEMPLATES: Record<AiPromptType, PromptTemplate> = {
  summary: {
    name: "summary",
    label: "Communication Summary",
    defaultModel: "gpt-4o-mini",
    requiresJson: true,
    systemPrompt: [
      "You are a project operations assistant. Your task is to summarize communication content.",
      "Produce a concise, factual summary in the specified JSON format.",
      "Do not invent information not present in the source content.",
      "Use the same language as the input content.",
    ].join("\n"),
    userPromptTemplate: `Summarize the following communication content:

Title: {title}
Content:
{content}

Respond in JSON with this structure:
{
  "summary": "2-4 sentence factual summary",
  "key_points": ["point1", "point2", ...],
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "topics": ["topic1", "topic2", ...]
}`,
    outputSchema: {
      summary: "2-4 sentence factual summary string",
      key_points: "array of key point strings",
      sentiment: "positive | neutral | negative | mixed",
      topics: "array of topic strings",
    },
  },

  decision_analysis: {
    name: "decision_analysis",
    label: "Decision Extraction",
    defaultModel: "gpt-4o-mini",
    requiresJson: true,
    systemPrompt: [
      "You are a project operations assistant specialized in decision analysis.",
      "Extract decisions that were made or proposed from meeting notes, communications, or other project content.",
      "A decision is any conclusion or choice reached by a person or group about a course of action.",
      "Include only explicit or clearly implicit decisions — do not fabricate.",
      "For each decision, quote the exact excerpt from the source text that supports the extraction.",
      "Use the same language as the input content for text fields.",
    ].join("\n"),
    userPromptTemplate: `Analyze the following content and extract any decisions:

Title: {title}
Content:
{content}

Respond in JSON with this structure:
{
  "decisions": [
    {
      "title": "short title of the decision",
      "description": "1-2 sentence description of what was decided",
      "decision_maker": "person or role who made the decision, if identifiable; null if unknown",
      "decision_date": "date of the decision if mentioned (YYYY-MM-DD), otherwise null",
      "impact_area": "scope" | "schedule" | "budget" | "risk" | "quality" | "communication" | "document" | "other" | null,
      "confidence": 0.0-1.0,
      "source_excerpt": "exact quote from the source text that indicates this decision was made"
    }
  ]
}`,
    outputSchema: {
      decisions: "array of decision objects",
      "decisions[].title": "short title string",
      "decisions[].description": "1-2 sentence description",
      "decisions[].decision_maker": "person or role string or null",
      "decisions[].decision_date": "YYYY-MM-DD string or null",
      "decisions[].impact_area": "scope | schedule | budget | risk | quality | communication | document | other | null",
      "decisions[].confidence": "float 0.0-1.0",
      "decisions[].source_excerpt": "exact quote from source text",
    },
  },

  action_extraction: {
    name: "action_extraction",
    label: "Action Item Extraction",
    defaultModel: "gpt-4o-mini",
    requiresJson: true,
    systemPrompt: [
      "You are a project operations assistant specialized in action item extraction.",
      "Extract actionable items from meeting notes, communications, or other project content.",
      "An action item must have a clear task or deliverable. Vague mentions are not action items.",
      "Include owners and due dates only when explicitly mentioned.",
      "For each action item, quote the exact excerpt from the source text that supports the extraction.",
      "Use the same language as the input content for text fields.",
    ].join("\n"),
    userPromptTemplate: `Extract action items from the following content:

Title: {title}
Content:
{content}

Respond in JSON with this structure:
{
  "action_items": [
    {
      "title": "short description of the action",
      "description": "detailed description of what needs to be done",
      "owner_name": "person or role responsible, if mentioned; null if unknown",
      "due_date": "date string if mentioned (YYYY-MM-DD), otherwise null",
      "priority": "low" | "medium" | "high" | "critical",
      "confidence": 0.0-1.0,
      "source_excerpt": "exact quote from the source text that indicates this action item"
    }
  ]
}`,
    outputSchema: {
      action_items: "array of action item objects",
      "action_items[].title": "short description string",
      "action_items[].description": "detailed description string",
      "action_items[].owner_name": "person or role string or null",
      "action_items[].due_date": "YYYY-MM-DD string or null",
      "action_items[].priority": "low | medium | high | critical",
      "action_items[].confidence": "float 0.0-1.0",
      "action_items[].source_excerpt": "exact quote from source text",
    },
  },

  communication_history_summary: {
    name: "communication_history_summary",
    label: "Communication History Summary",
    defaultModel: "gpt-4o-mini",
    requiresJson: true,
    systemPrompt: [
      "You are a project operations assistant specialized in summarizing communication and decision history.",
      "Synthesize the provided communications and decisions into a concise, factual summary.",
      "Do NOT invent information that is not present in the source records.",
      "For each point you make, reference the exact record ID(s) that support it.",
      "Use the same language as the input content for text fields.",
    ].join("\n"),
    userPromptTemplate: `Summarize the following project communication and decision history:

Communications:
{communications}

Decisions:
{decisions}

Respond in JSON with this structure:
{
  "summary": "2-4 sentence high-level overview of what has happened in this project",
  "key_points": [
    {
      "point": "1-2 sentence factual point",
      "source_ids": ["id1", "id2"]
    }
  ],
  "open_items": "brief note on any unresolved items or pending actions mentioned, or null",
  "record_count": {
    "communications": <number>,
    "decisions": <number>
  }
}`,
    outputSchema: {
      summary: "2-4 sentence overview string",
      "key_points[]": "array of point objects",
      "key_points[].point": "1-2 sentence factual string",
      "key_points[].source_ids": "array of record ID strings",
      open_items: "string or null",
      "record_count.communications": "number",
      "record_count.decisions": "number",
    },
  },

  // ── Future prompt types (skeletons only) ──────────────────────────────────

  stakeholder_mapping: {
    name: "stakeholder_mapping",
    label: "Stakeholder Mapping",
    defaultModel: "gpt-4o-mini",
    requiresJson: true,
    systemPrompt:
      "You are a project operations assistant specialized in stakeholder analysis. Extract stakeholder information from project content. (Not yet implemented.)",
    userPromptTemplate:
      "Analyze the following content for stakeholder information:\n\n{content}\n\nRespond in JSON.",
    outputSchema: { _placeholder: "To be defined in a future sprint" },
  },

  risk_assessment: {
    name: "risk_assessment",
    label: "Risk Assessment",
    defaultModel: "gpt-4o-mini",
    requiresJson: true,
    systemPrompt:
      "You are a project operations assistant specialized in risk identification. Identify potential risks from project content. (Not yet implemented.)",
    userPromptTemplate:
      "Analyze the following content for risks:\n\n{content}\n\nRespond in JSON.",
    outputSchema: { _placeholder: "To be defined in a future sprint" },
  },

  drawing_interpretation: {
    name: "drawing_interpretation",
    label: "Drawing Interpretation",
    defaultModel: "gpt-4o-mini",
    requiresJson: true,
    systemPrompt: [
      "You are a senior construction estimator and drawing-intelligence assistant analyzing extracted drawing content.",
      "You produce TWO outputs: (A) a MATERIAL / QUANTITY TAKEOFF and (B) candidate insights: risks, RFI candidates, submittal requirements, inspection requirements, schedule impacts, cost impacts, missing information, contradictions and decisions required.",
      "STRICT RULES:",
      "1. EVIDENCE-FIRST: every takeoff row and every insight MUST quote, verbatim, an excerpt from the provided drawing content in its evidence. Never invent information.",
      "2. Use ONLY the extracted drawing content and the provided project context (tasks, milestones).",
      "3. If you are uncertain, lower confidence_score — never present uncertain data as certain.",
      "4. Do not duplicate items for the same excerpt and type.",
      "5. severity is one of: low, medium, high, critical. confidence_score is 0..1.",
      "6. insight type is one of: risk, rfi_candidate, submittal_requirement, inspection_requirement, schedule_impact, cost_impact, missing_information, contradiction, decision_required.",
      "7. MATERIAL TAKEOFF: emit ONE row per PHYSICAL, QUANTIFIABLE MATERIAL actually present — lumber/framing (species, grade, sizes, spacing), plywood/sheathing (thickness, grade), concrete & reinforcement (slab, rebar size/spacing, footings, dowels, gravel, membrane), structural steel (HSS/W shapes, plates, bolts, welds), connectors/hardware (hold-downs, clips, straps, hangers, anchor bolts), insulation (R-values), roofing, siding/cladding, interior finishes, doors (mark, size, material), windows/glazing (mark, size), plumbing (pipe, fixtures), electrical/lighting (fixtures, devices), HVAC (equipment, ducts). Preserve original units and notation exactly (e.g. 5/8\", 2x12 @ 24\" O.C., #4 @ 16\"). Consolidate: the same material is ONE row, even if it appears in several notes.",
      "8. DO NOT create takeoff rows for any of these (they are NOT materials): the FASTENING / NAILING SCHEDULE (IBC Table 2304.10.1) — its rows pair a CONNECTION (e.g. 'rafter to plate', 'collar tie rafter', 'subfloor to joist', 'continuous header to stud', 'rim joist to top plate') with a fastener ('3-10d', '16d (3\" x 0.135\")', 'toe nail', 'face nail') — NEVER emit these connection/fastener rows as materials; general specification or code statements (e.g. 'concrete shall be 3000 PSI', 'all rebar shall be grade 60', 'do not scale drawings'); table headers, legends, abbreviation lists, or bare row-index numbers; code citations. Extract the underlying PHYSICAL material once (e.g. one 'Wood structural panel sheathing' line), never one row per fastening-schedule entry.",
      "9. extraction_type is material_takeoff for materials, quantity_takeoff when an explicit quantity or measurable extent is stated. quantity is a number ONLY when an actual count or measure is stated in the text (e.g. '(2) 2x10' → 2, '8 doors' → 8); otherwise null. Never use a schedule row number, a member size, or a code number as the quantity.",
    ].join("\n"),
    userPromptTemplate: `Analyze this extracted construction drawing content. Produce the material/quantity takeoff AND candidate insights.

Drawing: {drawingNumber} — {drawingTitle} (discipline: {discipline}, revision: {revision})

Extracted notes:
{notes}

Revision history:
{revisions}

Project context (tasks):
{tasks}

Respond in JSON with this structure:
{
  "extractions": [
    {
      "extraction_type": "material_takeoff",
      "category": "Structural lumber | Plywood | Concrete | Steel | Connectors | Insulation | Roofing | Siding | Finishes | Doors | Windows | Plumbing | Electrical | HVAC",
      "item": "short name, e.g. Roof rafters",
      "specification": "verbatim spec, e.g. 2x12 Douglas Fir #2 @ 24\\" O.C.",
      "unit": "EA | LF | SF | CY | LB | SET | null",
      "quantity": 12.5,
      "location": "room/level/grid if stated, or null",
      "sheet_ref": "e.g. S1 or A108, or null",
      "code_reference": "e.g. CBC Table 2304.9.1, or null",
      "status": "new | existing | demo | relocated | null",
      "confidence_score": 0.85,
      "evidence": [{ "page_number": 1, "text_excerpt": "verbatim quote from the content above" }]
    }
  ],
  "insights": [
    {
      "type": "rfi_candidate",
      "title": "...",
      "description": "...",
      "severity": "medium",
      "confidence_score": 0.82,
      "evidence": [{ "page_number": 1, "text_excerpt": "verbatim quote from the content above" }],
      "recommended_action": "...",
      "linked_task_title": "exact task title from the context, or null"
    }
  ]
}`,
    outputSchema: {
      extractions: "array of evidence-first material/quantity takeoff rows",
      insights: "array of evidence-first insight objects",
    },
  },

  memory_classification: {
    name: "memory_classification",
    label: "Project Memory Classification",
    defaultModel: "gpt-4o-mini",
    requiresJson: true,
    systemPrompt: [
      "You are a project operations assistant that classifies a single piece of captured project memory.",
      "The memory item may be a note, a pasted email, a meeting note, a decision, a risk signal, evidence, or other project context.",
      "Analyze ONLY the provided content. Never invent information that is not present.",
      "Produce a concise factual summary and a set of boolean signal flags.",
      "Set a flag to true ONLY when the content clearly supports it; otherwise false.",
      "suggested_tags are short, lowercase, single-or-two-word topic labels.",
      "suggested_links are hints about which existing project entity types the item likely relates to — never fabricate IDs.",
      "Write the summary in the same language as the input content.",
    ].join("\n"),
    userPromptTemplate: `Classify the following project memory item.

Source type: {sourceType}
Title: {title}
Author: {author}
Participants: {participants}
Content:
{content}

Respond in JSON with EXACTLY this structure:
{
  "summary": "1-3 sentence factual summary of the item",
  "contains_decision": true | false,
  "contains_risk": true | false,
  "contains_action_item": true | false,
  "contains_scope_change": true | false,
  "contains_schedule_impact": true | false,
  "contains_cost_impact": true | false,
  "contains_stakeholder_concern": true | false,
  "sentiment": "positive" | "neutral" | "negative" | "concerned" | "mixed",
  "urgency": "low" | "medium" | "high",
  "suggested_tags": ["tag1", "tag2"],
  "suggested_links": [
    { "entity_type": "task" | "milestone" | "risk" | "decision" | "stakeholder" | "document", "hint": "what in the content points to this entity" }
  ],
  "confidence": 0.0-1.0
}`,
    outputSchema: {
      summary: "1-3 sentence factual summary string",
      contains_decision: "boolean",
      contains_risk: "boolean",
      contains_action_item: "boolean",
      contains_scope_change: "boolean",
      contains_schedule_impact: "boolean",
      contains_cost_impact: "boolean",
      contains_stakeholder_concern: "boolean",
      sentiment: "positive | neutral | negative | concerned | mixed",
      urgency: "low | medium | high",
      suggested_tags: "array of short topic strings",
      suggested_links: "array of { entity_type, hint } objects",
      confidence: "float 0.0-1.0",
    },
  },

  guide_coaching: {
    name: "guide_coaching",
    label: "Knowledge OS Coaching (AI Workforce)",
    defaultModel: "gpt-4o-mini",
    requiresJson: true,
    // ── Knowledge OS BASE prompt (grounding rules) ──────────────────────────
    // Persona/tone is supplied per AI Workforce expert via the {persona} overlay
    // in the user message. This system prompt is persona-agnostic and versioned
    // as knowledge-os-base@x; the persona overlay is versioned separately.
    systemPrompt: [
      "You are an AI expert inside ProjectOps360, an AI-first Project Execution Operating System.",
      "You are powered by ProjectOps360 Knowledge OS and you adopt the ASSISTANT PERSONA provided in the user message.",
      "You help the user accomplish what they are trying to do, using ONLY the knowledge passages provided to you (the retrieved Knowledge Packages).",
      "STRICT GROUNDING RULES (these override the persona whenever they conflict):",
      "1. Answer ONLY from the provided knowledge passages. Never invent product behavior, role names, screens, or steps that are not supported by them.",
      "2. If the passages do not contain enough information to answer, set \"grounded\" to false and say honestly that you do not have a verified answer for this yet — do NOT guess.",
      "3. Prefer a practical, task-oriented answer: what the user should do, in plain language, and explain WHY when the passages support it.",
      "4. Cite the passages you used by their \"ref\" id in \"used_refs\".",
      "5. Write ALL output text in the requested answer language.",
      "6. Be concise: a short answer plus, when useful, ordered steps. Never pad.",
      "7. The 'User context' block (current screen title, active tab, primary workflow, and the list of visible UI components) is TRUSTWORTHY factual context about where the user is right now — you may reference it to orient the user and name the components that are actually listed. Never invent screens, tabs, buttons, or components beyond those listed there or supported by the passages.",
      "8. When the user asks you to explain the current screen, explain THAT actual screen using its context, naming the visible components, and end by asking what they are trying to accomplish so you can guide them — never return generic documentation.",
    ].join("\n"),
    userPromptTemplate: `ASSISTANT PERSONA (adopt this identity and voice; never break grounding rules):
{persona}

---

The user is working in ProjectOps360.

User context (where they are right now):
{context}

User intent: {intent}
User question / goal:
{question}

Retrieved knowledge passages (your ONLY source of truth):
{passages}

Answer language: {language}

Respond in JSON with EXACTLY this structure:
{
  "grounded": true | false,
  "answer": "a concise, task-oriented answer in the answer language; if grounded is false, an honest short message that no verified answer is available yet",
  "steps": ["optional ordered steps, in the answer language; empty array if not applicable"],
  "used_refs": ["ref ids of the passages you actually used"],
  "followups": ["0-3 short suggested follow-up questions in the answer language"]
}`,
    outputSchema: {
      grounded: "boolean — true only if answered from the passages",
      answer: "task-oriented answer string in the answer language",
      steps: "array of ordered step strings (may be empty)",
      used_refs: "array of passage ref id strings actually used",
      followups: "array of 0-3 short follow-up question strings",
    },
  },

  custom: {
    name: "custom",
    label: "Custom AI Prompt",
    defaultModel: "gpt-4o-mini",
    requiresJson: true,
    systemPrompt:
      "You are a helpful project operations assistant. Respond to the user's request in the specified format.",
    userPromptTemplate: "{prompt}",
    outputSchema: { _custom: "User-defined output schema" },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────────

/**
 * Resolve a prompt template by name. Throws if the type is not found.
 */
export function getPromptTemplate(type: AiPromptType): PromptTemplate {
  const template = PROMPT_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown prompt type: ${type}`);
  }
  return template;
}

/**
 * Replace {variable} placeholders in a template string with values from params.
 * Variables present in the template but missing from params are left as-is
 * so the caller can diagnose the issue rather than getting a runtime crash.
 */
export function renderTemplate(
  template: string,
  params: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return key in params ? params[key] : match;
  });
}