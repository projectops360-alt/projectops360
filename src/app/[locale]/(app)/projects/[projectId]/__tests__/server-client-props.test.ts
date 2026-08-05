// ============================================================================
// REG-049 — A Server Component may not hand a function to a Client Component
// ============================================================================
// Guard: RSC-SERIALIZABLE-PROPS
//
// The project page rendered <ProjectHeaderClient> with label *functions*:
//
//     tasks: (count: number) => t("detail.deleteStep1Tasks", { count })
//
// React cannot serialize a function across the server/client boundary, so
// every project page threw at runtime:
//
//     Error: Functions cannot be passed directly to Client Components...
//     {trigger: ..., tasks: function tasks, milestones: ..., events: ...}
//
// Nothing caught it before production: a function IS assignable to a
// `(count: number) => string` prop, so typecheck passed; the build passed;
// 3672 tests passed. The failure only exists at the RSC boundary.
//
// This asserts the boundary contract statically: a client component rendered
// BY A SERVER COMPONENT must declare only serializable props. Callback props
// (onX) are exempt — those are only ever wired up by another client component.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Client components that a Server Component renders directly. */
const SERVER_RENDERED_CLIENT_COMPONENTS = [
  "src/app/[locale]/(app)/projects/[projectId]/project-header-client.tsx",
];

/** Grab the body of every `interface ...Props { ... }` in a source file. */
function propInterfaces(source: string): string[] {
  const bodies: string[] = [];
  const re = /interface\s+\w*Props\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") depth--;
      i++;
    }
    bodies.push(source.slice(re.lastIndex, i - 1));
  }
  return bodies;
}

/** Prop lines declaring a function type, ignoring `onX` callbacks. */
function functionProps(interfaceBody: string): string[] {
  return interfaceBody
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("*") && !line.startsWith("//") && !line.startsWith("/*"))
    // `name: (args) => T` or `name: Function`
    .filter((line) => /:\s*\(.*\)\s*=>/.test(line) || /:\s*Function\b/.test(line))
    .filter((line) => !/^on[A-Z]/.test(line));
}

describe("RSC boundary — serializable props", () => {
  for (const relativePath of SERVER_RENDERED_CLIENT_COMPONENTS) {
    it(`${relativePath} declares no function props`, () => {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      expect(source).toContain('"use client"');

      const offenders = propInterfaces(source).flatMap(functionProps);
      expect(
        offenders,
        `These props are functions and cannot cross the server/client boundary. ` +
          `Pass a serializable value (e.g. a "{count}" template resolved with t.raw) instead:\n` +
          offenders.map((o) => `  ${o}`).join("\n"),
      ).toEqual([]);
    });
  }

  it("detects the exact shape that broke production", () => {
    // Sanity-check the detector against the real regression, so a future
    // refactor cannot quietly turn it into a no-op.
    const broken = `interface ProjectHeaderClientProps {
      projectId: string;
      deleteLabels: {
        tasks: (count: number) => string;
      };
      onClose: () => void;
    }`;
    expect(functionProps(propInterfaces(broken)[0])).toEqual(["tasks: (count: number) => string;"]);
  });

  it("does not flag plain serializable props", () => {
    const fine = `interface XProps {
      title: string;
      count: number;
      labels: { tasks: string };
      onSaved: () => void;
    }`;
    expect(functionProps(propInterfaces(fine)[0])).toEqual([]);
  });
});
