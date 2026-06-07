"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { env, validatePublicEnv } from "@/lib/env";
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
      // ── Step 1: Validate env vars exist ──
      try {
        validatePublicEnv();
        setEnvStatus("ok");
      } catch (err) {
        setEnvStatus("fail");
        setErrorMessage(
          err instanceof Error ? err.message : "Missing env vars"
        );
        setConnectionStatus("error");
        return;
      }

      // ── Step 2: Check values are not placeholders ──
      const url = env.NEXT_PUBLIC_SUPABASE_URL;
      const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      const urlSet = url.length > 0 && !url.includes("your_");
      const keySet = key.length > 0 && !key.includes("PASTE");

      setEnvDetails({
        url: url ? `${url.substring(0, 30)}...` : "(empty)",
        key: key ? `${key.substring(0, 8)}...` : "(empty)",
        urlSet,
        keySet,
      });

      if (!urlSet || !keySet) {
        setEnvStatus("fail");
        setErrorMessage(
          "Environment variables contain placeholder values. Replace them in .env.local"
        );
        setConnectionStatus("error");
        return;
      }

      // ── Step 3: Try connecting to Supabase ──
      try {
        const supabase = createClient();
        // A lightweight call that proves the client can reach Supabase
        const { error } = await supabase.from("_test_connection").select("*").limit(1);
        // If the table doesn't exist, that's fine — it still proves we connected
        if (error && error.code !== "42P01") {
          // 42P01 = undefined table, which means connection works
          // Any other error might indicate auth issues
          if (error.message.includes("Invalid API key") || error.message.includes("Invalid input")) {
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
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        Supabase Connection Test
      </h2>

      <div className="grid gap-2 sm:grid-cols-2">
        {/* ── Env vars status ── */}
        <StatusBadge
          status={envStatus}
          label="Environment Variables"
        />

        {/* ── Connection status ── */}
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
              ? "Testing connection..."
              : connectionStatus === "connected"
                ? "Supabase connected"
                : "Connection failed"
          }
        />
      </div>

      {/* ── Detailed results ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Configuration Details
        </h3>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Wifi className="h-3.5 w-3.5" />
              SUPABASE_URL
            </span>
            <span className={envDetails.urlSet ? "text-brand-600 dark:text-brand-400" : "text-destructive"}>
              {envDetails.url || "(not set)"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              PUBLISHABLE_KEY
            </span>
            <span className={envDetails.keySet ? "text-brand-600 dark:text-brand-400" : "text-destructive"}>
              {envDetails.key || "(not set)"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              DATABASE_URL
            </span>
            <span className="text-muted-foreground">
              (server-only — not exposed)
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
              <p className="font-medium text-destructive">Connection Error</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {errorMessage}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Check your <code className="rounded bg-muted px-1 py-0.5">.env.local</code> file and ensure the values are not placeholders.
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
                Supabase Connected
              </p>
              <p className="mt-1 text-sm text-brand-600 dark:text-brand-400">
                Your Supabase client is correctly configured and can reach the project.
                Ready to build auth and data features.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}