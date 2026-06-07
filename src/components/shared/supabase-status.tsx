"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { checkPublicEnv } from "@/lib/env";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  WifiOff,
  ShieldCheck,
  Database,
} from "lucide-react";

type ConnectionStatus = "checking" | "connected" | "error";

function StatusBadge({
  status,
  label,
}: {
  status: "ok" | "fail" | "pending";
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
      {status === "ok" && <CheckCircle2 className="h-4 w-4 text-brand-500" />}
      {status === "fail" && <XCircle className="h-4 w-4 text-destructive" />}
      {status === "pending" && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
      <span className="text-sm text-foreground">{label}</span>
    </div>
  );
}

export function SupabaseStatus() {
  const t = useTranslations("supabase");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("checking");
  const [envStatus, setEnvStatus] = useState<"ok" | "fail" | "pending">(
    "pending"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [envDetails, setEnvDetails] = useState<{
    url: string;
    key: string;
    urlSet: boolean;
    keySet: boolean;
  }>({
    url: "",
    key: "",
    urlSet: false,
    keySet: false,
  });

  useEffect(() => {
    async function checkConnection() {
      // ── Step 1: Check env vars are set and not placeholders ──
      const { urlSet, keySet, urlPreview, keyPreview } = checkPublicEnv();

      setEnvDetails({
        url: urlPreview || t("notSet"),
        key: keyPreview || t("notSet"),
        urlSet,
        keySet,
      });

      if (!urlSet || !keySet) {
        setEnvStatus("fail");
        setErrorMessage(
          urlSet
            ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set. Check your .env.local file."
            : keySet
              ? "NEXT_PUBLIC_SUPABASE_URL is not set. Check your .env.local file."
              : "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. Check your .env.local file."
        );
        setConnectionStatus("error");
        return;
      }

      setEnvStatus("ok");

      // ── Step 2: Try connecting to Supabase ──
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from("_test_connection")
          .select("*")
          .limit(1);
        if (error && error.code !== "42P01") {
          if (
            error.message.includes("Invalid API key") ||
            error.message.includes("Invalid input")
          ) {
            throw new Error(`Auth error: ${error.message}`);
          }
        }
        setConnectionStatus("connected");
      } catch (err) {
        setConnectionStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to connect to Supabase"
        );
      }
    }

    checkConnection();
  }, [t]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t("connectionTest")}
      </h2>

      <div className="grid gap-2 sm:grid-cols-2">
        <StatusBadge status={envStatus} label={t("envVariables")} />
        <StatusBadge
          status={
            connectionStatus === "checking"
              ? "pending"
              : connectionStatus === "connected"
                ? "ok"
                : "fail"
          }
          label={
            connectionStatus === "checking"
              ? t("testing")
              : connectionStatus === "connected"
                ? t("connected")
                : t("failed")
          }
        />
      </div>

      {/* ── Detailed results ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t("configDetails")}
        </h3>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Wifi className="h-3.5 w-3.5" />
              SUPABASE_URL
            </span>
            <span className={envDetails.urlSet ? "text-brand-600 dark:text-brand-400" : "text-destructive"}>
              {envDetails.url || t("notSet")}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              PUBLISHABLE_KEY
            </span>
            <span className={envDetails.keySet ? "text-brand-600 dark:text-brand-400" : "text-destructive"}>
              {envDetails.key || t("notSet")}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              DATABASE_URL
            </span>
            <span className="text-muted-foreground">
              {t("serverOnly")}
            </span>
          </div>
        </div>
      </div>

      {/* ── Error message ── */}
      {errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">{t("connectionError")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Success message ── */}
      {connectionStatus === "connected" && !errorMessage && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-950">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
            <div>
              <p className="font-medium text-brand-700 dark:text-brand-300">
                {t("connected")}
              </p>
              <p className="mt-1 text-sm text-brand-600 dark:text-brand-400">
                {t("connectedMessage")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}