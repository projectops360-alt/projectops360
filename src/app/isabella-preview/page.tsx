"use client";

// TEMPORARY preview route to visually verify the IsabellaCompanion hologram
// (port of the validated isabella-holograma-prototipo.html). Replicates the
// prototype's demo dashboard so every `focus` id the demo brain emits exists
// on the page. NOT part of the shipped feature — deleted after verification.

import type { CSSProperties } from "react";
import { IsabellaCompanion } from "@/components/isabella/companion";

const palette = {
  bg: "#0E1220",
  panel: "#161C2E",
  panel2: "#1C2338",
  line: "#262E48",
  text: "#E9EDF9",
  muted: "#8A93AD",
  holoA: "#9BE8FF",
  holoB: "#B79CFF",
  warn: "#FFB454",
  ok: "#6FE3B4",
  danger: "#FF7A7A",
};

const card: CSSProperties = {
  background: palette.panel,
  border: `1px solid ${palette.line}`,
  borderRadius: 14,
  padding: 18,
};

const kpi: CSSProperties = { ...card, padding: "16px 18px" };

const kpiLabel: CSSProperties = {
  color: palette.muted,
  fontSize: 11.5,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 8,
};

const kpiValue: CSSProperties = { fontSize: 24, fontWeight: 600 };

const msRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 4px",
  borderBottom: `1px solid ${palette.line}`,
};

const nodeStyle: CSSProperties = {
  fontSize: 11.5,
  padding: "7px 11px",
  borderRadius: 9,
  border: `1px solid ${palette.line}`,
  background: palette.panel2,
  whiteSpace: "nowrap",
  transition: "all .4s",
};

const critNode: CSSProperties = {
  ...nodeStyle,
  borderColor: "rgba(255,122,122,.5)",
  color: "#FFB3B3",
};

const edge: CSSProperties = { width: 26, height: 1, background: palette.line };

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }}
    />
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <span
      style={{
        height: 5,
        borderRadius: 99,
        background: palette.panel2,
        width: 90,
        overflow: "hidden",
        display: "inline-block",
      }}
    >
      <i
        style={{
          display: "block",
          height: "100%",
          width: `${pct}%`,
          borderRadius: 99,
          background: `linear-gradient(90deg, ${palette.holoA}, ${palette.holoB})`,
        }}
      />
    </span>
  );
}

function Risk({
  id,
  sev,
  title,
  desc,
}: {
  id?: string;
  sev: string;
  title: string;
  desc: string;
}) {
  return (
    <div
      id={id}
      style={{
        border: `1px solid ${palette.line}`,
        borderRadius: 11,
        padding: "12px 14px",
        marginBottom: 10,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        background: palette.panel2,
        transition: "box-shadow .4s, border-color .4s, transform .4s",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          marginTop: 6,
          flexShrink: 0,
          background: sev,
        }}
      />
      <div>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 3 }}>{title}</div>
        <div style={{ color: palette.muted, fontSize: 12.5, lineHeight: 1.45 }}>{desc}</div>
      </div>
    </div>
  );
}

export default function IsabellaPreviewPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: palette.bg,
        color: palette.text,
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
        padding: "26px 30px",
      }}
    >
      <div style={{ color: palette.muted, fontSize: 12, marginBottom: 6 }}>
        Portafolio / Migración CRM · Isabella preview (harness temporal)
      </div>
      <div
        style={{
          fontSize: 21,
          fontWeight: 600,
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        Migración CRM · Fase 2
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 9px",
            borderRadius: 99,
            background: "rgba(111,227,180,.12)",
            color: palette.ok,
            border: "1px solid rgba(111,227,180,.25)",
          }}
        >
          En curso
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 22,
          maxWidth: 1100,
        }}
      >
        <div id="kpi-avance" style={kpi}>
          <div style={kpiLabel}>Avance</div>
          <div style={kpiValue}>
            64<small style={{ fontSize: 13, color: palette.muted, fontWeight: 400 }}>%</small>
          </div>
        </div>
        <div style={kpi}>
          <div style={kpiLabel}>Riesgos activos</div>
          <div style={{ ...kpiValue, color: palette.warn }}>5</div>
        </div>
        <div id="kpi-dec" style={kpi}>
          <div style={kpiLabel}>Decisiones pendientes</div>
          <div style={kpiValue}>2</div>
        </div>
        <div style={kpi}>
          <div style={kpiLabel}>Fin estimado</div>
          <div style={kpiValue}>
            28 <small style={{ fontSize: 13, color: palette.muted, fontWeight: 400 }}>Ago</small>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.25fr .95fr",
          gap: 14,
          alignItems: "start",
          maxWidth: 1100,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div id="card-milestones" style={card}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              Milestones{" "}
              <span style={{ fontSize: 11, color: palette.muted, fontWeight: 400 }}>Q3 2026</span>
            </h3>
            <div style={msRow}>
              <Dot color={palette.ok} />
              <span style={{ flex: 1 }}>Auditoría de datos legados</span>
              <span style={{ color: palette.muted, fontSize: 12 }}>Completado</span>
              <Bar pct={100} />
            </div>
            <div style={msRow}>
              <Dot color={palette.holoA} />
              <span style={{ flex: 1 }}>Integración de pagos</span>
              <span style={{ color: palette.muted, fontSize: 12 }}>12 Jul</span>
              <Bar pct={45} />
            </div>
            <div style={msRow}>
              <Dot color={palette.holoA} />
              <span style={{ flex: 1 }}>Migración de cuentas enterprise</span>
              <span style={{ color: palette.muted, fontSize: 12 }}>02 Ago</span>
              <Bar pct={20} />
            </div>
            <div style={{ ...msRow, borderBottom: "none" }}>
              <Dot color={palette.muted} />
              <span style={{ flex: 1 }}>Capacitación de equipos</span>
              <span style={{ color: palette.muted, fontSize: 12 }}>18 Ago</span>
              <Bar pct={0} />
            </div>
          </div>

          <div id="card-path" style={card}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              Camino crítico{" "}
              <span style={{ fontSize: 11, color: palette.muted, fontWeight: 400 }}>
                Vista simplificada
              </span>
            </h3>
            <div style={{ display: "flex", alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
              <div style={nodeStyle}>Auditoría</div>
              <div style={edge} />
              <div style={critNode}>Integración pagos</div>
              <div style={edge} />
              <div style={critNode}>Migración enterprise</div>
              <div style={edge} />
              <div style={nodeStyle}>Go-live</div>
            </div>
          </div>
        </div>

        <div style={card}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            Riesgos{" "}
            <span style={{ fontSize: 11, color: palette.muted, fontWeight: 400 }}>5 activos</span>
          </h3>
          <Risk
            sev={palette.danger}
            title="Rotación en equipo de datos"
            desc="Dos analistas senior salen del proyecto la próxima semana."
          />
          <Risk
            id="risk-target"
            sev={palette.warn}
            title="API de pagos sin credenciales de producción"
            desc="El proveedor no ha entregado accesos. Bloquea la integración de pagos desde hace 12 días."
          />
          <Risk
            sev={palette.warn}
            title="Ambigüedad en el alcance de reportes"
            desc="El patrocinador no ha validado los reportes ejecutivos requeridos."
          />
        </div>
      </div>

      <IsabellaCompanion debug proactiveDemo contextLabel="Migración CRM, Fase 2" />
    </div>
  );
}
