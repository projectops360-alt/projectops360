"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  renameOrganizationAction,
  type RenameOrgState,
} from "@/app/[locale]/(app)/settings/actions";

/**
 * Editable organization name (Settings → Organization). Only rendered for
 * owners/admins — the server action and the RLS policy re-check authority.
 * Labels arrive as props from the server page (same pattern as ThemeControl).
 */
export function OrganizationNameForm({
  initialName,
  labels,
}: {
  initialName: string;
  labels: {
    nameLabel: string;
    save: string;
    saved: string;
    errorInvalid: string;
    errorDenied: string;
    errorGeneric: string;
  };
}) {
  const [state, formAction, isPending] = useActionState<RenameOrgState, FormData>(
    renameOrganizationAction,
    null,
  );

  const errorText =
    state && !state.ok
      ? state.reason === "invalid_name"
        ? labels.errorInvalid
        : state.reason === "not_authorized"
          ? labels.errorDenied
          : labels.errorGeneric
      : null;

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <label
          htmlFor="settings-orgName"
          className="block text-sm font-medium text-foreground"
        >
          {labels.nameLabel}
        </label>
        <input
          id="settings-orgName"
          name="organizationName"
          type="text"
          required
          minLength={2}
          maxLength={120}
          defaultValue={state?.ok ? state.name : initialName}
          disabled={isPending}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:max-w-sm"
        />
      </div>

      {errorText && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {errorText}
        </p>
      )}
      {state?.ok && (
        <p className="text-xs font-medium text-green-600 dark:text-green-400">
          {labels.saved}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {labels.save}
      </button>
    </form>
  );
}
