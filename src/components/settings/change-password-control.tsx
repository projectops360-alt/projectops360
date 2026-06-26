"use client";

import { useState } from "react";
import { KeyRound, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  labels: {
    newPassword: string; confirm: string; update: string; updated: string;
    tooShort: string; mismatch: string; failed: string; placeholder: string;
  };
}

/** Lets the signed-in user change their own password (no email needed) —
 *  so members created with a temporary password can set their own. */
export function ChangePasswordControl({ labels }: Props) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null); setOk(false);
    if (pw.length < 8) { setErr(labels.tooShort); return; }
    if (pw !== confirm) { setErr(labels.mismatch); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) { setErr(labels.failed); return; }
      setOk(true); setPw(""); setConfirm("");
      setTimeout(() => setOk(false), 4000);
    } catch {
      setErr(labels.failed);
    } finally {
      setBusy(false);
    }
  }

  const inp = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none";

  return (
    <div className="mt-4 space-y-2 sm:max-w-sm">
      <input type="password" className={inp} placeholder={labels.newPassword} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
      <input type="password" className={inp} placeholder={labels.confirm} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
      <button type="button" onClick={submit} disabled={busy || !pw || !confirm}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : ok ? <Check className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
        {ok ? labels.updated : labels.update}
      </button>
    </div>
  );
}
