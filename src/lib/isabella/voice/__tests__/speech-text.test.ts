// ============================================================================
// Isabella Voice — answer-to-speech sanitizer (ISABELLA-VOICE-REALTIME-BRIDGE)
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  stripMarkdownForSpeech,
  boundForSpeech,
  toSpeechText,
  SPEECH_ANSWER_MAX_CHARS,
} from "@/lib/isabella/voice/speech-text";

describe("stripMarkdownForSpeech", () => {
  it("strips links, bold, italics and inline code", () => {
    expect(stripMarkdownForSpeech("Open [Workboard](/board) and see **3 tasks** with `p1` *priority*.")).toBe(
      "Open Workboard and see 3 tasks with p1 priority.",
    );
  });

  it("flattens headers, bullets and numbered lists into sentences", () => {
    const md = "## Summary\n- First task\n- Second task\n1. Step one\n> note";
    expect(stripMarkdownForSpeech(md)).toBe("Summary First task Second task Step one note");
  });

  it("converts table pipes to comma pauses and drops separator rows", () => {
    const md = "| Task | Status |\n| --- | --- |\n| Foundation | Done |";
    const out = stripMarkdownForSpeech(md);
    expect(out).not.toContain("|");
    expect(out).not.toContain("---");
    expect(out).toContain("Task, Status");
    expect(out).toContain("Foundation, Done");
  });

  it("omits fenced code blocks entirely", () => {
    expect(stripMarkdownForSpeech("Before\n```sql\nSELECT 1;\n```\nAfter")).toBe("Before After");
  });
});

describe("boundForSpeech", () => {
  it("returns short text untouched", () => {
    expect(boundForSpeech("Hola.")).toEqual({ text: "Hola.", truncated: false });
  });

  it("truncates long text at a sentence boundary and flags it", () => {
    const sentence = "This is a complete sentence about the project. ";
    const long = sentence.repeat(60); // ~2880 chars
    const out = boundForSpeech(long);
    expect(out.truncated).toBe(true);
    expect(out.text.length).toBeLessThanOrEqual(SPEECH_ANSWER_MAX_CHARS);
    expect(out.text.endsWith(".")).toBe(true);
  });
});

describe("toSpeechText", () => {
  it("produces clean bounded speech from markdown", () => {
    const out = toSpeechText("**Hello** — see [tasks](/tasks).");
    expect(out).toEqual({ text: "Hello — see tasks.", truncated: false });
  });
});
