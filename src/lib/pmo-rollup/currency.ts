import type { PmoExchangeRate, PmoMoneyValue } from "./contracts";

export interface ConvertedMoney {
  value: number | null;
  exchangeRateId: string | null;
  reason: string | null;
}

export function convertMoney(
  money: PmoMoneyValue | null | undefined,
  reportingCurrency: string,
  organizationId: string,
  asOf: string,
  exchangeRates: readonly PmoExchangeRate[],
): ConvertedMoney {
  if (!money || !Number.isFinite(money.amount)) {
    return { value: null, exchangeRateId: null, reason: "missing_amount" };
  }
  if (money.currency === reportingCurrency) {
    return { value: money.amount, exchangeRateId: null, reason: null };
  }

  const rate = exchangeRates
    .filter((candidate) =>
      candidate.organizationId === organizationId
      && candidate.fromCurrency === money.currency
      && candidate.toCurrency === reportingCurrency
      && candidate.effectiveDate <= asOf
      && candidate.rate > 0)
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0];

  return rate
    ? { value: money.amount * rate.rate, exchangeRateId: rate.id, reason: null }
    : { value: null, exchangeRateId: null, reason: "missing_exchange_rate" };
}
