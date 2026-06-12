// ============================================================================
// ProjectOps360° — Drawing Extraction Heuristics (Prompt 3)
// ============================================================================
// Pure text-based extractors: title block, revision block, notes sections and
// discipline classification. They operate on per-page extracted text (vector
// PDFs) and always return confidence + evidence. No I/O — fully testable.
// ============================================================================

// ── Shared types ──────────────────────────────────────────────────────────────

export interface FieldEvidence {
  page_number: number;
  text_excerpt: string;
}

export interface ExtractedField {
  field: string;
  value: string;
  confidence_score: number;
  method: "title_block_heuristic" | "pattern_match" | "filename_fallback" | "discipline_prefix" | "keyword_match";
  evidence: FieldEvidence;
}

export interface TitleBlockResult {
  fields: ExtractedField[];
  /** Convenience map: field name → value */
  values: Record<string, string>;
  /** Mean confidence across extracted fields (0 when none) */
  confidence: number;
}

export interface RevisionEntry {
  revision: string;
  revision_date: string | null;
  description: string | null;
  issued_by: string | null;
  confidence_score: number;
  evidence: FieldEvidence;
}

export interface ExtractedNote {
  note_id: string;
  text: string;
  category: string;
  page_number: number;
  confidence_score: number;
  evidence: FieldEvidence;
}

export interface DisciplineResult {
  discipline: string;
  confidence_score: number;
  method: ExtractedField["method"];
  evidence: FieldEvidence | null;
}

/** Confidence below this marks the extraction as needs_review */
export const CONFIDENCE_REVIEW_THRESHOLD = 0.7;

const excerpt = (s: string, max = 160): string =>
  s.length > max ? s.slice(0, max - 1) + "…" : s;

// ── Title block extraction ────────────────────────────────────────────────────
// Heuristic: labeled fields anywhere in the page text. Title blocks are
// usually bottom-right, but text extraction loses layout — labels are the
// strongest layout-free signal. Filename fallback fills gaps at low confidence.

const TITLE_BLOCK_LABELS: { field: string; patterns: RegExp[]; confidence: number }[] = [
  {
    field: "drawing_number",
    confidence: 0.91,
    patterns: [
      /(?:DRAWING|DWG|SHEET)\s*(?:NO|NUMBER|#)\.?\s*[:.]?\s*([A-Z]{1,3}[-_ ]?\d{2,4}(?:\.\d+)?)/i,
    ],
  },
  {
    field: "sheet_number",
    confidence: 0.85,
    patterns: [/SHEET\s*[:.]?\s*([A-Z]{0,3}[-_ ]?\d{1,4}(?:\s+OF\s+\d{1,4})?)/i],
  },
  {
    field: "drawing_title",
    confidence: 0.8,
    patterns: [/(?:DRAWING\s+)?TITLE\s*[:.]\s*([^\n]{3,80})/i],
  },
  {
    field: "project_name",
    confidence: 0.75,
    patterns: [/PROJECT\s*(?:NAME)?\s*[:.]\s*([^\n]{3,80})/i],
  },
  {
    field: "revision",
    confidence: 0.85,
    patterns: [/\bREV(?:ISION)?\.?\s*[:.]?\s*([A-Z0-9]{1,3})\b/i],
  },
  {
    field: "revision_date",
    confidence: 0.8,
    patterns: [
      /REV(?:ISION)?\.?\s*DATE\s*[:.]?\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i,
    ],
  },
  {
    field: "issue_date",
    confidence: 0.75,
    patterns: [/(?:ISSUE\s+)?DATE\s*[:.]?\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i],
  },
  {
    field: "scale",
    confidence: 0.85,
    patterns: [/SCALE\s*[:.]?\s*((?:[\d/]+["']?\s*=\s*[\d'\-"]+|NTS|AS\s+NOTED|N\.T\.S\.?)[^\n]{0,20})/i],
  },
  {
    field: "drawn_by",
    confidence: 0.8,
    patterns: [/DRAWN\s*(?:BY)?\s*[:.]?\s*([A-Z][A-Za-z. ]{1,30})/i],
  },
  {
    field: "checked_by",
    confidence: 0.8,
    patterns: [/CHECKED\s*(?:BY)?\s*[:.]?\s*([A-Z][A-Za-z. ]{1,30})/i],
  },
  {
    field: "approved_by",
    confidence: 0.8,
    patterns: [/APPROVED\s*(?:BY)?\s*[:.]?\s*([A-Z][A-Za-z. ]{1,30})/i],
  },
];

/** Bare drawing-number pattern (no label) — lower confidence */
const BARE_DRAWING_NUMBER = /\b([A-Z]{1,2}P?[-]\d{3}(?:\.\d+)?)\b/;

export function extractTitleBlock(
  pageText: string,
  pageNumber: number,
  fileName: string,
): TitleBlockResult {
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();

  for (const { field, patterns, confidence } of TITLE_BLOCK_LABELS) {
    for (const pattern of patterns) {
      const match = pageText.match(pattern);
      if (match && match[1] && !seen.has(field)) {
        seen.add(field);
        fields.push({
          field,
          value: match[1].trim().replace(/\s+/g, " "),
          confidence_score: confidence,
          method: "title_block_heuristic",
          evidence: { page_number: pageNumber, text_excerpt: excerpt(match[0]) },
        });
        break;
      }
    }
  }

  // Unlabeled drawing number pattern
  if (!seen.has("drawing_number")) {
    const bare = pageText.match(BARE_DRAWING_NUMBER);
    if (bare) {
      seen.add("drawing_number");
      fields.push({
        field: "drawing_number",
        value: bare[1].toUpperCase(),
        confidence_score: 0.6,
        method: "pattern_match",
        evidence: { page_number: pageNumber, text_excerpt: excerpt(bare[0]) },
      });
    }
  }

  // Filename fallback for drawing number
  if (!seen.has("drawing_number")) {
    const fromName = fileName.match(/^([A-Z]{1,3}[-_ ]?\d{2,4}(?:\.\d+)?)/i);
    if (fromName) {
      seen.add("drawing_number");
      fields.push({
        field: "drawing_number",
        value: fromName[1].replace(/[_ ]/g, "-").toUpperCase(),
        confidence_score: 0.5,
        method: "filename_fallback",
        evidence: { page_number: pageNumber, text_excerpt: excerpt(fileName) },
      });
    }
  }

  const values: Record<string, string> = {};
  for (const f of fields) values[f.field] = f.value;
  const confidence =
    fields.length > 0
      ? fields.reduce((sum, f) => sum + f.confidence_score, 0) / fields.length
      : 0;

  return { fields, values, confidence: Math.round(confidence * 100) / 100 };
}

// ── Revision block extraction ─────────────────────────────────────────────────
// Looks for table-like revision rows: "<rev> <date> <description> [by]".

const REVISION_ROW =
  /^\s*(?:REV\.?\s*)?([A-Z]|\d{1,2}|R\d{1,2})\s+(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})\s+([^\n]{3,100}?)(?:\s{2,}([A-Z]{2,4}))?\s*$/;

export function extractRevisionBlock(
  pageText: string,
  pageNumber: number,
): RevisionEntry[] {
  const entries: RevisionEntry[] = [];
  const lines = pageText.split("\n");

  // Only scan when a revision header exists on the page — avoids false
  // positives from dimension strings.
  const hasHeader = /\bREV(?:ISION)?S?\b/i.test(pageText);
  if (!hasHeader) return entries;

  for (const line of lines) {
    const match = line.match(REVISION_ROW);
    if (!match) continue;
    const description = match[3]?.trim() ?? null;
    // Skip rows whose "description" looks like a label line
    if (description && /^(DATE|DESCRIPTION|BY)$/i.test(description)) continue;
    entries.push({
      revision: match[1].toUpperCase(),
      revision_date: match[2] ?? null,
      description,
      issued_by: match[4]?.trim() ?? null,
      confidence_score: match[4] ? 0.85 : 0.75,
      evidence: { page_number: pageNumber, text_excerpt: excerpt(line.trim()) },
    });
    if (entries.length >= 20) break; // sanity cap
  }
  return entries;
}

// ── Notes extraction ──────────────────────────────────────────────────────────

const NOTE_SECTION_HEADERS: { category: string; pattern: RegExp }[] = [
  { category: "general_notes", pattern: /\bGENERAL\s+NOTES\b/i },
  { category: "keynotes", pattern: /\bKEY\s*NOTES\b/i },
  { category: "sheet_notes", pattern: /\bSHEET\s+NOTES\b/i },
  { category: "construction_notes", pattern: /\bCONSTRUCTION\s+NOTES\b/i },
  { category: "demolition_notes", pattern: /\bDEMOLITION\s+NOTES\b/i },
  { category: "mechanical_notes", pattern: /\bMECHANICAL\s+NOTES\b/i },
  { category: "electrical_notes", pattern: /\bELECTRICAL\s+NOTES\b/i },
  { category: "plumbing_notes", pattern: /\bPLUMBING\s+NOTES\b/i },
  { category: "structural_notes", pattern: /\bSTRUCTURAL\s+NOTES\b/i },
];

/** A note item: "1. text", "12. text", "N1 text", "A. text" */
const NOTE_ITEM = /^\s*(?:(\d{1,2})[.)]\s+|(N\d{1,2})\s+|([A-Z])[.)]\s+)(.{4,})$/;

const MAX_NOTE_LENGTH = 600;

export function extractNotes(pageText: string, pageNumber: number): ExtractedNote[] {
  const notes: ExtractedNote[] = [];
  const lines = pageText.split("\n");

  let currentCategory: string | null = null;
  let counter = 0;
  let openNote: ExtractedNote | null = null;

  const closeNote = () => {
    if (openNote) {
      openNote.text = openNote.text.trim();
      openNote.evidence.text_excerpt = excerpt(openNote.text);
      notes.push(openNote);
      openNote = null;
    }
  };

  for (const line of lines) {
    // Section header switches category
    const header = NOTE_SECTION_HEADERS.find((h) => h.pattern.test(line));
    if (header) {
      closeNote();
      currentCategory = header.category;
      counter = 0;
      continue;
    }
    if (!currentCategory) continue;

    const item = line.match(NOTE_ITEM);
    if (item) {
      closeNote();
      counter++;
      const explicitId = item[1] ?? item[2] ?? item[3];
      openNote = {
        note_id: item[2] ?? `N${explicitId ?? counter}`,
        text: item[4].trim(),
        category: currentCategory,
        page_number: pageNumber,
        confidence_score: 0.87,
        evidence: { page_number: pageNumber, text_excerpt: excerpt(line.trim()) },
      };
      if (notes.length >= 200) break; // sanity cap
    } else if (openNote && line.trim() !== "") {
      // Continuation line: notes wrap across lines in real drawings —
      // append so keyword rules see the full sentence, with a length cap.
      if (openNote.text.length < MAX_NOTE_LENGTH) {
        openNote.text = `${openNote.text} ${line.trim()}`.slice(0, MAX_NOTE_LENGTH);
      }
    } else if (line.trim() === "") {
      // Blank line ends the current note but keeps the section open
      closeNote();
    }
  }
  closeNote();
  return notes;
}

// ── Discipline classification ─────────────────────────────────────────────────

const DISCIPLINE_PREFIXES: { prefix: RegExp; discipline: string }[] = [
  { prefix: /^FP/i, discipline: "Fire Protection" },
  { prefix: /^A/i, discipline: "Architectural" },
  { prefix: /^S/i, discipline: "Structural" },
  { prefix: /^M/i, discipline: "Mechanical" },
  { prefix: /^E/i, discipline: "Electrical" },
  { prefix: /^P/i, discipline: "Plumbing" },
  { prefix: /^C/i, discipline: "Civil" },
  { prefix: /^G/i, discipline: "General" },
];

const DISCIPLINE_KEYWORDS: { keyword: RegExp; discipline: string }[] = [
  { keyword: /\bFIRE\s+(PROTECTION|SPRINKLER|ALARM)\b/i, discipline: "Fire Protection" },
  { keyword: /\bARCHITECTUR/i, discipline: "Architectural" },
  { keyword: /\bSTRUCTUR/i, discipline: "Structural" },
  { keyword: /\bMECHANICAL\b|\bHVAC\b/i, discipline: "Mechanical" },
  { keyword: /\bELECTRICAL\b|\bPOWER\s+PLAN\b|\bLIGHTING\b/i, discipline: "Electrical" },
  { keyword: /\bPLUMBING\b/i, discipline: "Plumbing" },
  { keyword: /\bCIVIL\b|\bGRADING\b/i, discipline: "Civil" },
  { keyword: /\bSITE\s+PLAN\b/i, discipline: "Site" },
];

export function classifyDiscipline(input: {
  drawingNumber: string | null;
  title: string | null;
  fileName: string;
  pageText: string;
  pageNumber: number;
}): DisciplineResult {
  // 1. Drawing number prefix — strongest signal
  if (input.drawingNumber) {
    const match = DISCIPLINE_PREFIXES.find((d) => d.prefix.test(input.drawingNumber!));
    if (match) {
      return {
        discipline: match.discipline,
        confidence_score: 0.9,
        method: "discipline_prefix",
        evidence: { page_number: input.pageNumber, text_excerpt: input.drawingNumber },
      };
    }
  }

  // 2. Keywords in title / page text / file name
  const haystacks: { text: string; confidence: number }[] = [
    { text: input.title ?? "", confidence: 0.8 },
    { text: input.pageText, confidence: 0.7 },
    { text: input.fileName, confidence: 0.6 },
  ];
  for (const { text, confidence } of haystacks) {
    if (!text) continue;
    for (const { keyword, discipline } of DISCIPLINE_KEYWORDS) {
      const m = text.match(keyword);
      if (m) {
        return {
          discipline,
          confidence_score: confidence,
          method: "keyword_match",
          evidence: { page_number: input.pageNumber, text_excerpt: excerpt(m[0]) },
        };
      }
    }
  }

  return { discipline: "Unknown", confidence_score: 0, method: "pattern_match", evidence: null };
}
