const UNLOCALIZED_PATHS = [
  "/auth/callback",
  "/auth/recovery/confirm",
  "/landing",
  "/project-friction-intelligence",
  "/navigator-preview",
] as const;

export function isUnlocalizedPath(pathname: string): boolean {
  return UNLOCALIZED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
