"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import type { Stakeholder, Locale, InfluenceLevel, InterestLevel } from "@/types/database";
import { CreateStakeholderDialog } from "@/components/stakeholders/create-stakeholder-dialog";
import { EditStakeholderDialog } from "@/components/stakeholders/edit-stakeholder-dialog";
import { StakeholderCard } from "@/components/stakeholders/stakeholder-card";
import { InfluenceBadge } from "@/components/stakeholders/influence-badge";
import { archiveStakeholderAction } from "./actions";

interface Translations {
  title: string;
  description: string;
  create: string;
  empty: string;
  emptyDescription: string;
  edit: string;
  archive: string;
  archiveConfirm: string;
  influenceHigh: string;
  influenceMedium: string;
  influenceLow: string;
  interestHigh: string;
  interestMedium: string;
  interestLow: string;
}

interface StakeholderListClientProps {
  projectId: string;
  projectTitle: string;
  stakeholders: Stakeholder[];
  locale: Locale;
  translations: Translations;
}

export function StakeholderListClient({
  projectId,
  projectTitle,
  stakeholders: initialStakeholders,
  locale,
  translations: t,
}: StakeholderListClientProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);
  const [stakeholders, setStakeholders] = useState(initialStakeholders);

  const handleCreated = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleArchive = useCallback(
    async (stakeholder: Stakeholder) => {
      if (!confirm(t.archiveConfirm)) return;

      const result = await archiveStakeholderAction(stakeholder.id);
      if (!result.error) {
        setStakeholders((prev) => prev.filter((s) => s.id !== stakeholder.id));
        router.refresh();
      }
    },
    [t.archiveConfirm, router],
  );

  // Build label maps for influence/interest badges
  const influenceLabels: Record<string, string> = {
    high: t.influenceHigh,
    medium: t.influenceMedium,
    low: t.influenceLow,
  };
  const interestLabels: Record<string, string> = {
    high: t.interestHigh,
    medium: t.interestMedium,
    low: t.interestLow,
  };

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

      {/* Stakeholder grid */}
      {stakeholders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-16">
          <Users className="h-12 w-12 text-muted-foreground/40" />
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stakeholders.map((stakeholder) => (
            <StakeholderCard
              key={stakeholder.id}
              stakeholder={stakeholder}
              locale={locale}
              roleLabel={t.edit}
              influenceLabel={
                stakeholder.influence
                  ? influenceLabels[stakeholder.influence]
                  : ""
              }
              interestLabel={
                stakeholder.interest
                  ? interestLabels[stakeholder.interest]
                  : ""
              }
              onEdit={setEditingStakeholder}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateStakeholderDialog
          locale={locale}
          projectId={projectId}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Edit dialog */}
      {editingStakeholder && (
        <EditStakeholderDialog
          stakeholder={editingStakeholder}
          locale={locale}
          projectId={projectId}
          onClose={() => setEditingStakeholder(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}