"use client";

// ============================================================================
// Project Charter — printable / PDF document (client approval & signature).
// Print CSS in globals.css isolates #charter-report-print.
// ============================================================================

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Download, ArrowLeft } from "lucide-react";
import { CHARTER_SECTIONS, CHARTER_STATUS_META, type CharterStatus } from "@/lib/charter/fields";
import { printWithFilename, shortId } from "@/lib/print-document";

interface Props {
  locale: string;
  projectId: string;
  projectName: string;
  charter: Record<string, unknown>;
  roles: Record<string, unknown>[];
  rules: Record<string, unknown>[];
  approvals: Record<string, unknown>[];
  signoffs: Record<string, unknown>[];
}

export function CharterPrintClient({ locale, projectId, projectName, charter, roles, rules, approvals, signoffs }: Props) {
  const isEs = locale === "es";
  const today = new Date().toLocaleDateString(isEs ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const status = (charter.status as CharterStatus) ?? "draft";
  const meta = CHARTER_STATUS_META[status];
  const v = (k: string) => { const x = charter[k]; return x && String(x).trim() ? String(x) : null; };
  // Folio / acta number — deterministic from the charter id + version.
  // Canonical document code (CHR) so the on-page folio matches the PDF filename.
  const version = (charter.version as number) ?? 1;
  const folio = `CHR-${shortId(charter.id as string)}-V${version}`;
  const fileName = `Pops360-Charter-${folio}`;

  // Signature blocks: any defined sponsor/PM/steering roles + a client line.
  const sigRoles = [
    { role: isEs ? "Patrocinador del proyecto" : "Project Sponsor", match: ["sponsor", "patrocinador"] },
    { role: isEs ? "Gerente de proyecto" : "Project Manager", match: ["project manager", "gerente"] },
    { role: isEs ? "Comité Directivo" : "Steering Committee", match: ["steering", "comité", "comite"] },
  ];
  const roleName = (matches: string[]) => {
    const r = roles.find((x) => matches.some((m) => String(x.role_name ?? "").toLowerCase().includes(m)));
    return r ? String(r.person_name || r.external_contact_name || "") : "";
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/projects/${projectId}/charter`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />{isEs ? "Volver al Charter" : "Back to Charter"}
        </Link>
        <button type="button" onClick={() => printWithFilename(fileName)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
          <Download className="h-4 w-4" />{isEs ? "Descargar PDF" : "Download PDF"}
        </button>
      </div>

      <div id="charter-report-print" className="space-y-6 rounded-2xl border border-border bg-card p-8 print:border-0 print:shadow-none">
        {/* Header */}
        <header className="border-b border-border pb-5">
          <Image src="/logo-report.png" alt="Project Ops 360°" width={358} height={473} className="mb-4 h-32 w-auto" priority />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">{isEs ? "Acta de Constitución del Proyecto (Project Charter)" : "Project Charter"}</p>
              <h1 className="text-2xl font-bold text-foreground">{projectName}</h1>
            </div>
            <div className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-right">
              <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{isEs ? "Folio" : "Folio"}</p>
              <p className="font-mono text-xs font-bold text-foreground">{folio}</p>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
            <span>{today}</span>
            <span>{isEs ? "Versión" : "Version"} {(charter.version as number) ?? 1}</span>
            <span>{isEs ? "Estado" : "Status"}: {isEs ? meta.es : meta.en}</span>
          </div>
        </header>

        {/* Text sections */}
        {CHARTER_SECTIONS.map((section) => {
          const filled = section.fields.filter((f) => v(f.key));
          if (filled.length === 0) return null;
          return (
            <section key={section.key} className="break-inside-avoid">
              <h2 className="mb-2 border-b border-border/60 pb-1 text-sm font-bold uppercase tracking-wide text-brand-700 dark:text-brand-400">{isEs ? section.es : section.en}</h2>
              <dl className="space-y-2">
                {filled.map((f) => (
                  <div key={f.key}>
                    <dt className="text-xs font-semibold text-muted-foreground">{isEs ? f.es : f.en}</dt>
                    <dd className="whitespace-pre-line text-sm text-foreground">{v(f.key)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}

        {/* Roles */}
        {roles.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="mb-2 border-b border-border/60 pb-1 text-sm font-bold uppercase tracking-wide text-brand-700 dark:text-brand-400">{isEs ? "Roles y Responsabilidades" : "Roles & Responsibilities"}</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1 pr-3">{isEs ? "Rol" : "Role"}</th><th className="py-1 pr-3">{isEs ? "Persona" : "Person"}</th><th className="py-1">{isEs ? "Responsabilidad" : "Responsibility"}</th></tr></thead>
              <tbody>
                {roles.map((r, i) => (
                  <tr key={i} className="border-t border-border/40 align-top">
                    <td className="py-1.5 pr-3 font-medium text-foreground">{String(r.role_name ?? "—")}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{String(r.person_name || r.external_contact_name || "—")}</td>
                    <td className="py-1.5 text-muted-foreground">{String(r.responsibility ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Approval matrix */}
        {approvals.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="mb-2 border-b border-border/60 pb-1 text-sm font-bold uppercase tracking-wide text-brand-700 dark:text-brand-400">{isEs ? "Matriz de Aprobación" : "Approval Matrix"}</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1 pr-3">{isEs ? "Área" : "Area"}</th><th className="py-1 pr-3">{isEs ? "Aprueba" : "Approved by"}</th><th className="py-1">{isEs ? "Umbral / Respuesta" : "Threshold / Response"}</th></tr></thead>
              <tbody>
                {approvals.map((r, i) => (
                  <tr key={i} className="border-t border-border/40 align-top">
                    <td className="py-1.5 pr-3 font-medium text-foreground">{String(r.approval_area ?? "—")}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{String(r.approval_required_from ?? "—")}</td>
                    <td className="py-1.5 text-muted-foreground">{[r.threshold_value, r.required_response_time].filter(Boolean).map(String).join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Governance rules */}
        {rules.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="mb-2 border-b border-border/60 pb-1 text-sm font-bold uppercase tracking-wide text-brand-700 dark:text-brand-400">{isEs ? "Reglas de Gobernanza" : "Governance Rules"}</h2>
            <ul className="space-y-1 text-sm">
              {rules.map((r, i) => (
                <li key={i} className="flex gap-2"><span className="font-medium text-foreground">{String(r.rule_type ?? "")}:</span><span className="text-muted-foreground">{String(r.rule_name ?? "")}{r.description ? ` — ${String(r.description)}` : ""}</span></li>
              ))}
            </ul>
          </section>
        )}

        {/* Approval notes */}
        {v("approval_notes") && (
          <section className="break-inside-avoid">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-brand-700 dark:text-brand-400">{isEs ? "Notas de aprobación" : "Approval notes"}</h2>
            <p className="text-sm text-foreground">{v("approval_notes")}</p>
          </section>
        )}

        {/* Signature blocks */}
        <section className="break-inside-avoid border-t border-border pt-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-foreground">{isEs ? "Aprobación y Firmas" : "Approval & Sign-Off"}</h2>
          <p className="mb-5 text-xs text-muted-foreground">
            {isEs
              ? "Al firmar, las partes aprueban el alcance, los objetivos, los entregables y las reglas de gobernanza definidos en este Acta de Constitución del Proyecto."
              : "By signing, the parties approve the scope, objectives, deliverables and governance rules defined in this Project Charter."}
          </p>
          <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
            {sigRoles.map((s, i) => (
              <SignatureBlock key={i} role={s.role} name={roleName(s.match)} isEs={isEs} />
            ))}
            <SignatureBlock role={isEs ? "Aprobación del Cliente" : "Client Approval"} name="" isEs={isEs} />
          </div>

          {signoffs.filter((s) => s.status !== "pending").length > 0 && (
            <p className="mt-6 text-[11px] text-muted-foreground">
              {isEs ? "Firmas registradas en el sistema: " : "Sign-offs recorded in the system: "}
              {signoffs.filter((s) => s.status !== "pending").map((s) => `${String(s.signer_role)} (${String(s.status)})`).join(", ")}
            </p>
          )}
        </section>

        {/* Repeating print footer (folio + generation date on every page) */}
        <div className="charter-print-footer hidden print:block">
          {folio} · ProjectOps360° · {isEs ? "Generado" : "Generated"}: {today}
        </div>
      </div>
    </div>
  );
}

function SignatureBlock({ role, name, isEs }: { role: string; name: string; isEs: boolean }) {
  return (
    <div>
      <div className="h-10 border-b border-foreground/40" />
      <p className="mt-1 text-xs font-semibold text-foreground">{role}</p>
      <p className="text-xs text-muted-foreground">{name || (isEs ? "Nombre: ____________________" : "Name: ____________________")}</p>
      <p className="mt-3 text-xs text-muted-foreground">{isEs ? "Fecha: ______________" : "Date: ______________"}</p>
    </div>
  );
}
