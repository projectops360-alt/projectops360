"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { loginAction } from "@/app/[locale]/(auth)/actions";

export function LoginForm() {
  const t = useTranslations("auth.login");

  async function handleLogin(
    _prevState: { error: string } | null,
    formData: FormData
  ): Promise<{ error: string } | null> {
    const result = await loginAction(formData);
    if (result?.error) {
      // Map Supabase error messages to translation keys
      if (result.error.includes("Invalid login credentials")) {
        return { error: t("errors.invalidCredentials") };
      } else if (result.error.includes("Email not confirmed")) {
        return { error: t("errors.emailNotConfirmed") };
      } else {
        return { error: t("errors.unexpected") };
      }
    }
    // On success, the server action redirects — no need to return anything
    return null;
  }

  const [state, formAction, isPending] = useActionState(handleLogin, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="login-email"
          className="block text-sm font-medium text-foreground"
        >
          {t("email")}
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          placeholder="you@example.com"
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="login-password"
          className="block text-sm font-medium text-foreground"
        >
          {t("password")}
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          placeholder="••••••"
          disabled={isPending}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "…" : t("submit")}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link
          href="/signup"
          className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          {t("signupLink")}
        </Link>
      </p>
    </form>
  );
}