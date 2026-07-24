"use client";

import {
  Bot,
  ChevronDown,
  ChevronRight,
  Crosshair,
  ExternalLink,
  FileSearch,
  FolderOpen,
  Info,
  RotateCcw,
  Workflow,
} from "lucide-react";
import type { ProcessGraphEntity } from "@/lib/pmo-process-intelligence/process-graph.types";

export function ProcessNodeContextMenu({
  locale,
  entity,
  x,
  y,
  expanded,
  onDetails,
  onFocus,
  onToggleExpanded,
  onDrillDown,
  onOpenHref,
  onEvidence,
  onOpenTechnicalEvents,
  onResetPosition,
  onAskIsabella,
  onClose,
}: {
  locale: "en" | "es";
  entity: ProcessGraphEntity;
  x: number;
  y: number;
  expanded: boolean;
  onDetails: () => void;
  onFocus: () => void;
  onToggleExpanded: () => void;
  onDrillDown: () => void;
  onOpenHref: () => void;
  onEvidence: () => void;
  onOpenTechnicalEvents: () => void;
  onResetPosition: () => void;
  onAskIsabella: () => void;
  onClose: () => void;
}) {
  const es = locale === "es";
  return (
    <>
      <button
        type="button"
        aria-label={es ? "Cerrar menú contextual" : "Close context menu"}
        className="absolute inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div
        role="menu"
        className="absolute z-50 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl"
        style={{ left: x, top: y }}
      >
        <MenuAction icon={<Info />} label={es ? "Abrir detalles" : "Open details"} onClick={onDetails} />
        <MenuAction icon={<Crosshair />} label={es ? "Enfocar nodo" : "Focus node"} onClick={onFocus} />
        <MenuAction
          icon={expanded ? <ChevronDown /> : <ChevronRight />}
          label={expanded ? (es ? "Colapsar" : "Collapse") : es ? "Expandir" : "Expand"}
          onClick={onToggleExpanded}
        />
        {entity.kind !== "activity" ? (
          <MenuAction icon={<FolderOpen />} label={es ? "Profundizar" : "Drill down"} onClick={onDrillDown} />
        ) : null}
        {entity.href ? (
          <MenuAction icon={<ExternalLink />} label={es ? "Abrir en el proyecto" : "Open in project"} onClick={onOpenHref} />
        ) : null}
        <MenuAction
          icon={<Workflow />}
          label={es ? "Abrir mapa de procesos" : "Open in process map"}
          onClick={onOpenTechnicalEvents}
        />
        <div className="my-1 h-px bg-slate-200" />
        <MenuAction icon={<FileSearch />} label={es ? "Ver evidencia" : "View evidence"} onClick={onEvidence} />
        <MenuAction icon={<Bot />} label={es ? "Preguntar a Isabella" : "Ask Isabella"} onClick={onAskIsabella} />
        <MenuAction
          icon={<RotateCcw />}
          label={es ? "Restablecer posición" : "Reset node position"}
          onClick={onResetPosition}
        />
      </div>
    </>
  );
}

function MenuAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactElement<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:bg-emerald-50 focus-visible:outline-none"
    >
      {icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      {label}
    </button>
  );
}
