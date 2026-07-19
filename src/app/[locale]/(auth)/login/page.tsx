import { setRequestLocale, getTranslations } from "next-intl/server";
import { LoginForm, type LoginNotice } from "@/components/auth/login-form";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ authError?: string }>;
}) {
  const { locale } = await params;
  const { authError } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("auth.login");

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <LoginForm
        initialNotice={
          authError === "confirmation_failed" || authError === "recovery_link_invalid"
            ? (authError as LoginNotice)
            : undefined
        }
      />
    </div>
  );
}
