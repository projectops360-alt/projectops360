const UNLOCALIZED_PATHS = [
  "/auth/callback",
  "/auth/recovery/confirm",
  "/landing",
  "/project-friction-intelligence",
  "/how-to-detect-project-friction",
  "/process-mining-for-pmo",
  "/ai-pmo-portfolio-risk-management",
  "/navigator-preview",
] as const;

export function isUnlocalizedPath(pathname: string): boolean {
  return UNLOCALIZED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
