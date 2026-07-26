// ============================================================================
// Message catalogue format guard (guard: I18N-KEY-FORMAT)
// ============================================================================
// next-intl reserves "." to express nesting. A flat key containing one — say
// "annotationFinanceAlert.cpi_below_threshold" — makes the library reject the
// ENTIRE namespace at runtime with INVALID_KEY, so one bad key takes down every
// translation on the screen.
//
// This shipped once. It survived typecheck, 2770 tests and a production build,
// because the existing i18n tests compare key SETS between EN and ES: a
// malformed key present in both files looks like perfect parity. Nothing
// validated the shape of a key itself. This does.
// ============================================================================

import { describe, expect, it } from "vitest";
import en from "../../../../messages/en.json";
import es from "../../../../messages/es.json";

type Catalogue = Record<string, unknown>;

/** Every key path in the catalogue, so a failure names the exact offender. */
function collectKeys(node: Catalogue, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.push(path);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...collectKeys(value as Catalogue, path));
    }
  }
  return keys;
}

/** Only the final segment matters — the joining dots are ours, not theirs. */
function offendingKeys(node: Catalogue, prefix = ""): string[] {
  const bad: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (key.includes(".")) bad.push(path);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      bad.push(...offendingKeys(value as Catalogue, path));
    }
  }
  return bad;
}

describe("message keys are valid for next-intl (I18N-KEY-FORMAT)", () => {
  it.each([
    ["en", en as Catalogue],
    ["es", es as Catalogue],
  ])("%s contains no key with a literal dot", (_locale, catalogue) => {
    // Nest the group instead: { annotationFinanceAlert: { cpi_below_threshold: … } }.
    // Reading it as t("annotationFinanceAlert.cpi_below_threshold") still works.
    expect(offendingKeys(catalogue)).toEqual([]);
  });

  it.each([
    ["en", en as Catalogue],
    ["es", es as Catalogue],
  ])("%s has no empty keys", (_locale, catalogue) => {
    const empty = collectKeys(catalogue).filter((path) => path.split(".").some((s) => s === ""));
    expect(empty).toEqual([]);
  });

  it("keeps EN and ES structurally identical, not merely equal in count", () => {
    // Same key set AND same nesting: a group on one side and a flat string on
    // the other resolves differently at runtime even when both "exist".
    expect(collectKeys(en as Catalogue).sort()).toEqual(collectKeys(es as Catalogue).sort());
  });

  it("resolves every finance alert as a nested group", () => {
    const group = (en as Catalogue).pmoIntelligence as Catalogue;
    const alerts = group.annotationFinanceAlert as Catalogue;
    expect(typeof alerts).toBe("object");
    for (const rule of [
      "cpi_below_threshold",
      "spi_below_threshold",
      "eac_exceeds_baseline",
      "reconciliation_exceptions",
      "unverified_actuals",
      "currency_mismatches",
    ]) {
      expect(typeof alerts[rule], rule).toBe("string");
    }
  });
});
