"use client";

// ============================================================================
// <AcronymPanel /> — the full definition (CAP-050)
// ============================================================================
// Built on `ModalDialog` from the simulation module rather than on a new
// overlay. That component already solved Escape-to-close, the focus trap and
// returning focus to the trigger; a second implementation would be a fourth
// partial one in this repo's history of exactly that mistake.
//
// Ordering is deliberate. Definition, then formula, then interpretation, then
// CAVEATS — before the example and well before the source. The caveats are the
// part that prevents the misreading ("SV is money, not days"), so they are not
// filed at the bottom as a footnote where a reader who got their answer in the
// first paragraph will never scroll to them.
// ============================================================================

import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, MessageCircleQuestion } from "lucide-react";
import { ModalDialog } from "@/components/pmo-simulation/modal-dialog";
import type { AcronymContext } from "@/lib/acronyms/contracts";
import { buildPanelModel } from "@/lib/acronyms/presentation";
import { askIsabellaAboutAcronym } from "@/lib/acronyms/isabella-bridge";
import { localize } from "@/lib/acronyms/registry";

export function AcronymPanel({
  code,
  context,
  open,
  onClose,
}: {
  code: string;
  context?: AcronymContext | null;
  open: boolean;
  onClose: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("acronyms");
  const model = buildPanelModel(code, locale, context);

  if (!model) return null;

  const { formula, scenario } = model;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={`${model.code} — ${model.fullName}`}
      description={model.shortDefinition}
      closeLabel={t("close")}
      widthClassName="max-w-2xl"
      footer={
        <button
          type="button"
          onClick={() => {
            askIsabellaAboutAcronym(code, locale, t("isabellaQuestion", { code }), context);
            onClose();
          }}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden />
          {t("askIsabella")}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <Section label={t("category")}>
          <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
            {t(`category_${model.category}`)}
          </span>
        </Section>

        <Section label={t("definition")}>
          <p className="text-xs leading-relaxed text-slate-700">{model.fullDefinition}</p>
        </Section>

        {formula.used ? (
          <Section label={t("formula")}>
            {/* Plain monospace text, no KaTeX. "EAC = AC + (BAC − EV) / CPI"
                needs no typesetting engine to be unambiguous. */}
            <p className="rounded-md bg-slate-50 px-2.5 py-2 font-mono text-xs font-semibold text-slate-800">
              {formula.used.expression}
            </p>
            {formula.used.label ? (
              <p className="mt-1 text-[11px] text-slate-500">
                {localize(formula.used.label, locale)}
              </p>
            ) : null}
            {/* Whether the engine told us which variant it used, or we are
                showing the default, is a materially different claim. */}
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {formula.isConfirmed ? t("formulaUsedByEngine") : t("formulaDefaultVariant")}
            </p>

            {formula.alternatives.length > 0 ? (
              <div className="mt-2 rounded-md border border-slate-200 p-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {t("alternativeFormulas")}
                </p>
                <ul className="mt-1 space-y-1.5">
                  {formula.alternatives.map((alternative) => (
                    <li key={alternative.id}>
                      <p className="font-mono text-[11px] text-slate-700">
                        {alternative.expression}
                      </p>
                      {alternative.label ? (
                        <p className="text-[10px] leading-snug text-slate-500">
                          {localize(alternative.label, locale)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>
        ) : null}

        {model.variables.length > 0 ? (
          <Section label={t("variables")}>
            <dl className="grid gap-1">
              {model.variables.map((variable) => (
                <div key={variable.symbol} className="flex gap-2 text-[11px]">
                  <dt className="min-w-[4.5rem] shrink-0 font-mono font-bold text-slate-700">
                    {variable.symbol}
                  </dt>
                  <dd className="text-slate-600">{variable.meaning}</dd>
                </div>
              ))}
            </dl>
          </Section>
        ) : null}

        <div className="flex flex-wrap gap-4">
          {model.unitKey ? (
            <Section label={t("unit")}>
              <p className="text-xs font-semibold text-slate-700">{t(model.unitKey)}</p>
            </Section>
          ) : null}
          {model.directionKey ? (
            <Section label={t("favorableDirection")}>
              <p className="text-xs font-semibold text-slate-700">{t(model.directionKey)}</p>
            </Section>
          ) : null}
        </div>

        {model.interpretation ? (
          <Section label={t("interpretation")}>
            <p className="text-xs leading-relaxed text-slate-700">{model.interpretation}</p>
          </Section>
        ) : null}

        {/* Above the example, on purpose. */}
        {model.caveats.length > 0 ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <h3 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {t("caveats")}
            </h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              {model.caveats.map((caveat) => (
                <li key={caveat} className="text-[11px] leading-snug text-amber-900">
                  {caveat}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {scenario ? <ScenarioSection model={scenario} /> : null}

        {model.example ? (
          <Section label={t("example")}>
            {/* Invented round numbers only — never this project's data, which
                would read as a claim about the project rather than a worked
                illustration of the arithmetic. */}
            <p className="text-[11px] leading-relaxed text-slate-600">{model.example}</p>
            <p className="mt-1 text-[10px] italic text-slate-400">{t("exampleIsIllustrative")}</p>
          </Section>
        ) : null}

        {model.related.length > 0 ? (
          <Section label={t("relatedTerms")}>
            <ul className="flex flex-wrap gap-1.5">
              {model.related.map((related) => (
                <li
                  key={related.code}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                  title={related.fullName}
                >
                  {related.code}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <p className="border-t border-slate-100 pt-2 text-[10px] text-slate-400">
          {model.source ? `${t("source")}: ${model.source} · ` : null}
          {t("version")} {model.version}
        </p>
      </div>
    </ModalDialog>
  );
}

/**
 * "In this scenario". Rendered only when a caller supplied context, and every
 * absent number reads "Data unavailable" rather than 0 — the same rule the
 * simulation results table follows, for the same reason.
 */
function ScenarioSection({
  model,
}: {
  model: NonNullable<ReturnType<typeof buildPanelModel>>["scenario"];
}) {
  const t = useTranslations("acronyms");
  if (!model) return null;

  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-blue-900">
        {t("inThisScenario")}
      </h3>

      <dl className="mt-2 grid grid-cols-3 gap-2">
        <ContextFigure label={t("scenarioBaseline")} value={model.baseline} />
        <ContextFigure label={t("scenarioSimulated")} value={model.simulated} />
        <ContextFigure label={t("scenarioDelta")} value={model.delta} />
      </dl>

      {model.inputs.length > 0 ? (
        <div className="mt-2.5 border-t border-blue-200 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800">
            {t("scenarioInputs")}
          </p>
          <ul className="mt-1 space-y-0.5">
            {model.inputs.map((input) => (
              <li key={input.label} className="flex flex-wrap gap-1.5 text-[11px] text-blue-900">
                <span className="font-semibold">{input.label}:</span>
                <span className="tabular-nums">
                  {input.value.display ?? (
                    <span className="italic text-blue-700">{t("dataUnavailable")}</span>
                  )}
                </span>
                {input.provenanceKey ? (
                  <span className="rounded bg-blue-100 px-1 text-[9px] font-bold uppercase text-blue-700">
                    {t(input.provenanceKey)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-blue-200 pt-2 text-[10px] text-blue-800">
        {model.provenanceKey ? (
          <li>
            <span className="font-bold uppercase tracking-wide">{t("provenance")}:</span>{" "}
            {t(model.provenanceKey)}
          </li>
        ) : null}
        {model.engine ? (
          <li>
            <span className="font-bold uppercase tracking-wide">{t("engine")}:</span> {model.engine}
          </li>
        ) : null}
        {model.confidence ? (
          <li>
            <span className="font-bold uppercase tracking-wide">{t("confidence")}:</span>{" "}
            {t(`confidence_${model.confidence}`)}
          </li>
        ) : null}
        {model.computedAt ? (
          <li>
            <span className="font-bold uppercase tracking-wide">{t("computedAt")}:</span>{" "}
            {model.computedAt}
          </li>
        ) : null}
      </ul>

      {model.dataCoverage && model.dataCoverage.unavailable.length > 0 ? (
        <p className="mt-1.5 text-[10px] text-blue-800">
          <span className="font-bold uppercase tracking-wide">{t("dataCoverage")}:</span>{" "}
          {t("sourcesUnavailable")} {model.dataCoverage.unavailable.join(", ")}
        </p>
      ) : null}
    </section>
  );
}

function ContextFigure({
  label,
  value,
}: {
  label: string;
  value: { display: string | null; available: boolean };
}) {
  const t = useTranslations("acronyms");
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-blue-700">{label}</dt>
      <dd className="mt-0.5 text-xs font-extrabold tabular-nums text-blue-950">
        {value.display ?? (
          <span className="text-[11px] font-semibold italic text-blue-700">
            {t("dataUnavailable")}
          </span>
        )}
      </dd>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}
