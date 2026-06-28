// ============================================================================
// ProjectOps360° — Product Brain Control Center (server route)
// ============================================================================
// Internal-only governance cockpit. Access is enforced SERVER-SIDE by a STRICT
// EMAIL ALLOWLIST (TASK 10A) — not role, not UI hiding. Unauthorized users get a
// 404 (the route's existence is not revealed) and NO Product Brain data is loaded
// or serialized to the client. The structured registry + document content are
// read server-only and reach the client only after this gate passes.
// ============================================================================

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/auth";
import { getAllProductBrainDocs, DEFAULT_DOC_ID } from "@/lib/product-brain/loader";
import { isProductBrainAllowedEmail } from "@/lib/product-brain/access.server";
import { PRODUCT_BRAIN_ITEMS } from "@/lib/product-brain-center/registry";
import { ProductBrainControlCenter } from "@/components/product-brain/control-center";
import type { Locale } from "@/types/database";

export default async function ProductIntelligencePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { locale } = await params;
  const { doc } = await searchParams;
  setRequestLocale(locale);

  // ── Server-side access control: STRICT EMAIL ALLOWLIST (TASK 10A) ──────────
  const org = await getOrgContext();
  if (!isProductBrainAllowedEmail(org.email)) {
    notFound(); // do not reveal existence; load no data
  }

  const docs = await getAllProductBrainDocs();
  const requestedId = doc && doc.trim() ? doc.trim() : DEFAULT_DOC_ID;
  const initialDocId = docs.some((d) => d.id === requestedId)
    ? requestedId
    : docs.some((d) => d.id === DEFAULT_DOC_ID)
      ? DEFAULT_DOC_ID
      : (docs[0]?.id ?? null);

  return (
    <ProductBrainControlCenter
      locale={locale as Locale}
      items={PRODUCT_BRAIN_ITEMS}
      docs={docs}
      initialDocId={initialDocId}
      isAdmin
    />
  );
}
