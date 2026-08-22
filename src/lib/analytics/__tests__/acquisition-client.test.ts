import { describe, expect, it } from "vitest";
import { aiEngineForSource } from "../acquisition-client";

describe("aiEngineForSource", () => {
  it.each([
    ["chatgpt.com", "chatgpt"],
    ["chat.openai.com", "chatgpt"],
    ["chatgpt", "chatgpt"],
    ["openai", "chatgpt"],
    ["gemini.google.com", "gemini"],
    ["gemini", "gemini"],
    ["claude.ai", "claude"],
    ["anthropic", "claude"],
    ["perplexity.ai", "perplexity"],
    ["perplexity", "perplexity"],
    ["copilot.microsoft.com", "copilot"],
    ["copilot", "copilot"],
  ])("maps %s to %s", (source, expected) => {
    expect(aiEngineForSource(source)).toBe(expected);
  });

  it("does not classify ordinary search/social sources as AI", () => {
    expect(aiEngineForSource("google.com")).toBeNull();
    expect(aiEngineForSource("linkedin.com")).toBeNull();
  });
});
