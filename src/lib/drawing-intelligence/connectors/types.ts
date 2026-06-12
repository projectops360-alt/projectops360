// ============================================================================
// ProjectOps360° — Drawing Source Connector Abstraction (Prompt 5)
// ============================================================================
// Vendor-agnostic contract every external drawing source implements:
// Autodesk APS today, Procore / Trimble / Google Drive later. The canonical
// model (drawing_files + canonical extraction JSON) is ProjectOps360°-owned;
// connectors only translate external metadata into it.
// ============================================================================

export type ConnectorId = "autodesk_aps" | "procore" | "google_drive";

export type ConnectorState =
  | "not_configured" // missing credentials/env — show setup message, never fake
  | "configured" // credentials present, not yet verified
  | "connected" // credentials verified against the provider
  | "error";

export interface ConnectorStatus {
  id: ConnectorId;
  state: ConnectorState;
  /** Human-oriented detail (e.g. which env vars are missing) */
  detail: string | null;
  lastSyncedAt: string | null;
}

export interface ExternalProjectRef {
  externalId: string;
  name: string;
}

export interface ExternalFolderRef {
  externalId: string;
  name: string;
  parentId: string | null;
}

export interface ExternalFileRef {
  externalId: string;
  versionId: string;
  name: string;
  fileType: string | null;
  size: number | null;
  lastModified: string | null;
  downloadUrl: string | null;
}

/** Contract for external drawing sources. Methods MUST throw
 *  ConnectorNotConfiguredError when credentials are absent — never fake. */
export interface DrawingConnector {
  readonly id: ConnectorId;
  readonly label: string;
  isConfigured(): boolean;
  getStatus(): Promise<ConnectorStatus>;
  listProjects(): Promise<ExternalProjectRef[]>;
  listFolders(projectExternalId: string, folderExternalId?: string): Promise<ExternalFolderRef[]>;
  listFiles(projectExternalId: string, folderExternalId: string): Promise<ExternalFileRef[]>;
}

export class ConnectorNotConfiguredError extends Error {
  constructor(connectorId: ConnectorId, missing: string[]) {
    super(`Connector ${connectorId} is not configured. Missing: ${missing.join(", ")}`);
    this.name = "ConnectorNotConfiguredError";
  }
}
