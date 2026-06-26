import { describe, it, expect } from "vitest";
import {
  localizedPath,
  buildActionLinks,
  allowedHrefSet,
  isSafeInternalHref,
  describeActionLinksForPrompt,
} from "../action-links";

describe("localizedPath (as-needed prefixing)", () => {
  it("leaves English routes unprefixed", () => {
    expect(localizedPath("/team", "en")).toBe("/team");
  });
  it("prefixes Spanish routes", () => {
    expect(localizedPath("/team", "es")).toBe("/es/team");
  });
});

describe("buildActionLinks", () => {
  it("resolves People to the working route for the UI locale", () => {
    const en = buildActionLinks("en", { module: "people_permissions" });
    const team = en.find((l) => l.key === "people.teamDirectory");
    expect(team?.label).toBe("People");
    expect(team?.href).toBe("/team");

    const es = buildActionLinks("es", { module: "people_permissions" });
    expect(es.find((l) => l.key === "people.teamDirectory")?.href).toBe("/es/team");
    expect(es.find((l) => l.key === "people.teamDirectory")?.label).toBe("Personas");
  });

  it("marks non-deep-linkable actions with a button name and no href", () => {
    const es = buildActionLinks("es", { module: "people_permissions" });
    const add = es.find((l) => l.key === "people.addPerson");
    expect(add?.href).toBeNull();
    expect(add?.action).toBe("Crear acceso");
  });

  it("ranks the current module's destinations first", () => {
    const links = buildActionLinks("en", { module: "projects" });
    expect(links.findIndex((l) => l.key === "projects.list")).toBeLessThan(
      links.findIndex((l) => l.key === "settings.workspace"),
    );
  });
});

describe("isSafeInternalHref (anti-invention / anti-unsafe)", () => {
  const allowed = allowedHrefSet(buildActionLinks("es", { module: "people_permissions" }));

  it("allows an allow-listed internal route", () => {
    expect(isSafeInternalHref("/es/team", allowed)).toBe(true);
  });
  it("rejects an internal-looking route that is NOT allow-listed (invented)", () => {
    expect(isSafeInternalHref("/es/secret-admin", allowed)).toBe(false);
  });
  it("rejects external and unsafe schemes", () => {
    expect(isSafeInternalHref("https://evil.com", allowed)).toBe(false);
    expect(isSafeInternalHref("//evil.com", allowed)).toBe(false);
    expect(isSafeInternalHref("javascript:alert(1)", allowed)).toBe(false);
    expect(isSafeInternalHref("mailto:x@y.z", allowed)).toBe(false);
  });
});

describe("describeActionLinksForPrompt", () => {
  it("lists linkable routes and mention-only buttons", () => {
    const out = describeActionLinksForPrompt(buildActionLinks("en", { module: "people_permissions" }));
    expect(out).toContain("People → /team");
    expect(out).toContain("Create login");
  });
});
