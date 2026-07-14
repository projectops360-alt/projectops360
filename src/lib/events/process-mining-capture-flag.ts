export function isProcessMiningEventCaptureEnabledFor(
  projectId: string,
  rawEnvValue: string | undefined | null,
): boolean {
  const raw = (rawEnvValue ?? "").trim();
  if (!raw || !projectId) return false;
  if (raw === "all") return true;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(projectId);
}

export function isProcessMiningEventCaptureEnabled(projectId: string): boolean {
  return isProcessMiningEventCaptureEnabledFor(
    projectId,
    process.env.PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS,
  );
}
