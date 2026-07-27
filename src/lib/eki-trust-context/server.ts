import "server-only";

import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rankRemediation, summarize, toControlViews } from "./assembler";
import { loadTrustContext } from "./loader";
import type { TrustContext, TrustControlView } from "./types";

/**
 * Internal entry points for Enterprise Trust context.
 *
 * The organization comes from `getOrgContext()` and the reads go through the
 * caller's Supabase client, so RLS is what decides visibility. Neither the
 * tenant nor the actor is ever accepted as an argument: a caller that could name
 * its own organization would read another tenant's controls, and every claim
 * built on that context would be confidently wrong.
 */

export interface TrustOverview {
  context: TrustContext;
  views: TrustControlView[];
  summary: ReturnType<typeof summarize>;
  remediation: ReturnType<typeof rankRemediation>;
}

export async function getEnterpriseTrustOverview(): Promise<TrustOverview> {
  const org = await getOrgContext();
  const client = await createClient();
  const { context } = await loadTrustContext(client, org.organizationId, new Date().toISOString());
  const views = toControlViews(context);
  return {
    context,
    views,
    summary: summarize(views),
    remediation: rankRemediation(views),
  };
}

export async function getEnterpriseTrustControl(controlObjectId: string): Promise<TrustControlView | null> {
  const { views } = await getEnterpriseTrustOverview();
  return views.find((view) => view.controlObjectId === controlObjectId) ?? null;
}
