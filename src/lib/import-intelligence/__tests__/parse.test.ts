import { describe, it, expect } from "vitest";
import {
  detectFileType,
  parseCsvText,
  extractMarkdownTables,
  extractHtmlTables,
  parseImportFile,
  ImportParseError,
} from "../parse";

describe("detectFileType", () => {
  it("maps extensions and rejects unknown ones", () => {
    expect(detectFileType("plan.xlsx")).toBe("xlsx");
    expect(detectFileType("Plan Final.CSV")).toBe("csv");
    expect(detectFileType("project.json")).toBe("json");
    expect(detectFileType("scope.docx")).toBe("docx");
    expect(detectFileType("plan.pdf")).toBe("pdf");
    expect(detectFileType("notes.md")).toBe("md");
    expect(detectFileType("malware.exe")).toBeNull();
  });
});

describe("parseCsvText", () => {
  it("parses quoted fields with embedded commas and quotes", () => {
    const rows = parseCsvText('Task,Owner\n"Pour, foundation","María ""Mary"" López"\nFraming,Bob');
    expect(rows).toEqual([
      ["Task", "Owner"],
      ["Pour, foundation", 'María "Mary" López'],
      ["Framing", "Bob"],
    ]);
  });

  it("handles semicolon-delimited files", () => {
    const rows = parseCsvText("Tarea;Responsable\nCimentación;Juan");
    expect(rows[1]).toEqual(["Cimentación", "Juan"]);
  });

  it("skips fully empty lines", () => {
    const rows = parseCsvText("a,b\n\n1,2\n\n");
    expect(rows).toHaveLength(2);
  });
});

describe("extractMarkdownTables", () => {
  it("captures tables with their preceding heading as name", () => {
    const md = "# Plan\n\n## Tasks\n\n| Task | Owner |\n|---|---|\n| Dig | Ana |\n| Pour | Luis |\n";
    const tables = extractMarkdownTables(md);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("Tasks");
    expect(tables[0].headers).toEqual(["Task", "Owner"]);
    expect(tables[0].rows).toEqual([["Dig", "Ana"], ["Pour", "Luis"]]);
  });
});

describe("extractHtmlTables", () => {
  it("parses simple table markup and decodes entities", () => {
    const html = "<p>x</p><table><tr><td>Task</td><td>Owner</td></tr><tr><td>Q&amp;A pass</td><td>Eve</td></tr></table>";
    const tables = extractHtmlTables(html);
    expect(tables[0].headers).toEqual(["Task", "Owner"]);
    expect(tables[0].rows[0]).toEqual(["Q&A pass", "Eve"]);
  });
});

describe("parseImportFile", () => {
  const enc = (s: string) => new TextEncoder().encode(s);

  it("rejects unsupported, empty, and invalid-JSON files", async () => {
    await expect(parseImportFile("a.exe", enc("x"))).rejects.toMatchObject({ code: "unsupported_file_type" });
    await expect(parseImportFile("a.csv", new Uint8Array(0))).rejects.toMatchObject({ code: "empty_file" });
    await expect(parseImportFile("a.json", enc("{nope"))).rejects.toMatchObject({ code: "invalid_json" });
    await expect(parseImportFile("a.csv", enc("\n\n"))).rejects.toMatchObject({ code: "no_extractable_content" });
  });

  it("parses a CSV into one table", async () => {
    const parsed = await parseImportFile("tasks.csv", enc("Task,Duration\nDig,3\nPour,5"));
    expect(parsed.fileType).toBe("csv");
    expect(parsed.tables).toHaveLength(1);
    expect(parsed.tables[0].rows).toHaveLength(2);
  });

  it("parses JSON and keeps the raw object", async () => {
    const parsed = await parseImportFile("p.json", enc('{"project":{"name":"X"},"tasks":[]}'));
    expect(parsed.rawJson).toMatchObject({ project: { name: "X" } });
  });

  it("ImportParseError exposes a stable code", () => {
    const e = new ImportParseError("file_too_large");
    expect(e.code).toBe("file_too_large");
  });
});
