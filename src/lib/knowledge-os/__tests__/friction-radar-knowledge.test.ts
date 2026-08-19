// ============================================================================
// ISABELLA-FRICTION-RADAR-READ — corpus, screen resolution and contextual help
// ============================================================================
// The corpus is what Isabella falls back on when no tool runs. If it drifts
// from the engine, she explains a product that does not exist — so these tests
// pin the claims that matter, in both languages.
// ============================================================================

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRICTION_RADAR_PACKAGES } from "../seeds/friction-radar-knowledge";
import { PRODUCT_BRAIN_PACKAGES } from "../seeds/product-brain-knowledge";
import { resolveScreen, projectSubroute } from "../screens";
import {
  answerScreenHelp,
  isScreenExplanationIntent,
  resolveScreenArea,
} from "@/lib/isabella/screen-help";

const bySlug = new Map(FRICTION_RADAR_PACKAGES.map((p) => [p.slug, p]));
const AURORA = "a40a7436-c63f-4e3b-94cd-041447ee54d4";
const FRICTION_SCREEN = {
  module: "friction_radar",
  screen: "friction_radar",
  pathname: `/projects/${AURORA}/friction-radar`,
};

describe("corpus structure and language parity", () => {
  it("is registered in the Product Brain manifest Isabella actually retrieves from", () => {
    for (const pkg of FRICTION_RADAR_PACKAGES) {
      expect(PRODUCT_BRAIN_PACKAGES.some((p) => p.slug === pkg.slug), pkg.slug).toBe(true);
    }
  });

  it("is bilingual, scoped and provenanced, with unique slugs", () => {
    for (const p of FRICTION_RADAR_PACKAGES) {
      expect(p.domain).toBe("product_intelligence");
      expect(p.tier).toBe("verified");
      expect(p.sourceRef.trim()).toBeTruthy();
      for (const lang of ["en", "es"] as const) {
        expect(p[lang].title.trim(), `${p.slug}.${lang}.title`).toBeTruthy();
        expect(p[lang].body.trim(), `${p.slug}.${lang}.body`).toBeTruthy();
      }
    }
    const slugs = FRICTION_RADAR_PACKAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("carries a citation and a verification path in both languages", () => {
    for (const p of FRICTION_RADAR_PACKAGES) {
      expect(p.en.body, p.slug).toMatch(/Source:/);
      expect(p.en.body, p.slug).toMatch(/Verify:/);
      expect(p.es.body, p.slug).toMatch(/Fuente:/);
      expect(p.es.body, p.slug).toMatch(/Verifica:/);
    }
  });

  it("keeps EN and ES at comparable depth, so neither language is a stub", () => {
    for (const p of FRICTION_RADAR_PACKAGES) {
      const ratio = p.es.body.length / p.en.body.length;
      expect(ratio, `${p.slug} EN/ES length ratio ${ratio.toFixed(2)}`).toBeGreaterThan(0.7);
      expect(ratio, `${p.slug} EN/ES length ratio ${ratio.toFixed(2)}`).toBeLessThan(1.6);
    }
  });

  it("reaches the database through the generated seed migration (no drift)", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    for (const p of FRICTION_RADAR_PACKAGES) {
      expect(sql, `slug ${p.slug} missing from migration history`).toContain(`'${p.slug}'`);
    }
  });
});

describe("the facts Isabella must state", () => {
  const facts: Array<[string, "en" | "es", RegExp]> = [
    // Process mining over real event sequences, read-only.
    ["pi-friction-radar-what-it-is", "en", /process mining/i],
    ["pi-friction-radar-what-it-is", "en", /read-only/i],
    ["pi-friction-radar-what-it-is", "es", /process mining/i],
    ["pi-friction-radar-what-it-is", "es", /solo lectura/i],
    // Independent 0-100 scores and NO global score.
    ["pi-friction-radar-no-global-score", "en", /0 to 100/i],
    ["pi-friction-radar-no-global-score", "en", /NO Global Friction Score/i],
    ["pi-friction-radar-no-global-score", "en", /never (be )?(added, averaged|summed)/i],
    ["pi-friction-radar-no-global-score", "es", /0 a 100/i],
    ["pi-friction-radar-no-global-score", "es", /no existe una puntuaci[oó]n global/i],
    // The four axes.
    ["pi-friction-radar-signal-anatomy", "en", /CONFIDENCE[\s\S]*about the evidence, not about the impact/i],
    ["pi-friction-radar-signal-anatomy", "es", /CONFIANZA/],
    ["pi-friction-radar-signal-anatomy", "en", /insufficient_evidence/],
    // OBSERVED_START — the false positive that must never happen.
    ["pi-friction-radar-observed-start", "en", /NEVER claim a task is waiting/i],
    ["pi-friction-radar-observed-start", "en", /TaskImplemented/],
    ["pi-friction-radar-observed-start", "en", /TaskTested/],
    ["pi-friction-radar-observed-start", "en", /TimeLogged/],
    ["pi-friction-radar-observed-start", "en", /active state/i],
    ["pi-friction-radar-observed-start", "es", /NUNCA afirmes que una tarea est[aá] esperando/i],
    ["pi-friction-radar-observed-start", "es", /TaskImplemented/],
    // Absence taxonomy.
    ["pi-friction-radar-absence-is-not-a-fact", "en", /ABSENCE OF EVENTS/],
    ["pi-friction-radar-absence-is-not-a-fact", "en", /ABSENCE OF ACTIVITY/],
    ["pi-friction-radar-absence-is-not-a-fact", "en", /INSUFFICIENT EVIDENCE/],
    ["pi-friction-radar-absence-is-not-a-fact", "en", /TEMPORAL CONFLICT/],
    ["pi-friction-radar-absence-is-not-a-fact", "en", /LATE OR IMPORTED CAPTURE/],
    ["pi-friction-radar-absence-is-not-a-fact", "en", /never mean zero friction/i],
    ["pi-friction-radar-absence-is-not-a-fact", "es", /AUSENCIA DE EVENTOS/],
    ["pi-friction-radar-absence-is-not-a-fact", "es", /CONFLICTO TEMPORAL/],
    ["pi-friction-radar-absence-is-not-a-fact", "es", /nunca significan fricci[oó]n cero/i],
    // Categories.
    ["pi-friction-radar-categories", "en", /exactly eight categories/i],
    ["pi-friction-radar-categories", "en", /never means that category has no friction/i],
    ["pi-friction-radar-categories", "es", /ocho categor[ií]as/i],
    // Evidence contract.
    ["pi-friction-radar-evidence-contract", "en", /Never invent or embellish events, timestamps, owners/i],
    ["pi-friction-radar-evidence-contract", "en", /approvals, decisions, risks, costs, capacity or dependencies/i],
    ["pi-friction-radar-evidence-contract", "es", /Nunca inventes/i],
    // Screen usage.
    ["pi-friction-radar-reading-the-screen", "en", /Top 20/],
    ["pi-friction-radar-reading-the-screen", "en", /Living Graph/],
    ["pi-friction-radar-reading-the-screen", "es", /Fricciones/],
    ["pi-friction-radar-reading-the-screen", "es", /Living Graph/],
    // Queue / rework prudence.
    ["pi-friction-radar-queue-and-rework", "en", /planned start/i],
    ["pi-friction-radar-queue-and-rework", "en", /TaskCompleted followed by TaskReopened/],
    ["pi-friction-radar-queue-and-rework", "es", /inicio \*?\*?PLANIFICADO/i],
    // Pilot + read-only limits.
    ["pi-friction-radar-availability-and-limits", "en", /never recomputes|never recompute/i],
    ["pi-friction-radar-availability-and-limits", "en", /no service-role bypass/i],
    ["pi-friction-radar-availability-and-limits", "es", /solo lectura/i],
  ];

  it.each(facts)("%s (%s) states the expected fact", (slug, lang, re) => {
    const pkg = bySlug.get(slug);
    expect(pkg, `missing package ${slug}`).toBeDefined();
    expect(pkg![lang].body).toMatch(re);
  });

  it("names all eight categories in both languages", () => {
    const pkg = bySlug.get("pi-friction-radar-categories")!;
    for (const c of ["PROCESS", "RESOURCE", "DEPENDENCY", "SCHEDULE", "COST", "RISK", "DECISION", "QUALITY"]) {
      expect(pkg.en.body, c).toMatch(new RegExp(`\\b${c}\\b`));
    }
    for (const c of ["PROCESO", "RECURSOS", "DEPENDENCIAS", "CRONOGRAMA", "COSTOS", "RIESGOS", "DECISIONES", "CALIDAD"]) {
      expect(pkg.es.body, c).toMatch(new RegExp(`\\b${c}\\b`));
    }
  });

  it("lists every evidence-contract field Isabella must preserve", () => {
    const pkg = bySlug.get("pi-friction-radar-evidence-contract")!;
    for (const field of [
      "signal_id",
      "project_id",
      "task_id",
      "milestone_id",
      "category",
      "signal_type",
      "observed_value",
      "expected_or_baseline",
      "severity",
      "confidence",
      "evidence_event_ids",
      "evidence_timestamp_start",
      "evidence_timestamp_end",
      "evidence_description",
      "source_engine",
    ]) {
      expect(pkg.en.body, field).toContain(field);
      expect(pkg.es.body, field).toContain(field);
    }
  });

  it("never asserts a global friction score anywhere in the corpus", () => {
    for (const p of FRICTION_RADAR_PACKAGES) {
      for (const lang of ["en", "es"] as const) {
        // No package may claim a computed overall/global friction figure.
        expect(p[lang].body, `${p.slug}.${lang}`).not.toMatch(
          /(global|overall|total)\s+friction\s+score\s+(is|of|=)\s*\d/i,
        );
        expect(p[lang].body, `${p.slug}.${lang}`).not.toMatch(
          /puntuaci[oó]n\s+global\s+(es|de)\s*\d/i,
        );
      }
    }
  });
});

describe("screen resolution", () => {
  it("resolves the friction-radar sub-route to its own screen", () => {
    expect(projectSubroute(`/projects/${AURORA}/friction-radar`)).toBe("friction-radar");
    const s = resolveScreen(`/projects/${AURORA}/friction-radar`, "en");
    expect(s?.screen).toBe("friction_radar");
    expect(s?.module).toBe("friction_radar");
    expect(s?.pageTitle).toBe("Friction Radar");
  });

  it("does NOT collapse into the generic Projects screen", () => {
    const s = resolveScreen(`/projects/${AURORA}/friction-radar`, "en");
    expect(s?.screen).not.toBe("projects_list");
    expect(s?.screen).not.toBe("process_mining_layer");
  });

  it("uses Fricciones as the Spanish entry point name", () => {
    const s = resolveScreen(`/es/projects/${AURORA}/friction-radar`, "es");
    expect(s?.pageTitle).toContain("Fricciones");
  });

  it("describes the components without inventing a global score", () => {
    const en = resolveScreen(`/projects/${AURORA}/friction-radar`, "en")!;
    expect(en.components.join(" ")).toMatch(/Aggregation awaits validation/);
    expect(en.components.join(" ")).toMatch(/INDEPENDENT signal score/);
    const es = resolveScreen(`/es/projects/${AURORA}/friction-radar`, "es")!;
    expect(es.components.join(" ")).toMatch(/La agregacion espera validacion/);
  });

  it("keeps EN and ES components and follow-ups at parity", () => {
    const en = resolveScreen(`/projects/${AURORA}/friction-radar`, "en")!;
    const es = resolveScreen(`/es/projects/${AURORA}/friction-radar`, "es")!;
    expect(es.components).toHaveLength(en.components.length);
    expect(es.followups).toHaveLength(en.followups.length);
  });

  it("mentions the Fricciones entry point from the Execution Map", () => {
    const en = resolveScreen(`/projects/${AURORA}/execution-map`, "en")!;
    expect(en.components.join(" ")).toMatch(/Frictions/);
    const es = resolveScreen(`/es/projects/${AURORA}/execution-map`, "es")!;
    expect(es.components.join(" ")).toMatch(/Fricciones/);
  });
});

describe("contextual screen help", () => {
  it("recognises the /friction-radar surface", () => {
    expect(resolveScreenArea(FRICTION_SCREEN)).toBe("friction_radar");
    expect(resolveScreenArea({ pathname: `/es/projects/${AURORA}/friction-radar` })).toBe("friction_radar");
  });

  it("recognises the Fricciones tab reached from the Execution Map", () => {
    // Without this the tab would resolve to process_mining and Isabella would
    // confidently explain the Living Graph instead.
    expect(
      resolveScreenArea({
        module: "process_mining",
        pathname: `/projects/${AURORA}/execution-map`,
        tab: "fricciones",
      }),
    ).toBe("friction_radar");
    expect(resolveScreenArea({ pathname: `/projects/${AURORA}/execution-map`, tab: "frictions" })).toBe(
      "friction_radar",
    );
  });

  it("still routes the plain Execution Map to process mining", () => {
    expect(resolveScreenArea({ module: "process_mining", pathname: `/projects/${AURORA}/execution-map` })).toBe(
      "process_mining",
    );
  });

  it("answers 'explain this screen' confidently in both languages", () => {
    for (const [q, lang] of [
      ["Explain this screen", "en"],
      ["Explícame esta pantalla", "es"],
    ] as const) {
      expect(isScreenExplanationIntent(q)).toBe(true);
      const a = answerScreenHelp(q, FRICTION_SCREEN, lang);
      expect(a.area).toBe("friction_radar");
      expect(a.confident).toBe(true);
    }
    expect(answerScreenHelp("Explain this screen", FRICTION_SCREEN, "es").answer).toContain("Fricciones");
    expect(answerScreenHelp("Explain this screen", FRICTION_SCREEN, "en").answer).toContain("Frictions");
  });

  it("explains that there is no global score", () => {
    const en = answerScreenHelp("what does the global score mean?", FRICTION_SCREEN, "en");
    expect(en.term).toBe("global_score");
    expect(en.answer).toMatch(/\*\*no Global Friction Score\*\*/i);
    const es = answerScreenHelp("qué significa la puntuación global?", FRICTION_SCREEN, "es");
    expect(es.term).toBe("global_score");
    expect(es.answer).toMatch(/\*\*no existe una puntuaci[oó]n global/i);
  });

  it("refuses to read a missing TaskStarted as waiting", () => {
    for (const [q, lang, re] of [
      ["what does it mean that there is no TaskStarted?", "en", /never means the task is waiting/i],
      ["¿esta tarea está esperando porque nunca tuvo TaskStarted?", "es", /nunca significa que la tarea est[eé] esperando/i],
    ] as const) {
      const a = answerScreenHelp(q, FRICTION_SCREEN, lang);
      expect(a.term).toBe("observed_start");
      expect(a.answer).toMatch(re);
    }
  });

  it("explains that unknown and insufficient evidence are not zero friction", () => {
    const en = answerScreenHelp("what does unknown mean here?", FRICTION_SCREEN, "en");
    expect(en.term).toBe("evidence_status");
    expect(en.answer).toMatch(/never mean zero friction/i);
    const es = answerScreenHelp("qué significa evidencia insuficiente?", FRICTION_SCREEN, "es");
    expect(es.answer).toMatch(/nunca significan fricci[oó]n cero/i);
  });

  it("separates confidence from severity", () => {
    const a = answerScreenHelp("what does the confidence of this signal mean?", FRICTION_SCREEN, "en");
    expect(a.term).toBe("confidence");
    expect(a.answer).toMatch(/about the \*\*evidence\*\*, not about the impact/i);
  });

  it("does not let the financial 'quality' term hijack the quality CATEGORY", () => {
    const a = answerScreenHelp("what does the quality category mean?", FRICTION_SCREEN, "en");
    expect(a.area).toBe("friction_radar");
    expect(a.term).toBe("friction_category");
    expect(a.answer).not.toMatch(/reconciliation/i);
  });

  it("covers every friction term in both languages", () => {
    const questions: Array<[string, string]> = [
      ["what is a signal?", "qué es una señal?"],
      ["explain the categories", "explica las categorías"],
      ["what does queue time mean?", "qué significa el tiempo en cola?"],
      ["what is rework here?", "qué es el retrabajo aquí?"],
      ["show me the evidence timeline", "muéstrame la línea de tiempo de evidencia"],
      ["how do the filters work?", "cómo funcionan los filtros?"],
    ];
    for (const [en, es] of questions) {
      const a = answerScreenHelp(en, FRICTION_SCREEN, "en");
      const b = answerScreenHelp(es, FRICTION_SCREEN, "es");
      expect(a.confident, en).toBe(true);
      expect(b.confident, es).toBe(true);
      expect(a.answer.length, en).toBeGreaterThan(80);
      expect(b.answer.length, es).toBeGreaterThan(80);
      // Same term resolved regardless of the language it was asked in.
      expect(b.term, `${en} / ${es}`).toBe(a.term);
    }
  });
});
