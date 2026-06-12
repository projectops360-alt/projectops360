import { setRequestLocale, getTranslations } from "next-intl/server";
import { getOrgContext } from "@/lib/auth";
import { Users } from "lucide-react";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Ensure user is authenticated
  await getOrgContext();

  const t = await getTranslations("placeholders");

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{t("team.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("team.description")}</p>
      </div>
    </div>
  );
}