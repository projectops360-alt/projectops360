"use client";

export type AiEngine = "chatgpt" | "gemini" | "claude" | "perplexity" | "copilot";
export type SourceClass = "ai" | "search" | "social" | "referral" | "campaign" | "direct" | "other";

export interface AcquisitionTouch {
  sourceClass: SourceClass;
  aiEngine: AiEngine | null;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  referrerHost: string;
  landingPath: string;
  touchedAt: string;
}

export interface AcquisitionEnvelope {
  first: AcquisitionTouch;
  last: AcquisitionTouch;
}

const STORAGE_KEY = "projectops360_acquisition_v1";
const MAX = 240;

function clean(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, MAX);
}

function aiEngineForHost(host: string): AiEngine | null {
  const h = host.toLowerCase();
  if (h === "chatgpt.com" || h.endsWith(".chatgpt.com") || h === "chat.openai.com") return "chatgpt";
  if (h === "gemini.google.com" || h.endsWith(".gemini.google.com")) return "gemini";
  if (h === "claude.ai" || h.endsWith(".claude.ai")) return "claude";
  if (h === "perplexity.ai" || h.endsWith(".perplexity.ai")) return "perplexity";
  if (h === "copilot.microsoft.com" || h.endsWith(".copilot.microsoft.com")) return "copilot";
  return null;
}

function classify(host: string, hasCampaign: boolean): { sourceClass: SourceClass; aiEngine: AiEngine | null } {
  const aiEngine = aiEngineForHost(host);
  if (aiEngine) return { sourceClass: "ai", aiEngine };
  if (hasCampaign) return { sourceClass: "campaign", aiEngine: null };
  const h = host.toLowerCase();
  if (/google\.|bing\.|duckduckgo\.|yahoo\./.test(h)) return { sourceClass: "search", aiEngine: null };
  if (/linkedin\.|facebook\.|instagram\.|tiktok\.|x\.com$|twitter\./.test(h)) return { sourceClass: "social", aiEngine: null };
  if (host) return { sourceClass: "referral", aiEngine: null };
  return { sourceClass: "direct", aiEngine: null };
}

function externalReferrerHost(): string {
  if (!document.referrer) return "";
  try {
    const ref = new URL(document.referrer);
    if (ref.origin === window.location.origin) return "";
    return ref.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function currentTouch(): AcquisitionTouch {
  const params = new URLSearchParams(window.location.search);
  const referrerHost = externalReferrerHost();
  const source = clean(params.get("utm_source"));
  const medium = clean(params.get("utm_medium"));
  const campaign = clean(params.get("utm_campaign"));
  const content = clean(params.get("utm_content"));
  const term = clean(params.get("utm_term"));
  const hasCampaign = Boolean(source || medium || campaign || content || term);
  const classified = classify(referrerHost, hasCampaign);
  const aiEngine = classified.aiEngine ?? aiEngineForHost(source);

  return {
    sourceClass: aiEngine ? "ai" : classified.sourceClass,
    aiEngine,
    source: source || aiEngine || referrerHost || classified.sourceClass,
    medium: medium || (aiEngine ? "ai_referral" : classified.sourceClass),
    campaign,
    content,
    term,
    referrerHost: clean(referrerHost),
    landingPath: clean(`${window.location.pathname}${window.location.search}`),
    touchedAt: new Date().toISOString(),
  };
}

export function readAcquisitionEnvelope(): AcquisitionEnvelope | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AcquisitionEnvelope;
    if (!parsed?.first || !parsed?.last) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function captureAcquisitionTouch(): AcquisitionEnvelope {
  const touch = currentTouch();
  const existing = readAcquisitionEnvelope();

  // Internal navigation has no external referrer and no campaign. Preserve the
  // previous last touch rather than turning a valid AI referral into "direct".
  const meaningful = touch.sourceClass !== "direct" || Boolean(touch.campaign);
  const envelope: AcquisitionEnvelope = existing
    ? { first: existing.first, last: meaningful ? touch : existing.last }
    : { first: touch, last: touch };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Attribution is non-critical. Signup must still work when storage is blocked.
  }
  return envelope;
}

export function appendAcquisitionToFormData(formData: FormData): void {
  const envelope = captureAcquisitionTouch();
  const put = (prefix: "first" | "last", t: AcquisitionTouch) => {
    formData.set(`${prefix}_source_class`, t.sourceClass);
    formData.set(`${prefix}_ai_engine`, t.aiEngine ?? "");
    formData.set(`${prefix}_source`, t.source);
    formData.set(`${prefix}_medium`, t.medium);
    formData.set(`${prefix}_campaign`, t.campaign);
    formData.set(`${prefix}_content`, t.content);
    formData.set(`${prefix}_term`, t.term);
    formData.set(`${prefix}_referrer_host`, t.referrerHost);
    formData.set(`${prefix}_landing_path`, t.landingPath);
    formData.set(`${prefix}_touch_at`, t.touchedAt);
  };
  put("first", envelope.first);
  put("last", envelope.last);
}
