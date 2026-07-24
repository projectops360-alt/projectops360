export function isPmoPortfolioRollupEngineEnabled(): boolean {
  return process.env.PMO_PORTFOLIO_ROLLUP_ENGINE_V1_ENABLED === "true";
}
