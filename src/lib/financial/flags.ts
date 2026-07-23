export interface FinancialFeatureEnvironment {
  foundation?: string;
  writers?: string;
  projections?: string;
  ui?: string;
  isabella?: string;
  pilotProjectIds?: string;
}

function explicitlyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function isFinancialPilotProject(
  projectId: string,
  rawProjectIds: string | undefined,
): boolean {
  const raw = rawProjectIds?.trim() ?? "";
  if (!projectId || !raw) return false;
  if (raw === "all") return true;
  return raw.split(",").map((item) => item.trim()).filter(Boolean).includes(projectId);
}

export function getFinancialFeatureState(
  projectId: string,
  environment: FinancialFeatureEnvironment = {},
) {
  const pilot = isFinancialPilotProject(
    projectId,
    environment.pilotProjectIds,
  );
  return {
    pilot,
    foundation: pilot && explicitlyEnabled(environment.foundation),
    writers: pilot && explicitlyEnabled(environment.foundation) && explicitlyEnabled(environment.writers),
    projections:
      pilot && explicitlyEnabled(environment.foundation) && explicitlyEnabled(environment.projections),
    ui:
      pilot &&
      explicitlyEnabled(environment.foundation) &&
      explicitlyEnabled(environment.projections) &&
      explicitlyEnabled(environment.ui),
    isabella:
      pilot &&
      explicitlyEnabled(environment.foundation) &&
      explicitlyEnabled(environment.projections) &&
      explicitlyEnabled(environment.isabella),
  };
}

export function getFinancialFeatureStateFromProcess(projectId: string) {
  return getFinancialFeatureState(projectId, {
    foundation: process.env.FINANCIAL_FOUNDATION_ENABLED,
    writers: process.env.FINANCIAL_WRITERS_ENABLED,
    projections: process.env.FINANCIAL_PROJECTIONS_ENABLED,
    ui: process.env.FINANCIAL_UI_ENABLED,
    isabella: process.env.FINANCIAL_ISABELLA_ENABLED,
    pilotProjectIds: process.env.FINANCIAL_PILOT_PROJECT_IDS,
  });
}
