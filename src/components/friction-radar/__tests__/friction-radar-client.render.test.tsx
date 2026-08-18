import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import esMessages from "../../../../messages/es.json";
import { FrictionRadarClient } from "../friction-radar-client";
import type { FrictionSignal } from "@/lib/friction-radar/types";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const signal: FrictionSignal = {
  signalId: "task:task-1:reopened",
  organizationId: "org-1",
  projectId: "project-1",
  source: "process_mining",
  signalType: "completed_then_reopened",
  category: "quality",
  entityType: "task",
  entityId: "task-1",
  taskId: "task-1",
  milestoneId: "milestone-1",
  severity: "critical",
  confidence: "high",
  score: 100,
  observedValue: 1,
  expectedOrBaseline: 0,
  evidenceStatus: "confirmed",
  occurredAt: "2026-08-01T00:00:00.000Z",
  evidenceTimestampStart: "2026-07-31T00:00:00.000Z",
  evidenceTimestampEnd: "2026-08-01T00:00:00.000Z",
  evidenceDescription: "Completed then reopened.",
  evidenceRefs: [{ kind: "project_event_log", id: "event-1" }],
};

const props = {
  projectId: "project-1",
  projectTitle: "Aurora",
  generatedAt: "2026-08-18T00:00:00.000Z",
  milestoneCount: 1,
  eventCount: 2,
  taskCount: 1,
  dependencyCount: 0,
  timeEntryCount: 0,
  rejectedEvidenceCount: 0,
  signals: [signal],
  gaps: [{ signalType: "resource_overload", category: "resource" as const, status: "insufficient_evidence" as const, reason: "capacity_missing", sourceTables: ["resource_workload_snapshots"] }],
  topSignalIds: [signal.signalId],
  taskTitles: { "task-1": "Reopened task" },
  milestoneTitles: { "milestone-1": "Testing" },
  evidenceEvents: [{ eventId: "event-1", eventType: "TaskReopened", occurredAt: "2026-08-01T00:00:00.000Z", recordedAt: "2026-08-01T00:00:00.000Z", sequenceNumber: 2, fromState: "done", toState: "blocked" }],
  sourceAudit: [{ table: "roadmap_tasks", status: "available" as const, rowCount: 1 }],
  limitations: [],
};

function render(locale: "en" | "es") {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "es" ? esMessages : enMessages}>
      <FrictionRadarClient {...props} locale={locale} />
    </NextIntlClientProvider>,
  );
}

describe("Friction Radar dashboard", () => {
  it("renders independent scoring, evidence state and UNKNOWN gaps without a global score", () => {
    const html = render("en");
    expect(html).toContain("Friction Radar");
    expect(html).toContain("Completed then reopened");
    expect(html).toContain("Insufficient evidence");
    expect(html).toContain("Not calculated");
    expect(html).toContain("No aggregate");
    expect(html).toContain("data-testid=\"friction-signal-row\"");
  });

  it("renders the Spanish interface without falling back to English UI labels", () => {
    const html = render("es");
    expect(html).toContain("Radar de Fricción");
    expect(html).toContain("Completada y luego reabierta");
    expect(html).toContain("Evidencia insuficiente");
    expect(html).not.toContain("View evidence");
  });
});
