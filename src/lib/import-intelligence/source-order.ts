export interface SourceOrderedImportEntity {
  source_order: number | null;
}

export function orderImportEntities<T extends SourceOrderedImportEntity>(entities: readonly T[]): T[] {
  return entities
    .map((entity, inputOrder) => ({ entity, inputOrder }))
    .sort((a, b) => {
      const orderA = a.entity.source_order;
      const orderB = b.entity.source_order;
      if (orderA == null && orderB == null) return a.inputOrder - b.inputOrder;
      if (orderA == null) return 1;
      if (orderB == null) return -1;
      return orderA - orderB || a.inputOrder - b.inputOrder;
    })
    .map(({ entity }) => entity);
}
