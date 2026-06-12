// ============================================================================
// ProjectOps360° — Autodesk APS Connector (Prompt 5)
// ============================================================================
// Real (not faked) Autodesk Platform Services integration, gated on env vars:
//   APS_CLIENT_ID, APS_CLIENT_SECRET  (2-legged OAuth, client_credentials)
// Without credentials every method throws ConnectorNotConfiguredError and
// getStatus() reports not_configured — the UI shows a clear setup message.
//
// Implemented today: token auth, hub/project/folder/file listing through the
// Data Management API (enough to browse ACC and import file metadata).
// Prepared (TODO markers): Model Derivative translation, AEC Data Model,
// webhooks registration. Server-only — never expose credentials client-side.
// ============================================================================

import {
  ConnectorNotConfiguredError,
  type ConnectorStatus,
  type DrawingConnector,
  type ExternalFileRef,
  type ExternalFolderRef,
  type ExternalProjectRef,
} from "./types";

const APS_BASE = "https://developer.api.autodesk.com";

interface ApsToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedToken: ApsToken | null = null;

function missingEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.APS_CLIENT_ID) missing.push("APS_CLIENT_ID");
  if (!process.env.APS_CLIENT_SECRET) missing.push("APS_CLIENT_SECRET");
  return missing;
}

// ── AutodeskAuthService ───────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const missing = missingEnv();
  if (missing.length > 0) throw new ConnectorNotConfiguredError("autodesk_aps", missing);

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const response = await fetch(`${APS_BASE}/authentication/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${process.env.APS_CLIENT_ID}:${process.env.APS_CLIENT_SECRET}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "data:read account:read",
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`APS auth failed: HTTP ${response.status}`);
  }
  const json = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

async function apsGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${APS_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`APS request failed: HTTP ${response.status} for ${path}`);
  }
  return (await response.json()) as T;
}

// ── AutodeskDataManagementService (hubs → projects → folders → items) ────────

interface ApsListResponse {
  data?: { id: string; attributes?: Record<string, unknown>; relationships?: Record<string, unknown> }[];
}

export class AutodeskConnector implements DrawingConnector {
  readonly id = "autodesk_aps" as const;
  readonly label = "Autodesk Construction Cloud";

  isConfigured(): boolean {
    return missingEnv().length === 0;
  }

  async getStatus(): Promise<ConnectorStatus> {
    const missing = missingEnv();
    if (missing.length > 0) {
      return { id: this.id, state: "not_configured", detail: `Missing env: ${missing.join(", ")}`, lastSyncedAt: null };
    }
    try {
      await getAccessToken();
      return { id: this.id, state: "connected", detail: null, lastSyncedAt: null };
    } catch (error) {
      return {
        id: this.id,
        state: "error",
        detail: error instanceof Error ? error.message : String(error),
        lastSyncedAt: null,
      };
    }
  }

  /** ACC "projects" requires walking hubs first; flattened here. */
  async listProjects(): Promise<ExternalProjectRef[]> {
    const hubs = await apsGet<ApsListResponse>("/project/v1/hubs");
    const projects: ExternalProjectRef[] = [];
    for (const hub of hubs.data ?? []) {
      const hubProjects = await apsGet<ApsListResponse>(`/project/v1/hubs/${hub.id}/projects`);
      for (const project of hubProjects.data ?? []) {
        projects.push({
          externalId: project.id,
          name: String((project.attributes as { name?: string } | undefined)?.name ?? project.id),
        });
      }
    }
    return projects;
  }

  async listFolders(projectExternalId: string, folderExternalId?: string): Promise<ExternalFolderRef[]> {
    // Top folders need the hub id embedded in the project id (b.xxx) — the
    // Data Management API exposes them via project topFolders.
    const path = folderExternalId
      ? `/data/v1/projects/${projectExternalId}/folders/${encodeURIComponent(folderExternalId)}/contents`
      : `/project/v1/hubs/${projectExternalId.split("|")[0]}/projects/${projectExternalId}/topFolders`;
    const result = await apsGet<ApsListResponse>(path);
    return (result.data ?? [])
      .filter((item) => item.id.startsWith("urn:adsk.wipprod:fs.folder"))
      .map((folder) => ({
        externalId: folder.id,
        name: String((folder.attributes as { displayName?: string } | undefined)?.displayName ?? folder.id),
        parentId: folderExternalId ?? null,
      }));
  }

  async listFiles(projectExternalId: string, folderExternalId: string): Promise<ExternalFileRef[]> {
    const result = await apsGet<{
      data?: { id: string; attributes?: Record<string, unknown> }[];
      included?: { id: string; type: string; attributes?: Record<string, unknown> }[];
    }>(`/data/v1/projects/${projectExternalId}/folders/${encodeURIComponent(folderExternalId)}/contents`);

    const versions = new Map(
      (result.included ?? [])
        .filter((item) => item.type === "versions")
        .map((version) => [version.id, version]),
    );

    return (result.data ?? [])
      .filter((item) => item.id.startsWith("urn:adsk.wipprod:dm.lineage"))
      .map((item) => {
        const attrs = (item.attributes ?? {}) as { displayName?: string; lastModifiedTime?: string };
        const tipVersion = [...versions.values()][0];
        const versionAttrs = (tipVersion?.attributes ?? {}) as { storageSize?: number; fileType?: string };
        return {
          externalId: item.id,
          versionId: tipVersion?.id ?? item.id,
          name: attrs.displayName ?? item.id,
          fileType: versionAttrs.fileType ?? null,
          size: versionAttrs.storageSize ?? null,
          lastModified: attrs.lastModifiedTime ?? null,
          downloadUrl: null, // resolved per-version via storage relationship at import time
        };
      });
  }

  // ── AutodeskModelDerivativeService (prepared, not yet wired) ──────────────
  // TODO(prompt-5+): translate models (POST /modelderivative/v2/designdata/job),
  // poll manifests, extract object hierarchy + properties into the future
  // bim_models / bim_elements tables (see src/types/bim.ts scaffolding).

  // ── AutodeskWebhookService (prepared, not yet wired) ───────────────────────
  // TODO(prompt-5+): register webhooks (POST /webhooks/v1/systems/data/events/
  // dm.version.added/hooks) pointing at /api/webhooks/drawings with the
  // DRAWING_WEBHOOK_SECRET; map payloads to DrawingSourceEvent in events.ts.
}
