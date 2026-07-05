import { describe, it, expect } from "vitest";
import { classifyBranch, refToBranchName } from "../branch-classification";

describe("classifyBranch", () => {
  it("classifies main-like branches", () => {
    expect(classifyBranch("main")).toBe("main");
    expect(classifyBranch("master")).toBe("main");
    expect(classifyBranch("trunk")).toBe("main");
    expect(classifyBranch("release-x", "release-x")).toBe("main"); // default branch wins
  });

  it("classifies feature branches", () => {
    expect(classifyBranch("feature/checkout")).toBe("feature");
    expect(classifyBranch("feat/search")).toBe("feature");
    expect(classifyBranch("story/POPS-12")).toBe("feature");
    expect(classifyBranch("task/cleanup")).toBe("feature");
  });

  it("classifies hotfix branches", () => {
    expect(classifyBranch("hotfix/login")).toBe("hotfix");
    expect(classifyBranch("fix/typo")).toBe("hotfix");
    expect(classifyBranch("bugfix/crash")).toBe("hotfix");
    expect(classifyBranch("emergency/rollback")).toBe("hotfix");
  });

  it("classifies release branches", () => {
    expect(classifyBranch("release/1.4.0")).toBe("release");
    expect(classifyBranch("rel/1.4")).toBe("release");
    expect(classifyBranch("rc/2")).toBe("release");
  });

  it("falls back to other", () => {
    expect(classifyBranch("experiment")).toBe("other");
    expect(classifyBranch("")).toBe("other");
  });

  it("is case-insensitive", () => {
    expect(classifyBranch("Feature/X")).toBe("feature");
    expect(classifyBranch("HOTFIX/Y")).toBe("hotfix");
  });
});

describe("refToBranchName", () => {
  it("strips refs/heads and refs/tags", () => {
    expect(refToBranchName("refs/heads/feature/x")).toBe("feature/x");
    expect(refToBranchName("refs/tags/v1.0")).toBe("v1.0");
    expect(refToBranchName(null)).toBeNull();
  });
});
