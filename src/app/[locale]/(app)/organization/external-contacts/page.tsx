import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/lib/auth";
import { getExternalContacts } from "@/lib/team-roles/service";
import { ContactsClient } from "./contacts-client";

export const dynamic = "force-dynamic";

export default async function ExternalContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const org = await getOrgContext();
  const contacts = await getExternalContacts(org);
  return <ContactsClient locale={locale} contacts={contacts} />;
}
