// ============================================================================
// ProjectOps360° — Isabella Voice · answer-to-speech sanitizer (pure)
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE
//
// Isabella's panel answers are markdown (links, bold, tables, lists). The
// realtime model speaks — so the bridge converts an answer into clean,
// listenable text and bounds its length (voice answers must be short; the
// panel remains the place for long detail). Pure; no I/O.
// ============================================================================

/** Max characters handed to the speech model per answer (~90 seconds spoken). */
export const SPEECH_ANSWER_MAX_CHARS = 1200;

export interface SpeechText {
  text: string;
  truncated: boolean;
}

/** Strip the markdown Isabella renders so it isn't read aloud literally. */
export function stripMarkdownForSpeech(text: string): string {
  return (
    text
      // fenced code blocks → omitted (never speakable)
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      // [label](href) → label
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // bold / italics / strikethrough
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/~~([^~]+)~~/g, "$1")
      // headers / blockquotes / bullets → plain sentences
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/^\s*[-*•]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      // table syntax: separator rows out, pipes → comma pauses
      .replace(/^\s*\|?[\s:|-]+\|[\s:|-]+$/gm, " ")
      .replace(/\s*\|\s*/g, ", ")
      // collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Truncate at a sentence boundary near the limit (never mid-number/word). */
export function boundForSpeech(text: string, maxChars = SPEECH_ANSWER_MAX_CHARS): SpeechText {
  if (text.length <= maxChars) return { text, truncated: false };
  const head = text.slice(0, maxChars);
  const lastSentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "));
  const cut = lastSentence > maxChars * 0.5 ? lastSentence + 1 : (head.lastIndexOf(" ") > 0 ? head.lastIndexOf(" ") : maxChars);
  return { text: head.slice(0, cut).trim(), truncated: true };
}

/** Full pipeline: markdown → clean bounded speakable text. */
export function toSpeechText(answer: string, maxChars = SPEECH_ANSWER_MAX_CHARS): SpeechText {
  return boundForSpeech(stripMarkdownForSpeech(answer), maxChars);
}
