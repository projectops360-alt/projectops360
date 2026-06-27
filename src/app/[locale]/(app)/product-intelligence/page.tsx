// ============================================================================
// ProjectOps360° — Product Intelligence Center (server route)
// ============================================================================
// Internal-only surface that renders the Product Intelligence™ documentation
// (docs/product-brain) inside the app. Access is enforced SERVER-SIDE: only
// org owners/admins may view it. Unauthorized users get a 404 (the route's
// existence is not revealed). Document content is read server-only and reaches
// the client only after this gate passes — there is no open docs API.
// ============================================================================

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/auth";
import { getAllProductBrainDocs, DEFAULT_DOC_ID } from "@/lib/product-brain/loader";
import { canViewProductIntelligence } from "@/lib/product-brain/access";
import { ProductIntelligenceCenter } from "@/components/product-brain/product-intelligence-center";
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

  // ── Server-side access control ────────────────────────────────────────────
  const org = await getOrgContext();
  if (!canViewProductIntelligence(org.role)) {
    notFound();
  }
  const isAdmin = org.role === "owner" || org.role === "admin";

  const docs = await getAllProductBrainDocs();
  const requestedId = doc && doc.trim() ? doc.trim() : DEFAULT_DOC_ID;
  const initialId = docs.some((d) => d.id === requestedId)
    ? requestedId
    : docs.some((d) => d.id === DEFAULT_DOC_ID)
      ? DEFAULT_DOC_ID
      : (docs[0]?.id ?? null);

  return (
    <ProductIntelligenceCenter
      locale={locale as Locale}
      docs={docs}
      initialId={initialId}
      isAdmin={isAdmin}
    />
  );
}
