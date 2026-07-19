import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SUPABASE_PROJECT_REFS = Object.freeze({
  production: "ocopmlnkvidvmxgiwvxw",
  staging: "gcxcljfzleasrleyyyda",
});

const REQUIRED_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
];

export function normalizeTarget(value) {
  if (value === "production") return "production";
  if (["development", "preview", "staging"].includes(value)) return "staging";
  throw new Error(`Unsupported deployment target: ${value || "unset"}`);
}

export function parseDotEnv(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice(7) : line;
    const separator = normalized.indexOf("=");
    if (separator < 1) continue;
    const name = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

export function loadEnvironment({ cwd = process.cwd(), envFile, baseEnv = process.env } = {}) {
  const fileValues = {};
  const candidates = envFile ? [envFile] : [path.join(cwd, ".env.local")];
  for (const candidate of candidates) {
    const resolved = path.resolve(cwd, candidate);
    if (fs.existsSync(resolved)) {
      Object.assign(fileValues, parseDotEnv(fs.readFileSync(resolved, "utf8")));
    }
  }
  return { ...fileValues, ...baseEnv };
}

function decodeJwtPayload(value) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function validateApiKey({ name, value, expectedRole, expectedRef, acceptedPrefix, errors }) {
  if (!value || value.startsWith(acceptedPrefix)) return;
  const payload = decodeJwtPayload(value);
  if (!payload) {
    errors.push(`${name} has an unsupported format`);
    return;
  }
  if (payload.role !== expectedRole) {
    errors.push(`${name} has role ${payload.role || "unknown"}; expected ${expectedRole}`);
  }
  if (payload.ref && payload.ref !== expectedRef) {
    errors.push(`${name} belongs to Supabase ref ${payload.ref}; expected ${expectedRef}`);
  }
}

export function validateSupabaseEnvironment({ target, environment }) {
  const normalizedTarget = normalizeTarget(target);
  const expectedRef = SUPABASE_PROJECT_REFS[normalizedTarget];
  const errors = [];

  for (const name of REQUIRED_VARIABLES) {
    if (!environment[name]) errors.push(`Missing required environment variable ${name}`);
  }

  if (environment.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supabaseUrl = new URL(environment.NEXT_PUBLIC_SUPABASE_URL);
      const expectedHost = `${expectedRef}.supabase.co`;
      if (supabaseUrl.protocol !== "https:" || supabaseUrl.hostname !== expectedHost) {
        const actualRef = supabaseUrl.hostname.split(".")[0] || "unknown";
        errors.push(
          `NEXT_PUBLIC_SUPABASE_URL points to ${actualRef}; ${normalizedTarget} requires ${expectedRef}`,
        );
      }
    } catch {
      errors.push("NEXT_PUBLIC_SUPABASE_URL is not a valid HTTPS URL");
    }
  }

  if (environment.DATABASE_URL) {
    try {
      const databaseUrl = new URL(environment.DATABASE_URL);
      const username = decodeURIComponent(databaseUrl.username);
      const isDirect = databaseUrl.hostname === `db.${expectedRef}.supabase.co`;
      const isPooler = databaseUrl.hostname.endsWith(".pooler.supabase.com");
      const poolerUserMatches = username === `postgres.${expectedRef}`;
      if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
        errors.push("DATABASE_URL must use PostgreSQL");
      }
      if (!isDirect && !(isPooler && poolerUserMatches)) {
        errors.push(`DATABASE_URL does not target the ${normalizedTarget} Supabase project ${expectedRef}`);
      }
    } catch {
      errors.push("DATABASE_URL is not a valid PostgreSQL URL");
    }
  }

  validateApiKey({
    name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    value: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    expectedRole: "anon",
    expectedRef,
    acceptedPrefix: "sb_publishable_",
    errors,
  });
  validateApiKey({
    name: "SUPABASE_SERVICE_ROLE_KEY",
    value: environment.SUPABASE_SERVICE_ROLE_KEY,
    expectedRole: "service_role",
    expectedRef,
    acceptedPrefix: "sb_secret_",
    errors,
  });
  return { target: normalizedTarget, expectedRef, errors };
}

export function assertSupabaseEnvironment(options) {
  const result = validateSupabaseEnvironment(options);
  if (result.errors.length > 0) {
    throw new Error(`Supabase environment guard failed:\n- ${result.errors.join("\n- ")}`);
  }
  return result;
}

function parseArguments(argv) {
  const options = { target: "auto", envFile: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--target") options.target = argv[index + 1];
    if (argv[index] === "--env-file") options.envFile = argv[index + 1];
  }
  return options;
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const runtimeTarget = process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV;
  if (options.target === "auto" && !runtimeTarget && process.env.CI) {
    console.log("Supabase environment guard skipped for service-free CI build.");
    return;
  }
  const target = options.target === "auto" ? normalizeTarget(runtimeTarget || "staging") : options.target;
  const environment = loadEnvironment({ envFile: options.envFile });
  const result = assertSupabaseEnvironment({ target, environment });
  console.log(`Supabase environment guard passed: ${result.target} -> ${result.expectedRef}`);
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Supabase environment guard failed");
    process.exitCode = 1;
  }
}
