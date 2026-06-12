// ============================================================================
// Project Import Intelligence — File Parsers
// ============================================================================
// Converts uploaded files (XLSX, CSV, JSON, DOCX, PDF, TXT/MD) into the
// ParsedFile intermediate representation: plain text + uniform tables.
// Parsers never execute embedded content (no formulas evaluated, no macros,
// no HTML rendered) — only static text/values are read.
// ============================================================================

import type { ImportFileType, ParsedFile, ParsedTable } from "@/types/import-intelligence";

// ── File type detection ─────────────────────────────────────────────────────

const EXTENSION_MAP: Record<string, ImportFileType> = {
  xlsx: "xlsx",
  xlsm: "xlsx",
  csv: "csv",
  json: "json",
  docx: "docx",
  pdf: "pdf",
  txt: "txt",
  md: "md",
  markdown: "md",
};

/** Detect file type from the file name only — client metadata is not trusted. */
export function detectFileType(fileName: string): ImportFileType | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? null;
}

// ── CSV ─────────────────────────────────────────────────────────────────────

/** RFC-4180-ish CSV parser: quoted fields, escaped quotes, CRLF. Also accepts
 *  semicolon-delimited files (common in es-locale exports). */
export function parseCsvText(text: string): string[][] {
  const delimiter = pickDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function pickDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  if (tabs > commas && tabs > semis) return "\t";
  return semis > commas ? ";" : ",";
}

function rowsToTable(name: string, rows: string[][]): ParsedTable | null {
  if (rows.length === 0) return null;
  const headers = rows[0].map((h) => h.trim());
  if (headers.every((h) => h === "")) return null;
  return { name, headers, rows: rows.slice(1).map((r) => r.map((c) => c.trim())) };
}

// ── Markdown tables / headings ──────────────────────────────────────────────

export function extractMarkdownTables(text: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;
  let lastHeading = "table";
  while (i < lines.length) {
    const line = lines[i];
    const headingMatch = line.match(/^#{1,6}\s+(.+)/);
    if (headingMatch) lastHeading = headingMatch[1].trim();

    if (line.trim().startsWith("|") && lines[i + 1]?.trim().match(/^\|?[\s:|-]+\|?$/)) {
      const headers = splitMdRow(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        rows.push(splitMdRow(lines[j]));
        j++;
      }
      tables.push({ name: lastHeading, headers, rows });
      i = j;
    } else {
      i++;
    }
  }
  return tables;
}

function splitMdRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

// ── HTML tables (DOCX via mammoth) ──────────────────────────────────────────

export function extractHtmlTables(html: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  for (const [idx, tableHtml] of tableMatches.entries()) {
    const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    const rows: string[][] = rowMatches.map((rowHtml) =>
      (rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map((cell) =>
        decodeEntities(cell.replace(/<[^>]+>/g, "")).trim(),
      ),
    );
    const table = rowsToTable(`table ${idx + 1}`, rows);
    if (table) tables.push(table);
  }
  return tables;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// ── Main entry ──────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export class ImportParseError extends Error {
  constructor(
    public code:
      | "unsupported_file_type"
      | "file_too_large"
      | "empty_file"
      | "invalid_json"
      | "corrupted_file"
      | "no_extractable_content",
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** Parse a file buffer into the intermediate representation. */
export async function parseImportFile(
  fileName: string,
  buffer: Uint8Array,
): Promise<ParsedFile> {
  const fileType = detectFileType(fileName);
  if (!fileType) throw new ImportParseError("unsupported_file_type");
  if (buffer.byteLength === 0) throw new ImportParseError("empty_file");
  if (buffer.byteLength > MAX_FILE_BYTES) throw new ImportParseError("file_too_large");

  switch (fileType) {
    case "csv": {
      const text = new TextDecoder("utf-8").decode(buffer);
      const rows = parseCsvText(text);
      const table = rowsToTable(fileName, rows);
      if (!table || table.rows.length === 0) throw new ImportParseError("no_extractable_content");
      return { fileType, rawText: text.slice(0, 200_000), rawJson: null, tables: [table], metadata: { rowCount: table.rows.length } };
    }

    case "json": {
      const text = new TextDecoder("utf-8").decode(buffer);
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new ImportParseError("invalid_json");
      }
      return { fileType, rawText: text.slice(0, 200_000), rawJson: json, tables: [], metadata: {} };
    }

    case "txt":
    case "md": {
      const text = new TextDecoder("utf-8").decode(buffer);
      if (text.trim().length === 0) throw new ImportParseError("no_extractable_content");
      return {
        fileType,
        rawText: text.slice(0, 200_000),
        rawJson: null,
        tables: extractMarkdownTables(text),
        metadata: {},
      };
    }

    case "xlsx": {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
      } catch {
        throw new ImportParseError("corrupted_file", "Could not read the Excel file. It may be corrupted or password-protected.");
      }
      const tables: ParsedTable[] = [];
      const textParts: string[] = [];
      workbook.eachSheet((sheet) => {
        const rows: string[][] = [];
        sheet.eachRow({ includeEmpty: false }, (row) => {
          const cells: string[] = [];
          // row.values is 1-based; cell.text resolves formula results, never formulas
          for (let c = 1; c <= row.cellCount; c++) {
            cells.push(String(row.getCell(c).text ?? "").trim());
          }
          rows.push(cells);
        });
        const table = rowsToTable(sheet.name, rows);
        if (table && table.rows.length > 0) {
          tables.push(table);
          textParts.push(`## ${sheet.name}\n${table.headers.join(" | ")}\n${table.rows.map((r) => r.join(" | ")).join("\n")}`);
        }
      });
      if (tables.length === 0) throw new ImportParseError("no_extractable_content", "The Excel file has no rows to import.");
      return { fileType, rawText: textParts.join("\n\n").slice(0, 200_000), rawJson: null, tables, metadata: { sheetCount: tables.length } };
    }

    case "docx": {
      const mammoth = await import("mammoth");
      let html = "";
      let text = "";
      try {
        const nodeBuffer = Buffer.from(buffer);
        const htmlResult = await mammoth.convertToHtml({ buffer: nodeBuffer });
        html = htmlResult.value;
        const textResult = await mammoth.extractRawText({ buffer: nodeBuffer });
        text = textResult.value;
      } catch {
        throw new ImportParseError("corrupted_file", "Could not read the Word document.");
      }
      if (text.trim().length === 0) throw new ImportParseError("no_extractable_content");
      return {
        fileType,
        rawText: text.slice(0, 200_000),
        rawJson: null,
        tables: extractHtmlTables(html),
        metadata: {},
      };
    }

    case "pdf": {
      try {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(buffer);
        const { totalPages, text } = await extractText(pdf, { mergePages: true });
        const fullText = (Array.isArray(text) ? text.join("\n") : text).trim();
        if (fullText.length === 0) {
          throw new ImportParseError(
            "no_extractable_content",
            "No text could be extracted. The PDF may be scanned — OCR import is not available yet.",
          );
        }
        return { fileType, rawText: fullText.slice(0, 200_000), rawJson: null, tables: [], metadata: { totalPages } };
      } catch (e) {
        if (e instanceof ImportParseError) throw e;
        throw new ImportParseError("corrupted_file", "Could not read the PDF. It may be corrupted or password-protected.");
      }
    }
  }
}
