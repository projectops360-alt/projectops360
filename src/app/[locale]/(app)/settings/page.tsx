import { setRequestLocale } from "next-intl/server";
import { Palette, Languages, SlidersHorizontal } from "lucide-react";
import { getOrgContext } from "@/lib/auth";
import { ThemeControl } from "@/components/settings/theme-control";
import { LanguageControl } from "@/components/settings/language-control";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await getOrgContext();

  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);

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
