"use client";

// ============================================================================
// External Contacts — vendors, clients, inspectors, consultants, sponsors…
// People without a full login. NOT automatically billable.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Contact, Plus, Loader2, Trash2, Mail, Phone, Building } from "lucide-react";
import { CONTACT_TYPES, labelOf } from "@/lib/team-roles/config";
import { createContactAction, deleteContactAction } from "./actions";

type Row = Record<string, unknown>;
const inp = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export function ContactsClient({ locale, contacts }: { locale: string; contacts: Row[] }) {
  const isEs = locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const empty = { name: "", email: "", companyName: "", contactType: "client", phone: "" };
  const [f, setF] = useState(empty);

  const add = () => { if (!f.name.trim()) return; start(async () => { await createContactAction(f); setF(empty); router.refresh(); }); };
  const del = (id: string) => start(async () => { await deleteContactAction({ id }); router.refresh(); });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400"><Contact className="h-4 w-4" />{isEs ? "Contactos externos" : "External contacts"}</div>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{isEs ? "Contactos externos" : "External contacts"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{isEs ? "Proveedores, clientes, inspectores, consultores y patrocinadores sin login completo. No consumen asiento facturable." : "Vendors, clients, inspectors, consultants and sponsors without a full login. They don't consume a billable seat."}</p>
      </div>

      <div className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6">
        <input className={`${inp} lg:col-span-2`} placeholder={isEs ? "Nombre" : "Name"} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={inp} placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className={inp} placeholder={isEs ? "Empresa" : "Company"} value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} />
        <select className={inp} value={f.contactType} onChange={(e) => setF({ ...f, contactType: e.target.value })}>{CONTACT_TYPES.map((t) => <option key={t.value} value={t.value}>{isEs ? t.es : t.en}</option>)}</select>
        <button onClick={add} disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{isEs ? "Agregar" : "Add"}</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2 text-left">{isEs ? "Nombre" : "Name"}</th><th className="px-3 py-2 text-left">{isEs ? "Tipo" : "Type"}</th><th className="px-3 py-2 text-left">{isEs ? "Empresa" : "Company"}</th><th className="px-3 py-2 text-left">{isEs ? "Contacto" : "Contact"}</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={String(c.id)} className="border-t border-border/50">
                <td className="px-3 py-2 font-medium text-foreground">{String(c.name)}</td>
                <td className="px-3 py-2 text-muted-foreground">{labelOf(CONTACT_TYPES, String(c.contact_type), isEs)}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.company_name ? <span className="inline-flex items-center gap-1"><Building className="h-3 w-3" />{String(c.company_name)}</span> : "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  <div className="flex flex-col gap-0.5 text-[11px]">
                    {c.email ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{String(c.email)}</span> : null}
                    {c.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{String(c.phone)}</span> : null}
                    {!c.email && !c.phone ? "—" : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-right"><button onClick={() => del(String(c.id))} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {contacts.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">{isEs ? "Sin contactos externos." : "No external contacts yet."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
