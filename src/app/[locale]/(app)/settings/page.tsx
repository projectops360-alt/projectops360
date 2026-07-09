import { setRequestLocale } from "next-intl/server";
import { Palette, Languages, SlidersHorizontal, Building2 } from "lucide-react";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue, type Locale } from "@/types/database";
import { ThemeControl } from "@/components/settings/theme-control";
import { LanguageControl } from "@/components/settings/language-control";
import { OrganizationNameForm } from "@/components/settings/organization-name-form";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getOrgContext();

  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);

  const canRenameOrg = ctx.role === "owner" || ctx.role === "admin";
  const orgName =
    getI18nValue(ctx.organizationName, locale as Locale) || ctx.organizationSlug;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 py-2">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
          <SlidersHorizontal className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tt("Settings", "Configuración")}</h1>
          <p className="text-sm text-muted-foreground">
            {tt("Personalize how ProjectOps360° looks and the language you work in.", "Personaliza cómo se ve ProjectOps360° y el idioma con el que trabajas.")}
          </p>
        </div>
      </header>

      {/* Organization */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {tt("Organization", "Organización")}
          </h2>
        </div>
        <div className="mt-4 space-y-3">
          {canRenameOrg ? (
            <>
              <p className="text-xs text-muted-foreground">
                {tt(
                  "This name identifies your company across the whole app.",
                  "Este nombre identifica a tu empresa en toda la aplicación.",
                )}
              </p>
              <OrganizationNameForm
                initialName={orgName}
                labels={{
                  nameLabel: tt("Organization name", "Nombre de la organización"),
                  save: tt("Save name", "Guardar nombre"),
                  saved: tt("Organization name updated.", "Nombre de la organización actualizado."),
                  errorInvalid: tt(
                    "The name must be between 2 and 120 characters.",
                    "El nombre debe tener entre 2 y 120 caracteres.",
                  ),
                  errorDenied: tt(
                    "Only organization owners or admins can rename it.",
                    "Solo los propietarios o administradores de la organización pueden renombrarla.",
                  ),
                  errorGeneric: tt(
                    "Could not save the name. Please try again.",
                    "No se pudo guardar el nombre. Inténtalo de nuevo.",
                  ),
                }}
              />
            </>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground">{orgName}</p>
              <p className="text-xs text-muted-foreground">
                {tt(
                  "Only organization owners or admins can rename it.",
                  "Solo los propietarios o administradores de la organización pueden renombrarla.",
                )}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Appearance */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {tt("Appearance", "Apariencia")}
          </h2>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{tt("Theme", "Tema")}</p>
            <p className="text-xs text-muted-foreground">
              {tt("Choose light, dark, or follow your system.", "Elige claro, oscuro o seguir el sistema.")}
            </p>
          </div>
          <ThemeControl
            labels={{
              light: tt("Light", "Claro"),
              dark: tt("Dark", "Oscuro"),
              system: tt("System", "Sistema"),
            }}
          />
        </div>
      </section>

      {/* Language */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {tt("Language", "Idioma")}
          </h2>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{tt("Interface language", "Idioma de la interfaz")}</p>
            <p className="text-xs text-muted-foreground">
              {tt("The whole app reloads in the selected language.", "Toda la aplicación se recarga en el idioma seleccionado.")}
            </p>
          </div>
          <LanguageControl />
        </div>
      </section>
    </div>
  );
}
