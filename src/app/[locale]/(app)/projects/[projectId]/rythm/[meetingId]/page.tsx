import { redirect } from "next/navigation";
import { localizedHref } from "@/i18n/href";

// ── REG-011: Rythm/Rhythm consolidation ──────────────────────────────────────
// Backward-compatible alias for old Rythm meeting deep links. The standalone
// Rythm meeting-detail surface queried `project_rythm_meetings`, a table that
// never reached production, so it crashed. We redirect any old `/rythm/:id`
// link to the canonical Rhythm Center (`/rhythm`).
// See docs/product-brain/10-regression-log.md → REG-011.
export default async function RythmMeetingAliasRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  redirect(localizedHref(locale, `/projects/${projectId}/rhythm`));
}
