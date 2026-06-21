// ============================================================================
// assemblyAiService — AssemblyAI transcription client (SERVER-ONLY)
// ============================================================================
// ⚠️ Reads ASSEMBLYAI_API_KEY from the server environment. This module must
// NEVER be imported by client components — only by server actions (which carry
// the "use server" boundary). The key is never sent to the browser.
// ============================================================================

const BASE = "https://api.assemblyai.com/v2";

function apiKey(): string {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) throw new Error("ASSEMBLYAI_API_KEY is not set");
  return key;
}

export type AssemblyStatus = "queued" | "processing" | "completed" | "error";

export interface AssemblyUtterance {
  speaker: string;
  text: string;
  start: number; // ms
  end: number; // ms
  confidence: number;
}

export interface AssemblyTranscript {
  id: string;
  status: AssemblyStatus;
  text: string | null;
  utterances: AssemblyUtterance[] | null;
  confidence: number | null;
  audio_duration: number | null; // seconds
  language_code: string | null;
  error: string | null;
  /** The full unmodified API payload (persisted as raw_response). */
  raw: Record<string, unknown>;
}

// ── Settings (speaker_labels MUST stay enabled) ────────────────────────────────

const TRANSCRIPT_SETTINGS = {
  speaker_labels: true,
  language_detection: true,
  auto_chapters: false,
  entity_detection: false,
  iab_categories: false,
  sentiment_analysis: false,
  summarization: false,
} as const;

// ── uploadAudio — POST raw bytes, returns an AssemblyAI upload_url ──────────────
// Not used by the default flow (we pass a Supabase signed URL straight to
// createTranscript), but provided per the service contract for callers that
// prefer to stream bytes rather than expose a URL.

export async function uploadAudio(audioBytes: ArrayBuffer | Buffer): Promise<string> {
  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: { authorization: apiKey() },
    body: audioBytes as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`AssemblyAI upload failed (${res.status}): ${await safeText(res)}`);
  }
  const json = (await res.json()) as { upload_url: string };
  return json.upload_url;
}

// ── createTranscript — submit a transcription job ──────────────────────────────

export async function createTranscript(audioUrl: string): Promise<AssemblyTranscript> {
  const res = await fetch(`${BASE}/transcript`, {
    method: "POST",
    headers: { authorization: apiKey(), "content-type": "application/json" },
    body: JSON.stringify({ audio_url: audioUrl, ...TRANSCRIPT_SETTINGS }),
  });
  if (!res.ok) {
    throw new Error(`AssemblyAI createTranscript failed (${res.status}): ${await safeText(res)}`);
  }
  return normalize((await res.json()) as Record<string, unknown>);
}

// ── getTranscript — fetch current state ────────────────────────────────────────

export async function getTranscript(transcriptId: string): Promise<AssemblyTranscript> {
  const res = await fetch(`${BASE}/transcript/${transcriptId}`, {
    headers: { authorization: apiKey() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`AssemblyAI getTranscript failed (${res.status}): ${await safeText(res)}`);
  }
  return normalize((await res.json()) as Record<string, unknown>);
}

// ── pollTranscriptUntilFinished — server-side blocking poll ────────────────────
// Provided for a future background worker. The interactive flow polls from the
// client (pollTranscriptionAction) to avoid long-running serverless requests.

export async function pollTranscriptUntilFinished(
  transcriptId: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<AssemblyTranscript> {
  const intervalMs = opts?.intervalMs ?? 5000;
  const timeoutMs = opts?.timeoutMs ?? 1000 * 60 * 10;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const t = await getTranscript(transcriptId);
    if (t.status === "completed" || t.status === "error") return t;
    if (Date.now() > deadline) throw new Error("AssemblyAI polling timed out");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// ── helpers ────────────────────────────────────────────────────────────────────

function normalize(raw: Record<string, unknown>): AssemblyTranscript {
  return {
    id: String(raw.id ?? ""),
    status: (raw.status as AssemblyStatus) ?? "queued",
    text: (raw.text as string | null) ?? null,
    utterances: (raw.utterances as AssemblyUtterance[] | null) ?? null,
    confidence: (raw.confidence as number | null) ?? null,
    audio_duration: (raw.audio_duration as number | null) ?? null,
    language_code: (raw.language_code as string | null) ?? null,
    error: (raw.error as string | null) ?? null,
    raw,
  };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}
