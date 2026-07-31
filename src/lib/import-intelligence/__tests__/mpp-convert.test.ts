import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectFileType } from "../parse";

// ============================================================================
// Import Intelligence — .mpp conversion invariants (REG-044)
// ============================================================================
// Guard IMPORT-MPP-SANDBOX. The conversion itself needs a JVM and a Vercel
// account, so CI cannot run it. What CI CAN do is hold the properties that make
// it safe and affordable — and those are exactly the ones that rot silently:
// an ungated egress, a sandbox left running and billed, a user's file name used
// as a path, or an operator outage reported to the user as a corrupt file.
// ============================================================================

const root = join(process.cwd(), "src", "lib", "import-intelligence");
const service = readFileSync(join(root, "mpp-convert.server.ts"), "utf8");
const actions = readFileSync(
  join(process.cwd(), "src", "app", "[locale]", "(app)", "import", "actions.ts"),
  "utf8",
);

describe("the sandbox cannot reach the network", () => {
  it("passes an explicit network policy", () => {
    // Omitting the policy leaves egress OPEN. A converter never needs it.
    expect(service).toContain("networkPolicy:");
  });

  it("allows nothing", () => {
    // An empty allowlist is how this SDK spells deny-all; there is no
    // `mode: "deny-all"`, and asserting the literal keeps a well-meant
    // "let it fetch calendars" edit from passing review.
    expect(service).toMatch(/networkPolicy:\s*\{\s*allow:\s*\[\]\s*\}/);
  });
});

describe("the sandbox is always released", () => {
  it("stops in a finally block, not on the happy path", () => {
    // A sandbox left running bills for its whole timeout. The failure paths are
    // exactly where that is easiest to forget.
    expect(service).toMatch(/finally\s*\{[\s\S]*sandbox\?\.stop\(\)/);
  });

  it("never lets the cleanup error hide the real one", () => {
    const finallyBlock = service.slice(service.lastIndexOf("} finally {"));
    expect(finallyBlock).toContain("try {");
    expect(finallyBlock).toContain("catch");
  });

  it("bounds how long a conversion may cost", () => {
    expect(service).toMatch(/timeout:\s*CONVERSION_TIMEOUT_MS/);
  });
});

describe("the uploaded file name is never trusted", () => {
  it("uses absolute paths, which the API requires", () => {
    // A relative path is rejected with a bare 400 that says nothing about why.
    expect(service).toContain('const WORKDIR = "/vercel/sandbox"');
  });

  it("writes to a fixed internal path", () => {
    // The name comes from the user; it has no business becoming a path inside
    // the sandbox.
    expect(service).toContain("`${WORKDIR}/input.mpp`");
    expect(service).not.toMatch(/path:\s*fileName/);
  });

  it("passes fixed arguments to the converter", () => {
    expect(service).toMatch(/args:\s*\[[\s\S]*?WORKDIR\}\/input\.mpp`,\s*`\$\{WORKDIR\}\/output\.json`\]/);
  });

  it("runs the binary directly rather than through a shell", () => {
    // No shell, so nothing in the file name can be interpreted.
    expect(service).toMatch(/cmd:\s*"java"/);
    expect(service).not.toMatch(/cmd:\s*"(sh|bash|sh -c)"/);
  });
});

describe("failures say whose fault they are", () => {
  it("separates an unreadable file from an unavailable converter", () => {
    // Telling a user their plan is corrupt when the image failed to start is
    // the kind of error message that costs support hours.
    expect(service).toContain("mpp_unreadable");
    expect(service).toContain("mpp_converter_unavailable");
  });

  it("maps the converter's own exit code for a rejected file", () => {
    expect(service).toContain("const EXIT_UNREADABLE = 3");
    expect(service).toMatch(/exitCode === EXIT_UNREADABLE[\s\S]{0,120}mpp_unreadable/);
  });

  it("treats a sandbox that will not start as an operator problem", () => {
    const createBlock = service.slice(service.indexOf("Sandbox.create"), service.indexOf("try {", service.indexOf("Sandbox.create")));
    expect(createBlock).toContain("mpp_converter_unavailable");
  });

  it("surfaces the conversion code to the import job", () => {
    expect(actions).toContain("MppConversionError");
    expect(actions).toMatch(/e instanceof MppConversionError\s*\?\s*e\.code/);
  });
});

describe("the upload is actually accepted", () => {
  // The defect this catches: the type, the switch case and the file input all
  // knew about .mpp, but EXTENSION_MAP did not — so `detectFileType` returned
  // null and the upload was rejected with "unsupported file type" before the
  // converter was ever reached. Every other assertion in this file passed.
  it("recognises the extension", () => {
    expect(detectFileType("CPVEN - Plan Tecnico SAP_v1.mpp")).toBe("mpp");
    expect(detectFileType("PLAN.MPP")).toBe("mpp");
  });

  it("offers .mpp in the file picker", () => {
    const client = readFileSync(
      join(process.cwd(), "src", "app", "[locale]", "(app)", "import", "import-client.tsx"),
      "utf8",
    );
    expect(client).toContain(".mpp");
  });

  it("routes a recognised .mpp to the converter, not the parser", () => {
    expect(actions).toMatch(/detectFileType\([^)]*\) === "mpp"/);
  });
});

describe("the .mpp path rejoins the normal pipeline", () => {
  it("converts, then maps through the shared model", () => {
    expect(actions).toContain("convertMppToMpxjJson");
    expect(actions).toContain("mpxjToParsedFile");
  });

  it("uses the same extraction as every other file type", () => {
    // One `extractCanonicalImport` call, reached by both branches — a second
    // one would be the start of a .mpp-only pipeline.
    expect(actions.match(/extractCanonicalImport\(/g) ?? []).toHaveLength(1);
  });

  it("keeps .mpp out of the in-process parser, loudly", () => {
    const parse = readFileSync(join(root, "parse.ts"), "utf8");
    expect(parse).toContain('case "mpp":');
    expect(parse).toContain("mpp_requires_conversion");
  });
});
