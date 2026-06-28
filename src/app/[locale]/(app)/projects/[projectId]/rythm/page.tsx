import { redirect } from "next/navigation";
import { localizedHref } from "@/i18n/href";

// ── REG-011: Rythm/Rhythm consolidation ──────────────────────────────────────
// Rythm (meeting/audio intelligence) and Rhythm Center are consolidated into a
// single canonical surface: Rhythm Center (`/rhythm`). In production the Rythm
// audio capability lives inside the Rhythm Center schema (the standalone
// `project_rythm_meetings` table this route used to query never reached prod),
// so the old standalone dashboard crashed with a server error.
//
// This route is preserved as a backward-compatible alias: any old bookmark or
// deep link to `/rythm` now redirects safely to the canonical `/rhythm` module.
// See docs/product-brain/10-regression-log.md → REG-011.
export default async function RythmAliasRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  redirect(localizedHref(locale, `/projects/${projectId}/rhythm`));
}
