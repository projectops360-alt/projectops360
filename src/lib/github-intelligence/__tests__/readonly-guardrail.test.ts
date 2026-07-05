import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Read-only guardrail: this task must never write to GitHub. We assert the
// GitHub client source only issues GET requests and exposes no mutating verbs.
// (Static-source assertion so it can never silently regress.)

const RAW = readFileSync(path.resolve(__dirname, "../client.ts"), "utf8");

// Strip comments so guarantees documented in prose (e.g. "no ...dispatch")
// don't trip the substring checks below.
const CODE = RAW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("GitHub client is READ-ONLY", () => {
  it("issues only GET requests", () => {
    expect(CODE).toContain('method: "GET"');
    for (const verb of ['method: "POST"', 'method: "PUT"', 'method: "PATCH"', 'method: "DELETE"']) {
      expect(CODE).not.toContain(verb);
    }
  });

  it("exposes no write/mutation method names", () => {
    const forbidden = [
      "createCommit", "mergePull", "closePull", "createComment", "updateComment",
      "createStatus", "setStatus", "repositoryDispatch", "createRelease", "deleteRef",
      "updateRef", "createRef", "closeIssue", "createIssue", "updateIssue",
    ];
    for (const name of forbidden) {
      expect(CODE).not.toContain(name);
    }
  });

  it("only declares list*/get* client methods on the GitHubClient interface", () => {
    const iface = CODE.match(/interface GitHubClient \{([\s\S]*?)\n\}/);
    expect(iface).toBeTruthy();
    const methodNames = [...iface![1].matchAll(/^\s+(\w+)\s*\(/gm)].map((m) => m[1]);
    expect(methodNames.length).toBeGreaterThan(0);
    for (const name of methodNames) {
      expect(name.startsWith("list") || name.startsWith("get")).toBe(true);
    }
  });
});
