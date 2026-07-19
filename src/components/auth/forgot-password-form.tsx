"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { requestPasswordResetAction } from "@/app/[locale]/(auth)/actions";
import { Link } from "@/i18n/navigation";

type ResetState = { error?: "invalid_email" | "delivery_failed"; success?: true } | null;

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");

  async function handleReset(_previousState: ResetState, formData: FormData): Promise<ResetState> {
    return requestPasswordResetAction(formData);
  }

  const [state, formAction, isPending] = useActionState(handleReset, null);

  if (state?.success) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100">
          {t("success")}
        </div>
        <Link href="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {t(`errors.${state.error}`)}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="recovery-email" className="block text-sm font-medium text-foreground">
          {t("email")}
        </label>
        <input
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          placeholder="you@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? t("sending") : t("submit")}
      </button>

      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}
