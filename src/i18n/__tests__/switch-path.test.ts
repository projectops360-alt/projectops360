import { describe, it, expect } from "vitest";
import { buildLocaleSwitchPath } from "../switch-path";

const LOCALES = ["en", "es"] as const;
const DEFAULT = "en";

const sw = (path: string, to: string) => buildLocaleSwitchPath(path, to, LOCALES, DEFAULT);

describe("buildLocaleSwitchPath (localePrefix: as-needed)", () => {
  it("adds the prefix for a non-default locale from an unprefixed path", () => {
    expect(sw("/projects/abc/workboard", "es")).toBe("/es/projects/abc/workboard");
    expect(sw("/", "es")).toBe("/es");
    expect(sw("/team", "es")).toBe("/es/team");
  });

  it("removes the prefix when switching to the default locale", () => {
    expect(sw("/es/projects/abc/workboard", "en")).toBe("/projects/abc/workboard");
    expect(sw("/es", "en")).toBe("/");
    expect(sw("/es/team", "en")).toBe("/team");
  });

  it("never double-prefixes when already on the target locale path", () => {
    // es → es (defensive): strip then re-add, no /es/es
    expect(sw("/es/projects/abc", "es")).toBe("/es/projects/abc");
    // en → en
    expect(sw("/projects/abc", "en")).toBe("/projects/abc");
  });

  it("does not treat lookalike segments as a locale prefix", () => {
    // 'english' starts with 'en' but is not the 'en' segment
    expect(sw("/english-docs", "es")).toBe("/es/english-docs");
    expect(sw("/establish/x", "en")).toBe("/establish/x");
  });

  it("handles the root for the default locale", () => {
    expect(sw("/", "en")).toBe("/");
    expect(sw("/es", "en")).toBe("/");
  });
});
