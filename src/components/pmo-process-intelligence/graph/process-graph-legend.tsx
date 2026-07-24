import type { ProcessGraphSemanticZoom } from "@/lib/pmo-process-intelligence/process-graph.types";

export function ProcessGraphLegend({
  locale,
  semanticZoom,
}: {
  locale: "en" | "es";
  semanticZoom: ProcessGraphSemanticZoom;
}) {
  const es = locale === "es";
  return (
    <div className="absolute bottom-3 left-3 z-20 max-w-[calc(100%-96px)] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[10px] text-slate-600 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Legend color="#059669" label={es ? "Flujo principal" : "Primary flow"} />
        <Legend color="#7c3aed" label={es ? "Dependencia" : "Dependency"} dashed />
        <Legend color="#dc2626" label={es ? "Retrabajo/riesgo" : "Rework/risk"} dashed />
        <span className="font-semibold text-slate-800">
          LOD: {semanticZoom}
        </span>
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="block w-6 border-t-2"
        style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }}
      />
      {label}
    </span>
  );
}
