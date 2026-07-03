// ============================================================================
// TASK-EXECUTION-MAP — UI render guards
// ============================================================================
// Protects the component layer: the parent node renders title/progress/
// counters/hours/variance, subtask nodes render status+owner+due+indicators
// (text/icon — never color alone), blocker nodes render reason/age/impact,
// the detail panel renders for parent and subtask selections with the
// operational actions and Ask Isabella, and the table fallback renders rows.
// Rendered with react-dom/server (node env); React Flow handles are mocked.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import esMessages from "../../../../messages/es.json";
import type { Subtask } from "@/lib/subtasks/types";
import type { ParentTaskInfo } from "@/lib/subtasks/map-model";

// React Flow node internals (Handle/useReactFlow) need a live flow store; the
// node CONTENT is what we guard here, so mock the flow chrome only.
vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { ParentTaskNode, SubtaskMapNode, BlockerMapNode, DependencyMapNode } from "../map-nodes";
import { SubtaskDetailPanel } from "../subtask-detail-panel";
import { SubtaskTableView } from "../subtask-table-view";

const ASOF = new Date("2026-07-03T12:00:00.000Z");

function render(node: React.ReactElement, locale: "en" | "es" = "en"): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "es" ? esMessages : enMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

let seq = 0;
function subtask(overrides: Partial<Subtask> = {}): Subtask {
  seq += 1;
  return {
    id: overrides.id ?? `sub-${seq}`,
    task_id: "task-1",
    project_id: "proj-1",
    organization_id: "org-1",
    title: overrides.title ?? `Subtask ${seq}`,
    description: null,
    status: "in_progress",
    priority: "p2",
    owner_id: null,
    start_date: null,
    due_date: null,
    completed_at: null,
    estimated_hours: null,
    actual_hours: null,
    weight: null,
    progress: 50,
    is_critical: false,
    blocked_reason: null,
    blocked_at: null,
    sort_order: seq,
    created_by: null,
    updated_by: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

const PARENT: ParentTaskInfo = {
  id: "task-1",
  title: "Build QA pipeline",
  status: "in_progress",
  progress: 40,
  ownerId: "u1",
  ownerName: "Ana PM",
  isCritical: true,
  estimateHours: 16,
  actualHours: 12,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const nodeProps = (data: Record<string, unknown>) => ({ data }) as any;

describe("Execution Map — parent node", () => {
  it("renders title, calculated %, counters, hours, variance and critical badge", () => {
    const html = render(
      <ParentTaskNode
        {...nodeProps({
          title: "Build QA pipeline",
          status: "in_progress",
          progress: 65,
          progressSource: "subtasks",
          ownerName: "Ana PM",
          isCritical: true,
          completedCount: 5,
          activeCount: 8,
          blockedCount: 1,
          overdueCount: 2,
          estimatedHours: 16,
          actualHours: 12,
          varianceHours: -4,
          criticalAtRisk: false,
        })}
      />,
    );
    expect(html).toContain("Build QA pipeline");
    expect(html).toContain("65%");
    expect(html).toContain("Progress calculated from subtasks");
    expect(html).toContain("5/8");
    expect(html).toContain("Ana PM");
    expect(html).toContain("Critical path");
    expect(html).toContain("-4h");
    expect(html).toContain('data-testid="tem-parent-node"');
  });

  it("shows the CRITICAL RISK treatment when a critical subtask is blocked/overdue", () => {
    const html = render(
      <ParentTaskNode
        {...nodeProps({
          title: "T",
          status: "in_progress",
          progress: 10,
          progressSource: "subtasks",
          ownerName: null,
          isCritical: false,
          completedCount: 0,
          activeCount: 1,
          blockedCount: 1,
          overdueCount: 0,
          estimatedHours: null,
          actualHours: null,
          varianceHours: null,
          criticalAtRisk: true,
        })}
      />,
    );
    expect(html).toContain("Critical risk");
    expect(html).toContain("border-red-500");
  });
});

describe("Execution Map — subtask node", () => {
  it("renders title, %, status badge with TEXT, owner, due date and indicators", () => {
    const html = render(
      <SubtaskMapNode
        {...nodeProps({
          title: "QA certification",
          status: "blocked",
          progress: 30,
          ownerName: "Carlos QA",
          dueDate: "2026-07-01",
          weight: 3,
          estimatedHours: null,
          isCritical: true,
          isOverdue: true,
          isBlocked: true,
          muted: false,
        })}
      />,
    );
    expect(html).toContain("QA certification");
    expect(html).toContain("30%");
    expect(html).toContain("Blocked"); // status has TEXT, never color alone
    expect(html).toContain("Carlos QA");
    expect(html).toContain("2026-07-01");
    expect(html).toContain("w:3");
    expect(html).toContain('aria-label="Critical path"');
    expect(html).toContain('aria-label="Overdue"');
  });

  it("completed/cancelled nodes render visually muted", () => {
    const html = render(
      <SubtaskMapNode
        {...nodeProps({
          title: "Done one",
          status: "completed",
          progress: 100,
          ownerName: null,
          dueDate: null,
          weight: null,
          estimatedHours: null,
          isCritical: false,
          isOverdue: false,
          isBlocked: false,
          muted: true,
        })}
      />,
    );
    expect(html).toContain("opacity-50");
    expect(html).toContain("Completed");
  });

  it("shows a delete button ONLY when a delete handler is supplied (RBAC-gated)", () => {
    const base = {
      subtaskId: "s1",
      title: "Removable",
      status: "in_progress",
      progress: 10,
      ownerName: null,
      dueDate: null,
      weight: null,
      estimatedHours: null,
      isCritical: false,
      isOverdue: false,
      isBlocked: false,
      muted: false,
    };
    const withDelete = render(<SubtaskMapNode {...nodeProps({ ...base, onDeleteSubtask: () => {} })} />);
    expect(withDelete).toContain('data-testid="tem-node-delete"');
    const withoutDelete = render(<SubtaskMapNode {...nodeProps(base)} />);
    expect(withoutDelete).not.toContain('data-testid="tem-node-delete"');
  });
});

describe("Execution Map — blocker + dependency nodes", () => {
  it("blocker node renders reason, age, impact and critical-path flag as an alert", () => {
    const html = render(
      <BlockerMapNode
        {...nodeProps({
          reason: "Waiting for security sign-off",
          ageDays: 3,
          ownerName: "Carlos QA",
          impact: "critical",
          affectsCriticalPath: true,
        })}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Waiting for security sign-off");
    expect(html).toContain("3 day(s) old");
    expect(html).toContain("Critical impact");
    expect(html).toContain("Affects critical path");
  });

  it("dependency node renders dotted styling and title", () => {
    const html = render(
      <DependencyMapNode {...nodeProps({ title: "API contract", status: "in_progress" })} />,
    );
    expect(html).toContain("border-dashed");
    expect(html).toContain("API contract");
    expect(html).toContain("Dependency");
  });
});

describe("Execution Map — detail panel", () => {
  const subtasks = [
    subtask({ id: "s1", title: "QA cert", status: "blocked", blocked_reason: "env down", weight: 2 }),
    subtask({ id: "s2", title: "Deploy", status: "completed" }),
  ];

  it("subtask selection renders full details + operational actions + Ask Isabella", () => {
    const html = render(
      <SubtaskDetailPanel
        projectId="proj-1"
        parent={PARENT}
        subtasks={subtasks}
        ownerNames={{}}
        selection={{ kind: "subtask", subtaskId: "s1" }}
        canManage
        onClose={() => {}}
        onEdit={() => {}}
        asOf={ASOF}
      />,
    );
    expect(html).toContain('data-testid="tem-detail-panel"');
    expect(html).toContain("QA cert");
    expect(html).toContain("env down");
    expect(html).toContain('data-testid="tem-action-unblock"'); // blocked → unblock offered
    expect(html).toContain('data-testid="tem-action-edit"');
    expect(html).toContain('data-testid="tem-action-delete"'); // canManage
    expect(html).toContain('data-testid="tem-ask-isabella"');
  });

  it("parent selection renders calculation method, breakdown, blockers and close gate", () => {
    const html = render(
      <SubtaskDetailPanel
        projectId="proj-1"
        parent={PARENT}
        subtasks={subtasks}
        ownerNames={{}}
        selection={{ kind: "parent" }}
        canManage
        onClose={() => {}}
        onEdit={() => {}}
        asOf={ASOF}
      />,
    );
    expect(html).toContain('data-testid="tem-parent-panel"');
    expect(html).toContain("Calculation method");
    expect(html).toContain("Progress breakdown");
    expect(html).toContain("Blockers");
    expect(html).toContain("env down");
    // Close gate: s1 is active + incomplete → cannot close without override.
    expect(html).toContain("cannot be closed");
    expect(html).toContain('data-testid="tem-ask-isabella-parent"');
  });

  it("renders in Spanish without Spanglish (UX-012)", () => {
    const html = render(
      <SubtaskDetailPanel
        projectId="proj-1"
        parent={PARENT}
        subtasks={subtasks}
        ownerNames={{}}
        selection={{ kind: "parent" }}
        canManage
        onClose={() => {}}
        onEdit={() => {}}
        asOf={ASOF}
      />,
      "es",
    );
    expect(html).toContain("Método de cálculo");
    expect(html).toContain("Desglose del progreso");
    expect(html).toContain("Preguntar a Isabella sobre esta tarea");
  });
});

describe("Execution Map — table fallback", () => {
  it("renders a sortable row per subtask with status text and flags", () => {
    const html = render(
      <SubtaskTableView
        subtasks={[
          subtask({ id: "s1", title: "QA cert", status: "blocked", blocked_reason: "x", due_date: "2026-07-01" }),
          subtask({ id: "s2", title: "Deploy", status: "completed" }),
        ]}
        ownerNames={{}}
        onSelect={() => {}}
        asOf={ASOF}
      />,
    );
    expect(html).toContain('data-testid="tem-table-view"');
    expect((html.match(/data-testid="tem-table-row"/g) ?? []).length).toBe(2);
    expect(html).toContain("QA cert");
    expect(html).toContain("Blocked");
    expect(html).toContain('aria-label="Overdue"');
  });
});
