// ============================================================================
// ProjectOps360° — Project Intelligence Engine · Root Cause Miner Engine
// ============================================================================
// CAP-046 / PD-019 — Feature 2. Pure + deterministic statistics: for each
// problem type (delay, blockage, rework) and each STRUCTURAL dimension value,
// builds the 2×2 contingency (group vs rest × problem vs no problem) and
// derives lift, phi association, and coverage into an Influence Score (0–100)
// gated by sample size. Findings report only ADVERSE associations (lift > 1)
// as evidence — never recommendations, never causal claims, never persons
// (PO-10). Small samples are reported with low confidence, never hidden as
// certainty.
// ============================================================================

import type {
  RootCauseDimension,
  RootCauseFinding,
  RootCauseMinerResult,
  RootCauseProblemStats,
  RootCauseProblemType,
  RootCauseTaskInput,
} from "./types";

/** Minimum group size to report anything at all. */
const MIN_GROUP_SIZE = 3;
/** Max findings kept per problem type (highest influence first). */
const MAX_FINDINGS_PER_PROBLEM = 5;

const PROBLEM_TYPES: RootCauseProblemType[] = ["delay", "blockage", "rework"];

function hasProblem(task: RootCauseTaskInput, problem: RootCauseProblemType): boolean {
  if (problem === "delay") return task.isDelayed;
  if (problem === "blockage") return task.isBlocked;
  return task.reworkCount > 0;
}

interface DimensionValue {
  dimension: RootCauseDimension;
  value: string;
  label: string;
}

/** Structural dimension extraction — a task with a null attribute simply does
 *  not participate in that dimension (no "unknown" noise buckets). Ownership
 *  is the one binary structural dimension (assigned vs unassigned). */
function dimensionValuesOf(task: RootCauseTaskInput): DimensionValue[] {
  const values: DimensionValue[] = [
    {
      dimension: "ownership",
      value: task.hasOwner ? "assigned" : "unassigned",
      label: task.hasOwner ? "assigned" : "unassigned",
    },
    { dimension: "priority", value: task.priority, label: task.priority.toUpperCase() },
    {
      dimension: "criticality",
      value: task.isCritical ? "critical_path" : "non_critical",
      label: task.isCritical ? "critical path" : "non-critical",
    },
  ];
  if (task.milestoneId) {
    values.push({
      dimension: "milestone",
      value: task.milestoneId,
      label: task.milestoneLabel ?? task.milestoneId,
    });
  }
  if (task.discipline) values.push({ dimension: "discipline", value: task.discipline, label: task.discipline });
  if (task.trade) values.push({ dimension: "trade", value: task.trade, label: task.trade });
  if (task.location) values.push({ dimension: "location", value: task.location, label: task.location });
  return values;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Phi coefficient of a 2×2 contingency table; 0 when any margin is empty. */
export function phiCoefficient(a: number, b: number, c: number, d: number): number {
  const denom = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  if (denom === 0) return 0;
  return (a * d - b * c) / denom;
}

const PROBLEM_LABELS: Record<RootCauseProblemType, { es: string; en: string }> = {
  delay: { es: "retraso", en: "delay" },
  blockage: { es: "bloqueo", en: "blockage" },
  rework: { es: "retrabajo", en: "rework" },
};

const DIMENSION_LABELS: Record<RootCauseDimension, { es: string; en: string }> = {
  milestone: { es: "hito", en: "milestone" },
  priority: { es: "prioridad", en: "priority" },
  ownership: { es: "asignación", en: "assignment" },
  criticality: { es: "criticidad", en: "criticality" },
  discipline: { es: "disciplina", en: "discipline" },
  trade: { es: "oficio", en: "trade" },
  location: { es: "zona", en: "location" },
};

function valueLabel(dimension: RootCauseDimension, label: string, lang: "es" | "en"): string {
  if (dimension === "ownership") {
    if (label === "unassigned") return lang === "es" ? "sin asignar" : "unassigned";
    return lang === "es" ? "asignadas" : "assigned";
  }
  if (dimension === "criticality") {
    if (label === "critical path") return lang === "es" ? "ruta crítica" : "critical path";
    return lang === "es" ? "fuera de ruta crítica" : "non-critical";
  }
  return label;
}

function explain(
  lang: "es" | "en",
  problem: RootCauseProblemType,
  dimension: RootCauseDimension,
  label: string,
  a: number,
  groupSize: number,
  groupRate: number,
  baselineRate: number,
  lift: number,
): string {
  const problemLabel = PROBLEM_LABELS[problem][lang];
  const dimensionLabel = DIMENSION_LABELS[dimension][lang];
  const value = valueLabel(dimension, label, lang);
  const groupPct = Math.round(groupRate * 100);
  const basePct = Math.round(baselineRate * 100);
  const liftText = `×${round(lift, 1)}`;
  return lang === "es"
    ? `Las tareas con ${dimensionLabel} "${value}" presentan ${problemLabel} en ${a} de ${groupSize} casos (${groupPct}% frente a ${basePct}% global, ${liftText}). Esto es evidencia de asociación, no una causa confirmada.`
    : `Tasks with ${dimensionLabel} "${value}" show ${problemLabel} in ${a} of ${groupSize} cases (${groupPct}% vs ${basePct}% overall, ${liftText}). This is association evidence, not a confirmed cause.`;
}

/**
 * Mine adverse statistical associations between structural dimensions and
 * problem types. Deterministic: stable ordering (influence desc, then
 * dimension/value lexicographic).
 */
export function mineRootCauses(tasks: readonly RootCauseTaskInput[]): RootCauseMinerResult {
  const limitations: string[] = [];
  const problems: RootCauseProblemStats[] = [];
  const findings: RootCauseFinding[] = [];
  const total = tasks.length;

  for (const problem of PROBLEM_TYPES) {
    const problemTasks = tasks.filter((task) => hasProblem(task, problem));
    const baselineRate = total > 0 ? problemTasks.length / total : 0;
    problems.push({
      problemType: problem,
      problemCount: problemTasks.length,
      totalTasks: total,
      baselineRate: round(baselineRate, 4),
    });
    if (problemTasks.length === 0 || baselineRate === 1) continue;

    // Group tasks per (dimension, value).
    const groups = new Map<string, { meta: DimensionValue; members: RootCauseTaskInput[] }>();
    for (const task of tasks) {
      for (const dv of dimensionValuesOf(task)) {
        const key = `${dv.dimension}␟${dv.value}`;
        const group = groups.get(key);
        if (group) group.members.push(task);
        else groups.set(key, { meta: dv, members: [task] });
      }
    }

    const problemFindings: RootCauseFinding[] = [];
    for (const { meta, members } of groups.values()) {
      const groupSize = members.length;
      if (groupSize < MIN_GROUP_SIZE || groupSize === total) continue;
      const a = members.filter((task) => hasProblem(task, problem)).length;
      const b = groupSize - a;
      const c = problemTasks.length - a;
      const d = total - groupSize - c;
      const groupRate = a / groupSize;
      if (a === 0 || groupRate <= baselineRate) continue; // adverse associations only

      const lift = groupRate / baselineRate;
      const phi = Math.max(0, phiCoefficient(a, b, c, d));
      const coverage = a / problemTasks.length;
      // Influence: bounded lift + association strength + coverage, penalized
      // for small samples (full weight only from 10 group members up).
      const samplePenalty = Math.min(1, groupSize / 10);
      const influence =
        100 * (0.4 * Math.min(lift, 3) / 3 + 0.35 * phi + 0.25 * coverage) * samplePenalty;

      const confidence =
        groupSize >= 30 && phi >= 0.3 ? "high" : groupSize >= 10 && phi >= 0.15 ? "medium" : "low";

      const examples = members
        .filter((task) => hasProblem(task, problem))
        .slice(0, 3)
        .map((task) => ({ ref: `task:${task.taskId}`, title: task.title }));

      problemFindings.push({
        problemType: problem,
        dimension: meta.dimension,
        dimensionValue: meta.value,
        dimensionLabel: meta.label,
        influenceScore: round(influence, 1),
        confidence,
        method: "contingency_lift_phi",
        evidence: {
          groupSize,
          groupProblemCount: a,
          groupRate: round(groupRate, 4),
          baselineRate: round(baselineRate, 4),
          lift: round(lift, 2),
          phi: round(phi, 4),
          coverage: round(coverage, 4),
          exampleRefs: examples,
        },
        explanationEs: explain("es", problem, meta.dimension, meta.label, a, groupSize, groupRate, baselineRate, lift),
        explanationEn: explain("en", problem, meta.dimension, meta.label, a, groupSize, groupRate, baselineRate, lift),
      });
    }

    problemFindings.sort((x, y) => {
      if (x.influenceScore !== y.influenceScore) return y.influenceScore - x.influenceScore;
      const xa = `${x.dimension}␟${x.dimensionValue}`;
      const ya = `${y.dimension}␟${y.dimensionValue}`;
      return xa < ya ? -1 : 1;
    });
    findings.push(...problemFindings.slice(0, MAX_FINDINGS_PER_PROBLEM));
  }

  if (total < 10) {
    limitations.push(
      `Small sample (${total} tasks): associations are reported with low confidence and may not be stable.`,
    );
  }
  if (total > 0 && problems.every((p) => p.problemCount === 0)) {
    limitations.push("No delay, blockage, or rework signals found in the analyzed tasks.");
  }

  return { totalTasks: total, problems, findings, limitations };
}
