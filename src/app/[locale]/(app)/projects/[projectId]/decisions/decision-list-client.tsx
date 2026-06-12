"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Scale } from "lucide-react";
import type { Decision, DecisionStatus, ImpactArea, Locale } from "@/types/database";
import { CreateDecisionDialog } from "@/components/decisions/create-decision-dialog";
import { EditDecisionDialog } from "@/components/decisions/edit-decision-dialog";
import { DecisionCard } from "@/components/decisions/decision-card";
import { DecisionFilters, type DecisionFilterState } from "@/components/decisions/decision-filters";
import { archiveDecisionAction } from "./actions";

interface StakeholderOption {
  id: string;
  name: string;
}

interface Translations {
  title: string;
  description: string;
  create: string;
  empty: string;
  emptyDescription: string;
  edit: string;
  archive: string;
  archiveConfirm: string;
  statusLabels: Record<DecisionStatus, string>;
  impactAreaLabels: Record<ImpactArea, string>;
  filters: {
    status: string;
    impactArea: string;
    dateFrom: string;
    dateTo: string;
    all: string;
    clear: string;
  };
}

interface DecisionListClientProps {
  projectId: string;
  projectTitle: string;
  decisions: Decision[];
  stakeholders: StakeholderOption[];
  locale: Locale;
  translations: Translations;
}

export function DecisionListClient({
  projectId,
  projectTitle,
  decisions: initialDecisions,
  stakeholders,
  locale,
  translations: t,
}: DecisionListClientProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null);
  const [decisions, setDecisions] = useState(initialDecisions);
  const [filters, setFilters] = useState<DecisionFilterState>({
    status: "all",
    impactArea: "all",
    dateFrom: "",
    dateTo: "",
  });

  const handleCreated = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleArchive = useCallback(
    async (decision: Decision) => {
      if (!confirm(t.archiveConfirm)) return;

      const result = await archiveDecisionAction(decision.id);
      if (!result.error) {
        setDecisions((prev) => prev.filter((d) => d.id !== decision.id));
        router.refresh();
      }
    },
    [t.archiveConfirm, router],
  );

  // Client-side filtering
  const filteredDecisions = useMemo(() => {
    return decisions.filter((d) => {
      if (filters.status !== "all" && d.status !== filters.status) return false;
      if (filters.impactArea !== "all" && d.impact_area !== filters.impactArea) return false;
      if (filters.dateFrom && d.decision_date && d.decision_date < filters.dateFrom) return false;
      if (filters.dateTo && d.decision_date && d.decision_date > filters.dateTo + "T23:59:59") return false;
      return true;
    });
  }, [decisions, filters]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projectTitle} · {t.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <Plus className="h-4 w-4" />
          {t.create}
        </button>
      </div>

      {/* Filters */}
      {decisions.length > 0 && (
        <DecisionFilters
          filters={filters}
          onFilterChange={setFilters}
          labels={{
            status: {
              proposed: t.statusLabels.proposed,
              accepted: t.statusLabels.accepted,
              rejected: t.statusLabels.rejected,
              deferred: t.statusLabels.deferred,
              revoked: t.statusLabels.revoked,
              all: t.filters.all,
            },
            statusLabel: t.filters.status,
            impactArea: {
              scope: t.impactAreaLabels.scope,
              schedule: t.impactAreaLabels.schedule,
              budget: t.impactAreaLabels.budget,
              risk: t.impactAreaLabels.risk,
              quality: t.impactAreaLabels.quality,
              communication: t.impactAreaLabels.communication,
              document: t.impactAreaLabels.document,
              other: t.impactAreaLabels.other,
              all: t.filters.all,
            },
            impactAreaLabel: t.filters.impactArea,
            dateFrom: t.filters.dateFrom,
            dateTo: t.filters.dateTo,
            clear: t.filters.clear,
          }}
        />
      )}

      {/* Decision grid */}
      {filteredDecisions.length === 0 && decisions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-16">
          <Scale className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">{t.empty}</p>
          <p className="mt-1 text-xs text-muted-foreground/60">{t.emptyDescription}</p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            {t.create}
          </button>
        </div>
      ) : filteredDecisions.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {locale === "es" ? "No hay decisiones que coincidan con los filtros actuales." : "No decisions match the current filters."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDecisions.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              locale={locale}
              projectId={projectId}
              labels={{
                status: t.statusLabels,
                impactArea: t.impactAreaLabels,
                noImpactArea: locale === "es" ? "Sin área de impacto" : "No impact area",
                noDate: locale === "es" ? "Sin fecha" : "No date",
              }}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateDecisionDialog
          locale={locale}
          projectId={projectId}
          stakeholders={stakeholders}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Edit dialog */}
      {editingDecision && (
        <EditDecisionDialog
          decision={editingDecision}
          locale={locale}
          projectId={projectId}
          stakeholders={stakeholders}
          linkedStakeholderIds={[]}
          onClose={() => setEditingDecision(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}