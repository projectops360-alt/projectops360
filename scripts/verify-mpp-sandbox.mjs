// ============================================================================
// Verify the .mpp converter actually runs in a Vercel Sandbox.
// ============================================================================
// The unit tests hold the SAFETY properties of the conversion (egress denied,
// sandbox released, file name never used as a path). They cannot prove the
// image BOOTS — that needs a real Vercel account, so it lives here as an
// operator check rather than in CI.
//
//   node scripts/verify-mpp-sandbox.mjs "<path to .mpp>"
// ============================================================================

import { readFileSync } from "node:fs";
import { Sandbox } from "@vercel/sandbox";

const IMAGE =
  process.env.MPP_CONVERTER_IMAGE ??
  "vcr.vercel.com/project-ops360-s-projects/projectops360/mpp-converter:latest";

// Load .env.local the way Next does, so the OIDC token from `vercel link` is
// present without depending on the app's runtime.
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/verify-mpp-sandbox.mjs <file.mpp>");
  process.exit(2);
}

const buffer = readFileSync(file);
console.log(`archivo   : ${file} (${buffer.byteLength} bytes)`);
console.log(`imagen    : ${IMAGE}`);

const startedAt = Date.now();
let sandbox;
try {
  sandbox = await Sandbox.create({
    image: IMAGE,
    timeout: 90_000,
    resources: { vcpus: 2 },
    networkPolicy: { allow: [] },
  });
  console.log(`sandbox   : creado en ${Date.now() - startedAt} ms`);

  await sandbox.writeFiles([{ path: "/vercel/sandbox/input.mpp", content: new Uint8Array(buffer) }]);

  const run = await sandbox.runCommand({
    cmd: "java",
    args: ["-cp", "/opt/mpxj/*:/opt/app", "Convert", "/vercel/sandbox/input.mpp", "/vercel/sandbox/output.json"],
    cwd: "/vercel/sandbox",
  });
  console.log(`exit code : ${run.exitCode}`);
  const err = (await run.stderr()).trim();
  if (err) console.log(`stderr    : ${err.slice(0, 400)}`);
  if (run.exitCode !== 0) process.exit(1);

  const out = await sandbox.readFileToBuffer({ path: "/vercel/sandbox/output.json" });
  const project = JSON.parse(out.toString("utf8"));
  console.log(
    `resultado : ${project.tasks?.length ?? 0} tareas, ` +
      `${project.resources?.length ?? 0} recursos, ` +
      `${project.assignments?.length ?? 0} asignaciones`,
  );
  console.log(`total     : ${Date.now() - startedAt} ms`);
  console.log("OK");
} catch (error) {
  console.error("FALLO:", error?.message ?? error);
  process.exit(1);
} finally {
  try {
    await sandbox?.stop();
    console.log("sandbox   : detenido");
  } catch {
    /* expira solo */
  }
}
