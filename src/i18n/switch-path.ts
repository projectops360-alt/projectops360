// ============================================================================
// ProjectOps360° — Locale switch path builder
// ============================================================================
// Pure helper that turns the current browser path into the equivalent path
// for another locale, honoring `localePrefix: "as-needed"` (the default
// locale has no prefix). Used by the language switcher so switching never
// produces a double prefix (e.g. /en/es/...) or a missing one.
// ============================================================================

export function buildLocaleSwitchPath(
  currentPathname: string,
  newLocale: string,
  locales: readonly string[],
  defaultLocale: string,
): string {
  // Strip any existing leading locale segment: "/es/projects/x" → "/projects/x"
  const localePattern = new RegExp(`^/(${locales.join("|")})(?=/|$)`);
  const bare = currentPathname.replace(localePattern, "") || "/";

  // Default locale is served without a prefix (as-needed).
  if (newLocale === defaultLocale) return bare;

  // Non-default locale gets the prefix; avoid a trailing slash for the root.
  return bare === "/" ? `/${newLocale}` : `/${newLocale}${bare}`;
}
