import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Friction Radar protected surface boundaries", () => {
  const page = source("src/app/[locale]/(app)/projects/[projectId]/friction-radar/page.tsx");
  const route = source("src/app/api/projects/[projectId]/friction-radar/route.ts");
  const loader = source("src/lib/friction-radar/load-task-production.ts");
  const projectLayout = source("src/app/[locale]/(app)/projects/[projectId]/layout.tsx");

  it("checks the project feature gate before loading any data", () => {
    expect(page.indexOf("isFrictionRadarEnabledForProject(projectId)")).toBeLessThan(page.indexOf("loadFrictionRadarFromProduction(projectId"));
    expect(route.indexOf("isFrictionRadarEnabledForProject(projectId)")).toBeLessThan(route.indexOf("loadFrictionRadarFromProduction(projectId"));
  });

  it("has a GET-only, private no-store API with no mutation calls", () => {
    expect(route).toContain("export async function GET");
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(route).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });

  it("keeps the production loader authenticated, RLS-scoped and SELECT-only", () => {
    expect(loader).toContain('import { createClient } from "@/lib/supabase/server"');
    expect(loader).toContain("getOrgContext");
    expect(loader).not.toMatch(/createAdminClient|service[_-]?role/i);
    expect(loader).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });

  it("conceals unauthorized projects instead of revealing their existence", () => {
    expect(page).toContain('result.status === "unauthorized"');
    expect(page).toContain("notFound()");
    expect(route).toContain('{ error: "not_found" }');
    expect(projectLayout).toContain("hasProjectAccess && isFrictionRadarEnabledForProject(projectId)");
  });
});
