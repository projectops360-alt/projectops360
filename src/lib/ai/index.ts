// ── Provider ────────────────────────────────────────────────────────────────
export { OpenAiProvider } from "./provider";
export type { AiProvider, AiGenerateOptions, AiGenerateResult } from "./provider";

// ── Prompts ──────────────────────────────────────────────────────────────────
export {
  PROMPT_TEMPLATES,
  getPromptTemplate,
  renderTemplate,
} from "./prompts";
export type { PromptTemplate } from "./prompts";

// ── Service ──────────────────────────────────────────────────────────────────
export { runAi, setProvider } from "./service";
export type { RunAiInput, RunAiResult } from "./service";