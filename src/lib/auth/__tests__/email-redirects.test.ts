import { describe, expect, it } from "vitest";

import {
  buildAuthCallbackUrl,
  resolveAuthSiteUrl,
  sanitizeAuthNextPath,
} from "../email-redirects";

describe("Auth email redirects", () => {
  it("uses the canonical configured URL in production", () => {
    expect(
      resolveAuthSiteUrl({
        configuredSiteUrl: "https://projectops360.com/",
        requestOrigin: "https://preview.example.com",
        deploymentEnvironment: "production",
      }),
    ).toBe("https://projectops360.com");
  });

  it("uses the request origin for local and preview flows", () => {
    expect(
      resolveAuthSiteUrl({
        configuredSiteUrl: "https://projectops360.com",
        requestOrigin: "http://localhost:3000",
        deploymentEnvironment: "development",
      }),
    ).toBe("http://localhost:3000");
  });

  it("rejects insecure non-local origins", () => {
    expect(
      resolveAuthSiteUrl({
        configuredSiteUrl: "https://projectops360.com",
        requestOrigin: "http://preview.example.com",
        deploymentEnvironment: "preview",
      }),
    ).toBe("https://projectops360.com");
  });

  it("builds a callback URL with a safe next path", () => {
    expect(buildAuthCallbackUrl("https://projectops360.com", "/change-password?recovery=1")).toBe(
      "https://projectops360.com/auth/callback?next=%2Fchange-password%3Frecovery%3D1",
    );
  });

  it("blocks protocol-relative next paths", () => {
    expect(sanitizeAuthNextPath("//attacker.example", "/login")).toBe("/login");
  });
});
