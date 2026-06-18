import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/lib/auth";
import { getCompanyTeams, getCompanyDirectory, getExternalContacts } from "@/lib/team-roles/service";
import { TeamsClient } from "./teams-client";

export const dynamic = "force-dynamic";

export default async function OrgTeamsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const org = await getOrgContext();
  const [{ teams, membersByTeam }, directory, externals] = await Promise.all([
    getCompanyTeams(org), getCompanyDirectory(org), getExternalContacts(org),
  ]);
  const members: Record<string, Record<string, unknown>[]> = {};
  for (const [k, v] of membersByTeam.entries()) members[k] = v;

  return <TeamsClient locale={locale} teams={teams} membersByTeam={members} directory={directory} externals={externals} />;
}
