"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Clipboard, Check } from "lucide-react";

export function CopyPromptButton({ prompt }: { prompt: string }) {
  const t = useTranslations("phase0Control.task");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement("textarea");
      textarea.value = prompt;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [prompt]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-brand-500" />
          {t("copied")}
        </>
      ) : (
        <>
          <Clipboard className="h-3.5 w-3.5" />
          {t("copyPrompt")}
        </>
      )}
    </button>
  );
}