"use client";

// ============================================================================
// PMO Process Intelligence — signature-based realtime refresh (CAP-047 · M8)
// ============================================================================
// Polls a cheap RLS-scoped signature and calls router.refresh() ONLY when it
// changes — incremental by construction, no render storms. Deterministic
// error backoff (20s → 120s), pauses while the tab is hidden, and every
// timer/listener is cleaned up on unmount (no subscription leaks).
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";
import {
  nextPollDelay,
  shouldRefresh,
} from "@/lib/pmo-process-intelligence/realtime";
import { getPmoPiSignatureAction } from "@/app/[locale]/(app)/process-intelligence/actions";

export function RealtimeRefresh({
  focusProjectId,
  locale,
}: {
  focusProjectId: string | null;
  locale: "en" | "es";
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  const router = useRouter();
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [degraded, setDegraded] = useState(false);
  const signatureRef = useRef<string | null>(null);
  const errorsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;

    async function tick(): Promise<void> {
      if (stoppedRef.current) return;
      if (document.hidden) {
        schedule(); // paused — check again later without querying
        return;
      }
      try {
        const res = await getPmoPiSignatureAction({ projectId: focusProjectId });
        if (stoppedRef.current) return;
        if (res.signature) {
          errorsRef.current = 0;
          setDegraded(false);
          setLastSync(new Date());
          if (shouldRefresh(signatureRef.current, res.signature)) {
            signatureRef.current = res.signature;
            router.refresh();
          } else {
            signatureRef.current = res.signature;
          }
        } else {
          errorsRef.current++;
          setDegraded(true);
        }
      } catch {
        errorsRef.current++;
        setDegraded(true);
      }
      schedule();
    }

    function schedule(): void {
      if (stoppedRef.current) return;
      timerRef.current = setTimeout(tick, nextPollDelay(errorsRef.current));
    }

    void tick();
    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [focusProjectId, router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-live="polite">
      <Radio className={`h-3.5 w-3.5 ${degraded ? "text-amber-500" : "text-green-600 dark:text-green-400"}`} />
      {degraded
        ? tt("live updates degraded — retrying", "actualizaciones en vivo degradadas — reintentando")
        : lastSync
          ? `${tt("live · synced", "en vivo · sincronizado")} ${lastSync.toLocaleTimeString(locale === "es" ? "es" : "en")}`
          : tt("live · connecting", "en vivo · conectando")}
    </span>
  );
}
