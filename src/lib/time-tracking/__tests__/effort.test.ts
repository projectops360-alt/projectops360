import { describe, it, expect } from "vitest";

// ============================================================================
// Time Tracking Engine — duration & effort math
// ============================================================================
// Guard TIME-TRACKING-ACTUAL-HOURS: actual hours are only ever a SUM over
// logged entries, and the effort standing derived from them drives the
// subtask widget, the task report and the project KPIs. If this math drifts,
// so does every future EVM number (AC, CPI, SPI, ETC, EAC, VAC).
// ============================================================================

import {
  roundHours,
  parseTimeToMinutes,
  durationFromInterval,
  validateDuration,
  resolveEntryDuration,
  sumHours,
  sumHoursBy,
  computeEffort,
  effortSeverity,
  effortBarPct,
  crossedEffortBudget,
  SUBTASK_THRESHOLDS,
  PORTFOLIO_THRESHOLDS,
  MAX_DAILY_HOURS,
} from "../effort";

describe("duration from an interval", () => {
  it("computes whole and partial hours", () => {
    expect(durationFromInterval("09:00", "17:00")).toEqual({ ok: true, hours: 8 });
    expect(durationFromInterval("09:00", "12:30")).toEqual({ ok: true, hours: 3.5 });
    expect(durationFromInterval("14:15", "15:00")).toEqual({ ok: true, hours: 0.75 });
  });

  it("accepts seconds in the input (what <input type=time> may send)", () => {
    expect(durationFromInterval("09:00:00", "10:00:00").hours).toBe(1);
  });

  it("rejects an end before the start instead of wrapping past midnight", () => {
    // "09:00 → 08:00" is a typo far more often than a 23-hour shift; guessing
    // would quietly corrupt Actual Cost.
    expect(durationFromInterval("09:00", "08:00")).toEqual({ ok: false, hours: null, error: "end_before_start" });
  });

  it("rejects a zero-length interval", () => {
    expect(durationFromInterval("09:00", "09:00").error).toBe("zero_duration");
  });

  it("rejects malformed times", () => {
    for (const bad of ["", "9", "25:00", "12:60", "abc", "9:00 AM"]) {
      expect(durationFromInterval(bad, "17:00").error, bad).toBe("invalid_time");
    }
  });

  it("parses minutes since midnight", () => {
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
    expect(parseTimeToMinutes("24:00")).toBeNull();
  });
});

describe("directly typed duration", () => {
  it("accepts positive hours up to a full day", () => {
    expect(validateDuration(3).hours).toBe(3);
    expect(validateDuration(0.25).hours).toBe(0.25);
    expect(validateDuration(MAX_DAILY_HOURS).hours).toBe(24);
  });

  it("rejects zero, negatives and more than a day", () => {
    expect(validateDuration(0).error).toBe("zero_duration");
    expect(validateDuration(-2).error).toBe("zero_duration");
    expect(validateDuration(24.5).error).toBe("exceeds_day");
    expect(validateDuration(Number.NaN).error).toBe("invalid_time");
  });

  it("rounds to two decimals and absorbs float noise", () => {
    expect(validateDuration(2.567).hours).toBe(2.57);
    expect(validateDuration(1.333333).hours).toBe(1.33);
    expect(roundHours(0.1 + 0.2)).toBe(0.3);
    // 8 × 1.1h must not land on 8.799999999999999
    expect(sumHours(Array.from({ length: 8 }, () => ({ duration_hours: 1.1 })))).toBe(8.8);
  });
});

describe("resolving what the user filled in", () => {
  it("uses the interval when start and end are given", () => {
    expect(resolveEntryDuration({ startTime: "09:00", endTime: "13:00" }).hours).toBe(4);
  });

  it("uses the typed duration when there is no interval", () => {
    expect(resolveEntryDuration({ durationHours: 2.5 }).hours).toBe(2.5);
  });

  it("prefers the interval when BOTH are supplied — it is the more specific claim", () => {
    const result = resolveEntryDuration({ startTime: "09:00", endTime: "10:00", durationHours: 8 });
    expect(result.hours).toBe(1);
  });

  it("falls back to the duration when only one end of the interval is present", () => {
    expect(resolveEntryDuration({ startTime: "09:00", endTime: null, durationHours: 3 }).hours).toBe(3);
  });

  it("fails when nothing usable was provided", () => {
    expect(resolveEntryDuration({}).ok).toBe(false);
    expect(resolveEntryDuration({ startTime: "09:00" }).ok).toBe(false);
  });
});

describe("aggregation", () => {
  const entries = [
    { duration_hours: 3, subtask_id: "s1", user_id: "u1", work_date: "2026-07-27" },
    { duration_hours: 2.5, subtask_id: "s1", user_id: "u2", work_date: "2026-07-27" },
    { duration_hours: 4, subtask_id: "s2", user_id: "u1", work_date: "2026-07-28" },
    { duration_hours: 1.25, subtask_id: null, user_id: "u1", work_date: "2026-07-28" },
  ];

  it("sums every entry", () => {
    expect(sumHours(entries)).toBe(10.75);
    expect(sumHours([])).toBe(0);
  });

  it("survives string numerics coming back from postgres numeric()", () => {
    expect(sumHours([{ duration_hours: "2.50" as unknown as number }, { duration_hours: 1 }])).toBe(3.5);
  });

  it("groups by subtask, skipping task-level entries", () => {
    const bySubtask = sumHoursBy(entries, (e) => e.subtask_id);
    expect(bySubtask.get("s1")).toBe(5.5);
    expect(bySubtask.get("s2")).toBe(4);
    expect(bySubtask.size).toBe(2);
  });

  it("groups by person and by day for utilisation and burn rate", () => {
    expect(sumHoursBy(entries, (e) => e.user_id).get("u1")).toBe(8.25);
    expect(sumHoursBy(entries, (e) => e.work_date).get("2026-07-28")).toBe(5.25);
  });
});

describe("effort standing", () => {
  it("reports remaining, percentage and variance", () => {
    const effort = computeEffort(40, 26);
    expect(effort.estimatedHours).toBe(40);
    expect(effort.actualHours).toBe(26);
    expect(effort.remainingHours).toBe(14);
    expect(effort.consumedPct).toBe(65);
    expect(effort.varianceHours).toBe(-14);
    expect(effort.severity).toBe("on_track");
  });

  it("shows the overrun instead of clamping remaining at zero", () => {
    const effort = computeEffort(40, 52);
    expect(effort.remainingHours).toBe(-12);
    expect(effort.varianceHours).toBe(12);
    expect(effort.consumedPct).toBe(130);
  });

  it("stays neutral when nothing was estimated", () => {
    const effort = computeEffort(null, 12);
    expect(effort.estimatedHours).toBeNull();
    expect(effort.actualHours).toBe(12);
    expect(effort.remainingHours).toBeNull();
    expect(effort.consumedPct).toBeNull();
    expect(effort.severity).toBe("none");
  });

  it("treats a zero estimate as no estimate rather than dividing by zero", () => {
    expect(computeEffort(0, 5).consumedPct).toBeNull();
    expect(computeEffort(0, 5).severity).toBe("none");
  });

  it("handles no time logged yet", () => {
    const effort = computeEffort(40, 0);
    expect(effort.consumedPct).toBe(0);
    expect(effort.remainingHours).toBe(40);
    expect(effort.severity).toBe("on_track");
  });
});

describe("severity thresholds", () => {
  it("a subtask warns early: 90% amber, past 100% over, past 120% red", () => {
    const t = SUBTASK_THRESHOLDS;
    expect(effortSeverity(89.9, t)).toBe("on_track");
    expect(effortSeverity(90, t)).toBe("warning");
    expect(effortSeverity(100, t)).toBe("warning");
    expect(effortSeverity(100.1, t)).toBe("over");
    expect(effortSeverity(120, t)).toBe("over");
    expect(effortSeverity(120.1, t)).toBe("critical");
  });

  it("an aggregate stays green until the estimate is actually passed", () => {
    const t = PORTFOLIO_THRESHOLDS;
    expect(effortSeverity(95, t)).toBe("on_track");
    expect(effortSeverity(100, t)).toBe("warning");
    expect(effortSeverity(110, t)).toBe("over");
    expect(effortSeverity(121, t)).toBe("critical");
  });

  it("no estimate means no judgement", () => {
    expect(effortSeverity(null)).toBe("none");
  });

  it("the bar never overflows its track", () => {
    expect(effortBarPct(computeEffort(40, 26))).toBe(65);
    expect(effortBarPct(computeEffort(40, 80))).toBe(100);
    expect(effortBarPct(computeEffort(null, 10))).toBe(0);
  });
});

describe("budget-crossing alert", () => {
  it("fires exactly on the transition past the estimate", () => {
    expect(crossedEffortBudget(40, 38, 42)).toBe(true);
  });

  it("does not re-fire once already over — no alert spam per entry", () => {
    expect(crossedEffortBudget(40, 42, 46)).toBe(false);
  });

  it("does not fire while still inside the budget", () => {
    expect(crossedEffortBudget(40, 10, 39)).toBe(false);
    expect(crossedEffortBudget(40, 10, 40)).toBe(false);
  });

  it("stays silent when there is no estimate to exceed", () => {
    expect(crossedEffortBudget(null, 0, 100)).toBe(false);
    expect(crossedEffortBudget(0, 0, 100)).toBe(false);
  });
});
