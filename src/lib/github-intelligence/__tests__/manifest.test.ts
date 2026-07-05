import { describe, it, expect } from "vitest";
import { buildGitHubAppManifest, READ_ONLY_PERMISSIONS, MANIFEST_EVENTS } from "../manifest";

describe("buildGitHubAppManifest", () => {
  const m = buildGitHubAppManifest({ baseUrl: "https://app.example.com/" });

  it("uses the base URL for all routes (trailing slash normalized)", () => {
    expect(m.url).toBe("https://app.example.com");
    expect(m.hook_attributes.url).toBe("https://app.example.com/api/integrations/github/webhook");
    expect(m.redirect_url).toContain("/api/integrations/github/manifest/callback");
    expect(m.setup_url).toContain("/api/integrations/github/install/callback");
  });

  it("requests ONLY read permissions (no write scopes)", () => {
    for (const value of Object.values(READ_ONLY_PERMISSIONS)) {
      expect(value).toBe("read");
    }
    for (const value of Object.values(m.default_permissions)) {
      expect(value).toBe("read");
    }
  });

  it("subscribes to the supported events and is private + non-oauth by default", () => {
    expect(m.default_events).toEqual([...MANIFEST_EVENTS]);
    expect(m.public).toBe(false);
    expect(m.request_oauth_on_install).toBe(false);
    expect(m.hook_attributes.active).toBe(true);
  });
});
