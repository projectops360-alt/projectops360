"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { signupAction } from "@/app/[locale]/(auth)/actions";

type SignupState =
  | { error: string; success?: undefined; email?: undefined }
  | { error?: undefined; success: true; email: string }
  | null;

export function SignupForm() {
  const t = useTranslations("auth.signup");

  async function handleSignup(
    _prevState: SignupState,
    formData: FormData
  ): Promise<SignupState> {
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      return { error: t("errors.passwordMismatch") };
    }

    if (password.length < 6) {
      return { error: t("errors.weakPassword") };
    }

    const result = await signupAction(formData);

    if (result?.error) {
      if (
        result.error.includes("already registered") ||
        result.error.includes("already exists")
      ) {
        return { error: t("errors.emailTaken") };
      } else {
        return { error: t("errors.unexpected") };
      }
    }

    if (result?.success && result?.email) {
      return { success: true, email: result.email };
    }

    return null;
  }

  const [state, formAction, isPending] = useActionState(handleSignup, null);

  // Show success message after signup
  if (state?.success && state?.email) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900">
          <svg
            className="h-6 w-6 text-brand-600 dark:text-brand-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.616a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          {t("success.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("success.message", { email: state.email })}
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          {t("success.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="signup-displayName"
          className="block text-sm font-medium text-foreground"
        >
          {t("displayName")}
        </label>
        <input
          id="signup-displayName"
          name="displayName"
          type="text"
          autoComplete="name"
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          placeholder="Jane Doe"
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="signup-email"
          className="block text-sm font-medium text-foreground"
        >
          {t("email")}
        </label>
        <input
          id="signup-email"
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
          htmlFor="signup-password"
          className="block text-sm font-medium text-foreground"
        >
          {t("password")}
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          placeholder="••••••"
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="signup-confirmPassword"
          className="block text-sm font-medium text-foreground"
        >
          {t("confirmPassword")}
        </label>
        <input
          id="signup-confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
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
        {t("hasAccount")}{" "}
        <Link
          href="/login"
          className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          {t("loginLink")}
        </Link>
      </p>
    </form>
  );
}