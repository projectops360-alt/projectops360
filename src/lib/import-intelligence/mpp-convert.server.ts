import "server-only";

// ============================================================================
// ProjectOps360° — .mpp → MPXJ JSON, in a Vercel Sandbox (server-only)
// ============================================================================
// Microsoft Project files are an undocumented OLE2 binary. The only mature
// reader is MPXJ, which is Java, and Vercel Functions run Node — there is no
// JVM in the application process.
//
// The alternatives were weighed and recorded, because the cheap-looking one is
// the expensive one:
//   · A Java microservice — MPXJ is free (LGPL), but it is a host to run, pay
//     for and keep up, and customer files would travel to it.
//   · Browser conversion via CheerpJ — needs a COMMERCIAL licence
//     (£100/developer/month) and MPXJ ships no supported JavaScript build.
//   · This: a Sandbox created per conversion and destroyed after it. No standing
//     host, no licence, and the file never leaves Vercel.
//
// The sandbox is created with egress DENIED. A file converter has no business
// reaching the network, and denying it means a malicious .mpp cannot turn a
// parser bug into an outbound request.
// ============================================================================

import { Sandbox } from "@vercel/sandbox";
import type { MpxjProject } from "./mpp-model";

/** Published by docker/mpp-converter. Overridable for staging experiments. */
const CONVERTER_IMAGE =
  process.env.MPP_CONVERTER_IMAGE ??
  "vcr.vercel.com/project-ops360-s-projects/projectops360/mpp-converter:latest";

/**
 * A conversion is one JVM start plus a parse. Ten seconds is already generous;
 * beyond it something is wrong and the user deserves an error rather than a
 * spinner and a bill.
 */
const CONVERSION_TIMEOUT_MS = 90_000;

/** The sandbox's writable working directory. Paths must be absolute. */
const WORKDIR = "/vercel/sandbox";

/** Matches the parser's own ceiling, so the limit is one number to the user. */
const MAX_MPP_BYTES = 25 * 1024 * 1024;

export type MppConversionErrorCode =
  | "mpp_too_large"
  | "mpp_unreadable"
  | "mpp_converter_unavailable"
  | "mpp_conversion_failed";

export class MppConversionError extends Error {
  constructor(public code: MppConversionErrorCode, message?: string) {
    super(message ?? code);
  }
}

/** Exit codes from Convert.java, kept in sync deliberately. */
const EXIT_UNREADABLE = 3;

export interface MppConversionResult {
  project: MpxjProject;
  /** Wall-clock cost of the sandbox, for observability. */
  durationMs: number;
}

/**
 * Decode one .mpp into MPXJ's JSON.
 *
 * Everything after this returns is plain TypeScript (`mpxjToParsedFile`), which
 * is why this function does as little as possible: start, run, read, stop.
 */
export async function convertMppToMpxjJson(
  fileName: string,
  buffer: Uint8Array,
): Promise<MppConversionResult> {
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_MPP_BYTES) {
    throw new MppConversionError("mpp_too_large");
  }

  const startedAt = Date.now();
  let sandbox: Sandbox | undefined;

  try {
    sandbox = await Sandbox.create({
      image: CONVERTER_IMAGE,
      timeout: CONVERSION_TIMEOUT_MS,
      resources: { vcpus: 2 },
      // A converter needs no network. An EMPTY allowlist is how this SDK spells
      // "deny everything" — there is no `deny-all` mode, and omitting the policy
      // would leave egress open. A crafted .mpp therefore cannot turn a parser
      // bug into an outbound connection.
      networkPolicy: { allow: [] },
    });
  } catch (error) {
    // The image missing or the account lacking Sandbox access is an operator
    // problem, not a bad file — the user must not be told their plan is corrupt.
    throw new MppConversionError("mpp_converter_unavailable", asMessage(error));
  }

  try {
    // Absolute paths, and a fixed internal name. Relative paths are rejected by
    // the API with a bare 400, and the uploaded file name is user input that has
    // no business becoming a path inside the sandbox.
    await sandbox.writeFiles([{ path: `${WORKDIR}/input.mpp`, content: new Uint8Array(buffer) }]);

    const run = await sandbox.runCommand({
      cmd: "java",
      args: ["-cp", "/opt/mpxj/*:/opt/app", "Convert", `${WORKDIR}/input.mpp`, `${WORKDIR}/output.json`],
      cwd: WORKDIR,
    });

    if (run.exitCode !== 0) {
      const stderr = (await run.stderr()).trim();
      // Exit 3 is MPXJ refusing the file: that IS about the file, and the user
      // can act on it (wrong format, corrupt, password-protected).
      if (run.exitCode === EXIT_UNREADABLE) {
        throw new MppConversionError("mpp_unreadable", stderr);
      }
      throw new MppConversionError("mpp_conversion_failed", `exit ${run.exitCode}: ${stderr}`);
    }

    const output = await sandbox.readFileToBuffer({ path: `${WORKDIR}/output.json` });
    if (!output) throw new MppConversionError("mpp_conversion_failed", "no output produced");
    const text = output.toString("utf8");

    let project: MpxjProject;
    try {
      project = JSON.parse(text) as MpxjProject;
    } catch {
      throw new MppConversionError("mpp_conversion_failed", "converter returned invalid JSON");
    }

    return { project, durationMs: Date.now() - startedAt };
  } catch (error) {
    if (error instanceof MppConversionError) throw error;
    throw new MppConversionError("mpp_conversion_failed", asMessage(error));
  } finally {
    // Always stop. A sandbox left running is billed for its whole timeout, and
    // the failure paths above are exactly when that is easiest to forget.
    try {
      await sandbox?.stop();
    } catch {
      /* the sandbox expires on its own; never mask the real error with this */
    }
  }
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
