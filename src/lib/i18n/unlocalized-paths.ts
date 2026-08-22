const UNLOCALIZED_PATHS = [
  "/auth/callback",
  "/auth/recovery/confirm",
  "/landing",
  "/project-friction-intelligence",
  "/how-to-detect-project-friction",
  "/process-mining-for-pmo",
  "/ai-pmo-portfolio-risk-management",
  "/sap-transformation-project-intelligence",
  "/project-bottleneck-detection-software",
  "/ai-project-blocker-detection",
  "/project-delay-root-cause-analysis",
  "/project-dependency-impact-analysis",
  "/project-rework-detection",
  "/project-execution-intelligence-software",
  "/transformation-management-office-software",
  "/pmo-systemic-bottleneck-analysis",
  "/planned-vs-actual-project-execution",
  "/sap-transformation-bottleneck-detection",
  "/navigator-preview",
] as const;

export function isUnlocalizedPath(pathname: string): boolean {
  return UNLOCALIZED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
