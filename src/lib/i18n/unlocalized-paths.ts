const UNLOCALIZED_PATHS = [
  "/auth/callback",
  "/landing",
  // Build identity for PWA auto-update. Without this the locale middleware
  // rewrites it to /<locale>/api/version (404) and the auth guard bounces it to
  // /login, so an installed app could never tell whether it was out of date.
  // Scoped to this one route on purpose: it is public by design (it returns a
  // commit sha and nothing else) and the other /api routes keep whatever
  // handling they have today.
  "/api/version",
  "/navigator-preview",
] as const;

export function isUnlocalizedPath(pathname: string): boolean {
  return UNLOCALIZED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
