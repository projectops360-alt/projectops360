import { describe, expect, it } from "vitest";

import {
  SUPABASE_PROJECT_REFS,
  assertSupabaseEnvironment,
  normalizeTarget,
  parseDotEnv,
  validateSupabaseEnvironment,
} from "./validate-supabase-environment.mjs";

function jwt(role, ref) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, ref })}.signature`;
}

function environmentFor(ref) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("anon", ref),
    SUPABASE_SERVICE_ROLE_KEY: jwt("service_role", ref),
    DATABASE_URL: `postgresql://postgres.${ref}:secret@aws-1-us-west-2.pooler.supabase.com:6543/postgres`,
  };
}

describe("Supabase deployment environment guard", () => {
  it("maps all non-production deployment targets to staging", () => {
    expect(normalizeTarget("development")).toBe("staging");
    expect(normalizeTarget("preview")).toBe("staging");
    expect(normalizeTarget("staging")).toBe("staging");
    expect(normalizeTarget("production")).toBe("production");
  });

  it("accepts staging credentials for development", () => {
    expect(() =>
      assertSupabaseEnvironment({
        target: "development",
        environment: environmentFor(SUPABASE_PROJECT_REFS.staging),
      }),
    ).not.toThrow();
  });

  it("accepts production credentials only for production", () => {
    expect(() =>
      assertSupabaseEnvironment({
        target: "production",
        environment: environmentFor(SUPABASE_PROJECT_REFS.production),
      }),
    ).not.toThrow();
  });

  it("blocks development from using production without printing credentials", () => {
    const result = validateSupabaseEnvironment({
      target: "development",
      environment: environmentFor(SUPABASE_PROJECT_REFS.production),
    });
    expect(result.errors.join(" ")).toContain(SUPABASE_PROJECT_REFS.staging);
    expect(result.errors.join(" ")).not.toContain("secret");
  });

  it("blocks production from using staging", () => {
    expect(() =>
      assertSupabaseEnvironment({
        target: "production",
        environment: environmentFor(SUPABASE_PROJECT_REFS.staging),
      }),
    ).toThrow("Supabase environment guard failed");
  });

  it("accepts current publishable and secret key formats", () => {
    const environment = environmentFor(SUPABASE_PROJECT_REFS.staging);
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_example";
    environment.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_example";
    expect(() => assertSupabaseEnvironment({ target: "preview", environment })).not.toThrow();
  });

  it("parses quoted dotenv values", () => {
    expect(parseDotEnv('A="one"\n# hidden\nexport B=two\n')).toEqual({ A: "one", B: "two" });
  });
});
