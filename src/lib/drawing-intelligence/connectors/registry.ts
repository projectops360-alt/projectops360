// ============================================================================
// ProjectOps360° — Connector Registry (Prompt 5)
// ============================================================================
// Single lookup point for drawing source connectors. Vendor-agnostic:
// adding Procore/Google Drive later means implementing DrawingConnector and
// registering it here — nothing else changes.
// ============================================================================

import { AutodeskConnector } from "./autodesk";
import type { ConnectorId, ConnectorStatus, DrawingConnector } from "./types";

const connectors: Map<ConnectorId, DrawingConnector> = new Map([
  ["autodesk_aps", new AutodeskConnector()],
  // TODO(future): ["procore", new ProcoreConnector()],
  // TODO(future): ["google_drive", new GoogleDriveConnector()],
] as [ConnectorId, DrawingConnector][]);

export function getConnector(id: ConnectorId): DrawingConnector | null {
  return connectors.get(id) ?? null;
}

export async function getAllConnectorStatuses(): Promise<ConnectorStatus[]> {
  const statuses: ConnectorStatus[] = [];
  for (const connector of connectors.values()) {
    // isConfigured() is cheap; only verified connectors hit the network
    if (!connector.isConfigured()) {
      statuses.push({
        id: connector.id,
        state: "not_configured",
        detail: null,
        lastSyncedAt: null,
      });
    } else {
      statuses.push(await connector.getStatus());
    }
  }
  return statuses;
}
