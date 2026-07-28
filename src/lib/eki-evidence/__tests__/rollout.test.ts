import { afterEach, describe, expect, it } from "vitest";
import { ekiRolloutOrganizations, hasEkiRolloutScope, isEkiRolloutOrganization } from "../rollout";

const ORG = "dc8205c1-c4a2-4f3c-83b9-0e1589590c13";
const OTHER = "5124cdfd-061f-4c6e-96ca-08989c6bd03c";
const original = process.env.EKI_TRUST_ORGANIZATION_IDS;

afterEach(() => {
  if (original === undefined) delete process.env.EKI_TRUST_ORGANIZATION_IDS;
  else process.env.EKI_TRUST_ORGANIZATION_IDS = original;
});

describe("controlled rollout scope", () => {
  /**
   * The single most important property. Treating an empty allowlist as
   * "everyone" would mean one missing environment variable exposes every tenant
   * on the platform — the exact failure this list exists to prevent.
   */
  it("enables nobody when the allowlist is unset or empty", () => {
    delete process.env.EKI_TRUST_ORGANIZATION_IDS;
    expect(hasEkiRolloutScope()).toBe(false);
    expect(isEkiRolloutOrganization(ORG)).toBe(false);

    process.env.EKI_TRUST_ORGANIZATION_IDS = "";
    expect(isEkiRolloutOrganization(ORG)).toBe(false);

    process.env.EKI_TRUST_ORGANIZATION_IDS = "   ,  ,";
    expect(ekiRolloutOrganizations().size).toBe(0);
    expect(isEkiRolloutOrganization(ORG)).toBe(false);
  });

  it("enables exactly the organizations named, and no others", () => {
    process.env.EKI_TRUST_ORGANIZATION_IDS = ORG;
    expect(isEkiRolloutOrganization(ORG)).toBe(true);
    expect(isEkiRolloutOrganization(OTHER)).toBe(false);
  });

  it("tolerates whitespace and case without widening the scope", () => {
    process.env.EKI_TRUST_ORGANIZATION_IDS = `  ${ORG.toUpperCase()} , ${OTHER}  `;
    expect(isEkiRolloutOrganization(ORG)).toBe(true);
    expect(isEkiRolloutOrganization(OTHER)).toBe(true);
    expect(ekiRolloutOrganizations().size).toBe(2);
  });

  it("refuses a null, undefined or empty organization", () => {
    process.env.EKI_TRUST_ORGANIZATION_IDS = ORG;
    expect(isEkiRolloutOrganization(null)).toBe(false);
    expect(isEkiRolloutOrganization(undefined)).toBe(false);
    expect(isEkiRolloutOrganization("")).toBe(false);
  });

  /** A partial identifier must never match a listed one. */
  it("does not match on a prefix", () => {
    process.env.EKI_TRUST_ORGANIZATION_IDS = ORG;
    expect(isEkiRolloutOrganization(ORG.slice(0, 8))).toBe(false);
    expect(isEkiRolloutOrganization(ORG + "x")).toBe(false);
  });
});
