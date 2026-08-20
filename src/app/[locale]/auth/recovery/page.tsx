import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

function getSafeRecoveryTokenHash(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const expected = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!expected) return null;
    const expectedUrl = new URL(expected);
    if (url.origin !== expectedUrl.origin) return null;
    if (!url.pathname.endsWith("/auth/v1/verify")) return null;
    if (url.searchParams.get("type") !== "recovery") return null;

    const tokenHash = url.searchParams.get("token");
    if (!tokenHash) return null;
    return tokenHash;
  } catch {
    return null;
  }
}

export default async function RecoveryInterstitialPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ confirmation_url?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const isEs = locale === "es";
  const tokenHash = getSafeRecoveryTokenHash(query.confirmation_url);
  const changePasswordPath =
    locale === routing.defaultLocale
      ? "/change-password?recovery=1"
      : `/${locale}/change-password?recovery=1`;
  const loginHref = locale === routing.defaultLocale ? "/login" : `/${locale}/login`;

  const confirmHref = tokenHash
    ? `/auth/recovery/confirm?token_hash=${encodeURIComponent(tokenHash)}&next=${encodeURIComponent(changePasswordPath)}`
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          {isEs ? "Seguridad" : "Security"}
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {isEs ? "Recuperar contraseña" : "Recover password"}
        </h1>
        {confirmHref ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {isEs
                ? "Por seguridad, confirma que quieres continuar. El enlace de recuperación se utilizará solo después de presionar el botón."
                : "For security, confirm that you want to continue. The recovery link will only be used after you press the button."}
            </p>
            <a
              href={confirmHref}
              rel="nofollow"
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {isEs ? "Continuar para cambiar contraseña" : "Continue to change password"}
            </a>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {isEs
                ? "Este enlace de recuperación no es válido. Solicita uno nuevo desde la pantalla de inicio de sesión."
                : "This recovery link is not valid. Request a new one from the sign-in screen."}
            </p>
            <a
              href={loginHref}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              {isEs ? "Volver al inicio de sesión" : "Back to sign in"}
            </a>
          </>
        )}
      </div>
    </main>
  );
}
