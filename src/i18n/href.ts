import { routing } from "./routing";

/**
 * Build a canonical app href for the given locale under `localePrefix: "as-needed"`.
 * The default locale is served WITHOUT a prefix, so emitting `/en/...` produces
 * a redirect that breaks client navigation. Pass a bare path (starting with "/")
 * and this returns the correct canonical URL.
 */
export function localizedHref(locale: string, path: string): string {
  const clean = path.startsWith("/") || path === "" ? path : `/${path}`;
  if (locale === routing.defaultLocale) return clean || "/";
  return clean ? `/${locale}${clean}` : `/${locale}`;
}
