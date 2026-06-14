import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import type { DrawingExtraction, DrawingFile, DrawingInsight, DrawingProcessingJob, DrawingVersion } from "@/types/drawing-intelligence";
import { getConnector } from "@/lib/drawing-intelligence/connectors/registry";
import { DrawingIntelligenceClient, type EvidenceRow } from "./drawing-intelligence-client";

export const dynamic = "force-dynamic";

export default async function DrawingIntelligencePage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("drawingIntelligence");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Fetch project, drawing files and processing jobs in parallel.
  // Drawing tables may not exist before the migration is applied — errors
  // degrade gracefully to empty lists.
  const [projectResult, filesResult, jobsResult, extractionsResult, insightsResult, tasksResult, versionsResult, evidenceResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, slug, title_i18n")
      .eq("id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("drawing_files")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("drawing_processing_jobs")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("drawing_extractions")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("drawing_insights")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("roadmap_tasks")
      .select("id, title")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index"),
    supabase
      .from("drawing_versions")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("drawing_evidence")
      .select("id, drawing_file_id, page_number, related_entity_type, text_excerpt, confidence_score")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("page_number", { ascending: true })
      .limit(1000),
  ]);

  // Connector readiness — env checked server-side only, credentials never
  // reach the client. isConfigured() is a cheap env check (no network).
  const autodeskConfigured = getConnector("autodesk_aps")?.isConfigured() ?? false;

  const project = projectResult.data;
  if (!project) {
    notFound();
  }

  const projectTitle = getI18nValue(project.title_i18n, locale as Locale) || project.slug;

  return (
    <DrawingIntelligenceClient
      projectId={projectId}
      projectTitle={projectTitle}
      organizationId={org.organizationId}
      files={(filesResult.data ?? []) as DrawingFile[]}
      jobs={(jobsResult.data ?? []) as DrawingProcessingJob[]}
      extractions={(extractionsResult.data ?? []) as DrawingExtraction[]}
      insights={(insightsResult.data ?? []) as DrawingInsight[]}
      tasks={(tasksResult.data ?? []) as { id: string; title: string }[]}
      versions={(versionsResult.data ?? []) as DrawingVersion[]}
      evidence={(evidenceResult.data ?? []) as EvidenceRow[]}
      autodeskConfigured={autodeskConfigured}
      locale={locale as Locale}
      translations={{
        title: t("title"),
        subtitle: t("subtitle"),
        notStorageNote: t("notStorageNote"),
        emptyTitle: t("emptyTitle"),
        emptyDescription: t("emptyDescription"),
        comingSoon: t("comingSoon"),
        tabs: {
          upload: t("tabs.upload"),
          library: t("tabs.library"),
          extractions: t("tabs.extractions"),
          risks: t("tabs.risks"),
          rfis: t("tabs.rfis"),
          submittals: t("tabs.submittals"),
          takeoff: t("tabs.takeoff"),
          versions: t("tabs.versions"),
          schedule: t("tabs.schedule"),
          cost: t("tabs.cost"),
          actions: t("tabs.actions"),
          evidence: t("tabs.evidence"),
          logs: t("tabs.logs"),
        },
        library: {
          drawingNumber: t("library.drawingNumber"),
          drawingTitle: t("library.drawingTitle"),
          discipline: t("library.discipline"),
          revision: t("library.revision"),
          source: t("library.source"),
          fileStatus: t("library.fileStatus"),
          processingStatus: t("library.processingStatus"),
          added: t("library.added"),
          empty: t("library.empty"),
        },
        processingStatus: {
          pending: t("processingStatus.pending"),
          processing: t("processingStatus.processing"),
          completed: t("processingStatus.completed"),
          failed: t("processingStatus.failed"),
          needs_review: t("processingStatus.needs_review"),
          cancelled: t("processingStatus.cancelled"),
        },
        fileStatus: {
          active: t("fileStatus.active"),
          superseded: t("fileStatus.superseded"),
          archived: t("fileStatus.archived"),
        },
        upload: {
          title: t("upload.title"),
          description: t("upload.description"),
          manual: t("upload.manual"),
          manualDescription: t("upload.manualDescription"),
          autodesk: t("upload.autodesk"),
          autodeskDescription: t("upload.autodeskDescription"),
          procore: t("upload.procore"),
          procoreDescription: t("upload.procoreDescription"),
          googleDrive: t("upload.googleDrive"),
          googleDriveDescription: t("upload.googleDriveDescription"),
          comingSoonBadge: t("upload.comingSoonBadge"),
        },
        uploadZone: {
          dropHere: t("uploadZone.dropHere"),
          browse: t("uploadZone.browse"),
          supportedFormats: t("uploadZone.supportedFormats"),
          maxSize: t("uploadZone.maxSize"),
          stageValidating: t("uploadZone.stageValidating"),
          stageUploading: t("uploadZone.stageUploading"),
          stageRegistering: t("uploadZone.stageRegistering"),
          stageQueued: t("uploadZone.stageQueued"),
          processingMode: t("uploadZone.processingMode"),
          modes: {
            quick_scan: t("uploadZone.modes.quick_scan"),
            standard_analysis: t("uploadZone.modes.standard_analysis"),
            deep_analysis: t("uploadZone.modes.deep_analysis"),
          },
          modeDescriptions: {
            quick_scan: t("uploadZone.modeDescriptions.quick_scan"),
            standard_analysis: t("uploadZone.modeDescriptions.standard_analysis"),
            deep_analysis: t("uploadZone.modeDescriptions.deep_analysis"),
          },
          costNote: t("uploadZone.costNote"),
          errors: {
            unsupported_file_type: t("errors.unsupported_file_type"),
            file_too_large: t("errors.file_too_large"),
            empty_file: t("errors.empty_file"),
            duplicate_file: t("errors.duplicate_file"),
            upload_failed: t("errors.upload_failed"),
            missing_project_context: t("errors.missing_project_context"),
            processing_job_failed: t("errors.processing_job_failed"),
            storage_error: t("errors.storage_error"),
            permission_error: t("errors.permission_error"),
            not_authenticated: t("errors.not_authenticated"),
            validation_error: t("errors.validation_error"),
          },
        },
        actionsMenu: {
          view: t("actionsMenu.view"),
          retry: t("actionsMenu.retry"),
          archive: t("actionsMenu.archive"),
          confirmArchive: t("actionsMenu.confirmArchive"),
        },
        pipelineHints: {
          pending: t("pipelineHints.pending"),
          processing: t("pipelineHints.processing"),
          completed: t("pipelineHints.completed"),
          failed: t("pipelineHints.failed"),
          needs_review: t("pipelineHints.needs_review"),
          cancelled: t("pipelineHints.cancelled"),
        },
        jobTypes: {
          ingest: t("jobTypes.ingest"),
          page_split: t("jobTypes.page_split"),
          ocr_extraction: t("jobTypes.ocr_extraction"),
          ai_interpretation: t("jobTypes.ai_interpretation"),
        },
        extractionsTable: {
          file: t("extractionsTable.file"),
          type: t("extractionsTable.type"),
          confidence: t("extractionsTable.confidence"),
        },
        takeoffTab: {
          category: t("takeoffTab.category"),
          item: t("takeoffTab.item"),
          specification: t("takeoffTab.specification"),
          quantity: t("takeoffTab.quantity"),
          unit: t("takeoffTab.unit"),
          location: t("takeoffTab.location"),
          sheetRef: t("takeoffTab.sheetRef"),
          status: t("takeoffTab.status"),
          drawing: t("takeoffTab.drawing"),
          confidence: t("takeoffTab.confidence"),
          empty: t("takeoffTab.empty"),
          statusLabels: {
            new: t("takeoffTab.statusLabels.new"),
            existing: t("takeoffTab.statusLabels.existing"),
            demo: t("takeoffTab.statusLabels.demo"),
            relocated: t("takeoffTab.statusLabels.relocated"),
          },
        },
        versionsTab: {
          drawing: t("versionsTab.drawing"),
          fromRevision: t("versionsTab.fromRevision"),
          toRevision: t("versionsTab.toRevision"),
          summary: t("versionsTab.summary"),
          date: t("versionsTab.date"),
          empty: t("versionsTab.empty"),
        },
        connector: {
          notConfigured: t("connector.notConfigured"),
          notConfiguredHint: t("connector.notConfiguredHint"),
          configured: t("connector.configured"),
        },
        sourceBadges: {
          manual_upload: t("sourceBadges.manual_upload"),
          autodesk_aps: t("sourceBadges.autodesk_aps"),
          procore: t("sourceBadges.procore"),
          google_drive: t("sourceBadges.google_drive"),
          local: t("sourceBadges.local"),
        },
        progress: {
          title: t("progress.title"),
          done: t("progress.done"),
          failed: t("progress.failed"),
          needsReview: t("progress.needsReview"),
        },
        insights: {
          empty: t("insights.empty"),
          confidence: t("insights.confidence"),
          evidence: t("insights.evidence"),
          recommendedAction: t("insights.recommendedAction"),
          linkedTask: t("insights.linkedTask"),
          accept: t("insights.accept"),
          dismiss: t("insights.dismiss"),
          markReviewed: t("insights.markReviewed"),
          linkToTask: t("insights.linkToTask"),
          cancel: t("insights.cancel"),
          needsReviewNote: t("insights.needsReviewNote"),
          typeLabels: {
            risk: t("insights.typeLabels.risk"),
            rfi_candidate: t("insights.typeLabels.rfi_candidate"),
            submittal_requirement: t("insights.typeLabels.submittal_requirement"),
            inspection_requirement: t("insights.typeLabels.inspection_requirement"),
            schedule_impact: t("insights.typeLabels.schedule_impact"),
            cost_impact: t("insights.typeLabels.cost_impact"),
            missing_information: t("insights.typeLabels.missing_information"),
            contradiction: t("insights.typeLabels.contradiction"),
            scope_gap: t("insights.typeLabels.scope_gap"),
            coordination_issue: t("insights.typeLabels.coordination_issue"),
            version_change: t("insights.typeLabels.version_change"),
            decision_required: t("insights.typeLabels.decision_required"),
          },
          severityLabels: {
            low: t("insights.severityLabels.low"),
            medium: t("insights.severityLabels.medium"),
            high: t("insights.severityLabels.high"),
            critical: t("insights.severityLabels.critical"),
          },
          statusLabels: {
            open: t("insights.statusLabels.open"),
            in_review: t("insights.statusLabels.in_review"),
            accepted: t("insights.statusLabels.accepted"),
            dismissed: t("insights.statusLabels.dismissed"),
            converted: t("insights.statusLabels.converted"),
            linked: t("insights.statusLabels.linked"),
            actioned: t("insights.statusLabels.actioned"),
            resolved: t("insights.statusLabels.resolved"),
          },
          actionLabels: {
            create_draft_rfi: t("insights.actionLabels.create_draft_rfi"),
            create_submittal_requirement: t("insights.actionLabels.create_submittal_requirement"),
            create_inspection_requirement: t("insights.actionLabels.create_inspection_requirement"),
            add_schedule_constraint: t("insights.actionLabels.add_schedule_constraint"),
            add_cost_impact_candidate: t("insights.actionLabels.add_cost_impact_candidate"),
            request_human_review: t("insights.actionLabels.request_human_review"),
            notify_project_owner: t("insights.actionLabels.notify_project_owner"),
            compare_against_previous_revision: t("insights.actionLabels.compare_against_previous_revision"),
          },
        },
        detail: {
          title: t("detail.title"),
          metadata: t("detail.metadata"),
          pipeline: t("detail.pipeline"),
          pages: t("detail.pages"),
          extractionsPlaceholder: t("detail.extractionsPlaceholder"),
          evidencePlaceholder: t("detail.evidencePlaceholder"),
          retry: t("detail.retry"),
          noJobs: t("detail.noJobs"),
          titleBlock: t("detail.titleBlock"),
          revisions: t("detail.revisions"),
          notes: t("detail.notes"),
          evidence: t("detail.evidence"),
          rawJson: t("detail.rawJson"),
          confidence: t("detail.confidence"),
          needsReviewBanner: t("detail.needsReviewBanner"),
          runExtraction: t("detail.runExtraction"),
          running: t("detail.running"),
          fields: {
            fileName: t("detail.fields.fileName"),
            fileType: t("detail.fields.fileType"),
            fileSize: t("detail.fields.fileSize"),
            source: t("detail.fields.source"),
            drawingNumber: t("detail.fields.drawingNumber"),
            revision: t("detail.fields.revision"),
            discipline: t("detail.fields.discipline"),
            uploaded: t("detail.fields.uploaded"),
          },
        },
      }}
    />
  );
}
