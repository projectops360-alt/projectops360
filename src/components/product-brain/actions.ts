"use server";

// ============================================================================
// ProjectOps360° — Product Brain Control Center — server actions (allowlisted)
// ============================================================================
// Every action re-derives the trusted session and enforces the SAME strict email
// allowlist as the route (TASK 10A). Unauthorized callers never receive Product
// Brain content through these endpoints — defense in depth, not UI-only hiding.
// ============================================================================

import { getOrgContext } from "@/lib/auth";
import { isProductBrainAllowedEmail } from "@/lib/product-brain/access.server";
import { PRODUCT_BRAIN_ITEMS } from "@/lib/product-brain-center/registry";
import { toMarkdownReport } from "@/lib/product-brain-center/select";

const DENIED = "I do not have permission to expose internal Product Brain details for your account.";

async function allowed(): Promise<boolean> {
  try {
    const org = await getOrgContext();
    return isProductBrainAllowedEmail(org.email);
  } catch {
    return false;
  }
}

export type IsabellaItemResult =
  | { ok: true; answer: string }
  | { ok: false; message: string };

/**
 * "Ask Isabella about this item." Returns a deterministic, grounded explanation
 * built from the item's own metadata — never invents status/implementation. For
 * non-allowed users it returns the safe refusal and NO Product Brain content.
 */
export async function askIsabellaAboutItemAction(itemKey: string): Promise<IsabellaItemResult> {
  if (!(await allowed())) return { ok: false, message: DENIED };
  const item = PRODUCT_BRAIN_ITEMS.find((i) => i.itemKey === itemKey);
  if (!item) return { ok: false, message: "I couldn't find that Product Brain item." };

  const parts = [
    `${item.itemKey} — ${item.title}`,
    `Type: ${item.type} · Status: ${item.status} · Test: ${item.testStatus}${item.module ? ` · Module: ${item.module}` : ""}`,
    item.summary && `\n${item.summary}`,
    item.decision && `\nDecision: ${item.decision}`,
    item.expectedBehavior && `\nExpected behavior: ${item.expectedBehavior}`,
    item.protectionRule && `\nProtection rule: ${item.protectionRule}`,
    item.testFiles.length > 0 && `\nProtected by: ${item.testFiles.join(", ")}`,
    item.verificationSteps.length > 0 && `\nVerify: ${item.verificationSteps.join(" · ")}`,
    `\nSource: docs/product-brain/${item.sourcePath}${item.sourceSection ? ` → ${item.sourceSection}` : ""}`,
  ].filter(Boolean);

  return { ok: true, answer: parts.join("\n") };
}

export type ExportResult = { ok: true; markdown: string } | { ok: false; message: string };

/** Export the Product Brain status report as Markdown. Allowlisted. */
export async function exportProductBrainAction(): Promise<ExportResult> {
  if (!(await allowed())) return { ok: false, message: DENIED };
  return { ok: true, markdown: toMarkdownReport(PRODUCT_BRAIN_ITEMS) };
}
