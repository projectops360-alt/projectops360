import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const templateDirectory = path.join(process.cwd(), "supabase", "templates");
const confirmationTemplates = [
  "confirmation.html",
  "recovery.html",
  "invite.html",
  "magic-link.html",
  "email-change.html",
];

describe("Supabase Auth email templates", () => {
  it.each(confirmationTemplates)("uses ConfirmationURL in %s", (fileName) => {
    const content = fs.readFileSync(path.join(templateDirectory, fileName), "utf8");
    expect(content).toContain("{{ .ConfirmationURL }}");
  });

  it("uses the one-time token for reauthentication", () => {
    const content = fs.readFileSync(path.join(templateDirectory, "reauthentication.html"), "utf8");
    expect(content).toContain("{{ .Token }}");
  });

  it.each([...confirmationTemplates, "reauthentication.html"])(
    "contains the approved brand and support address in %s",
    (fileName) => {
      const content = fs.readFileSync(path.join(templateDirectory, fileName), "utf8");
      expect(content).toContain("ProjectOps360°");
      expect(content).toContain("support@projectops360.com");
    },
  );
});
