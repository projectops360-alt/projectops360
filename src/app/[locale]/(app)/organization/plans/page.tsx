import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/auth";
import { getPlansWithEntitlements } from "@/lib/billing/service";
import { isPlatformAdmin } from "@/lib/admin-console/access.server";
import { PlansAdminClient } from "./plans-admin-client";

export const dynamic = "force-dynamic";

export default async function PlansAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const org = await getOrgContext();
  if (!(await isPlatformAdmin(org.email))) notFound();

  const plans = await getPlansWithEntitlements();
  return <PlansAdminClient locale={locale} plans={plans as unknown as Record<string, unknown>[]} />;
}
