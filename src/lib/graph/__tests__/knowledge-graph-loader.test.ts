import { describe, expect, it } from "vitest";
import { loadKnowledgeGraphProjection } from "../knowledge-graph-loader";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";

function client(rows: Record<string, Record<string, unknown>[] | { error: { message: string } }>) {
  return {
    from(table: string) {
      const query = {
        select: () => query, eq: () => query, order: () => query,
        limit: async () => "error" in (rows[table] ?? {}) ? { data: null, error: (rows[table] as { error: { message: string } }).error } : { data: rows[table] ?? [], error: null },
      };
      return query;
    },
  };
}

describe("knowledge graph loader", () => {
  it("returns an honest empty state", async () => {
    const result = await loadKnowledgeGraphProjection(client({}) as never, organizationId, projectId);
    expect(result).toMatchObject({ status: "empty", validationIssues: [] });
  });

  it("returns error without falling back to operational graph data", async () => {
    const result = await loadKnowledgeGraphProjection(client({ project_knowledge_object_current: { error: { message: "denied" } } }) as never, organizationId, projectId);
    expect(result).toEqual({ status: "error", projection: null, validationIssues: [] });
  });
});
