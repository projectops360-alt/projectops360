"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import type { Locale } from "@/types/database";
import { changeOwnPasswordAction } from "./actions";

export function ChangePasswordForm({
  locale,
  forced,
  mode,
}: {
  locale: Locale;
  forced: boolean;
  mode?: "recovery" | "invite";
}) {
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);
  const router = useRouter();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();

  const ERRORS: Record<string, { en: string; es: string }> = {
    weak_password: { en: "Use at least 12 characters.", es: "Usa al menos 12 caracteres." },
    same_password: { en: "Choose a password different from the temporary one.", es: "Elige una contraseña distinta a la temporal." },
    update_failed: { en: "Could not update the password. Try again.", es: "No se pudo actualizar la contraseña. Inténtalo de nuevo." },
    not_authenticated: { en: "Your session expired. Please sign in again.", es: "Tu sesión expiró. Inicia sesión de nuevo." },
    mismatch: { en: "The passwords do not match.", es: "Las contraseñas no coinciden." },
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pwd.length < 12) return setError("weak_password");
    if (pwd !== confirm) return setError("mismatch");
    start(async () => {
      const r = await changeOwnPasswordAction({ password: pwd });
      if (!r.ok) return setError(r.error ?? "update_failed");
      if (mode) return setSuccess(true);
      router.push("/");
      router.refresh();
    });
  }

  if (success) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-8 w-8 text-brand-600 dark:text-brand-400" />
          <h1 className="mt-3 text-xl font-bold text-foreground">
            {tt("Password updated", "Contraseña actualizada")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tt(
              "Your password was updated successfully and your session is active.",
              "Tu contraseña se actualizó correctamente y tu sesión está activa.",
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
            className="mt-5 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {tt("Continue", "Continuar")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2 text-brand-600 dark:text-brand-400">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">{tt("Security", "Seguridad")}</span>
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {mode === "invite"
            ? tt("Create your password", "Crea tu contraseña")
            : tt("Set a new password", "Establece una nueva contraseña")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "recovery"
            ? tt(
                "Choose a new password to finish recovering your account.",
                "Elige una contraseña nueva para terminar de recuperar tu cuenta.",
              )
            : mode === "invite"
              ? tt(
                  "Choose a password to finish accepting your invitation.",
                  "Elige una contraseña para terminar de aceptar tu invitación.",
                )
            : forced
            ? tt(
                "Your account uses a temporary password. Please choose a new one to continue.",
                "Tu cuenta usa una contraseña temporal. Elige una nueva para continuar.",
              )
            : tt("Choose a new password for your account.", "Elige una nueva contraseña para tu cuenta.")}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">{tt("New password", "Nueva contraseña")}</label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-background px-3">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <input
                type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus
                className="w-full bg-transparent py-2 text-sm text-foreground focus:outline-none"
                placeholder={tt("At least 12 characters", "Al menos 12 caracteres")} minLength={12} required
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{tt("Confirm password", "Confirma la contraseña")}</label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-background px-3">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <input
                type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-transparent py-2 text-sm text-foreground focus:outline-none"
                placeholder={tt("Repeat the password", "Repite la contraseña")} minLength={12} required
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{ERRORS[error]?.[isEs ? "es" : "en"] ?? error}</p>}

          <button
            type="submit" disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {tt("Save and continue", "Guardar y continuar")}
          </button>
        </form>
      </div>
    </div>
  );
}
