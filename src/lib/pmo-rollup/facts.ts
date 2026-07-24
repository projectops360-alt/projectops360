export function selectLatestFacts<T>(
  facts: readonly T[],
  keyOf: (fact: T) => string,
  dateOf: (fact: T) => string,
  idOf: (fact: T) => string,
  asOf: string,
): T[] {
  const latest = new Map<string, T>();
  for (const fact of facts) {
    const date = dateOf(fact);
    if (date > asOf) continue;
    const key = keyOf(fact);
    const existing = latest.get(key);
    if (!existing) {
      latest.set(key, fact);
      continue;
    }
    const existingDate = dateOf(existing);
    if (date > existingDate || (date === existingDate && idOf(fact) > idOf(existing))) {
      latest.set(key, fact);
    }
  }
  return [...latest.values()].sort((left, right) => keyOf(left).localeCompare(keyOf(right)));
}
