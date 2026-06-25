// Generates a Word (.docx) test guide for the RBAC / multi-tenant feature.
// Usage: node scripts/gen-test-doc.mjs
import JSZip from "jszip";
import { writeFileSync, mkdirSync } from "node:fs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Building blocks (WordprocessingML) ──────────────────────────────────────
const run = (t, { b = false, i = false, color, mono = false, sz } = {}) => {
  const rpr = [];
  if (b) rpr.push("<w:b/>");
  if (i) rpr.push("<w:i/>");
  if (color) rpr.push(`<w:color w:val="${color}"/>`);
  if (mono) rpr.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
  if (sz) rpr.push(`<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`);
  const rprXml = rpr.length ? `<w:rPr>${rpr.join("")}</w:rPr>` : "";
  return `<w:r>${rprXml}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
};
const para = (runs, { spacingAfter = 120 } = {}) =>
  `<w:p><w:pPr><w:spacing w:after="${spacingAfter}"/></w:pPr>${Array.isArray(runs) ? runs.join("") : runs}</w:p>`;
const h1 = (t) => `<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>${run(t, { b: true, sz: 36, color: "1F4E79" })}</w:p>`;
const h2 = (t) => `<w:p><w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr>${run(t, { b: true, sz: 28, color: "2E74B5" })}</w:p>`;
const bullet = (runs) =>
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="60"/></w:pPr>${Array.isArray(runs) ? runs.join("") : runs}</w:p>`;

const cell = (runs, { w = 2200, shade } = {}) => {
  const tcPr = `<w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${shade ? `<w:shd w:val="clear" w:fill="${shade}"/>` : ""}</w:tcPr>`;
  return `<w:tc>${tcPr}<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${Array.isArray(runs) ? runs.join("") : runs}</w:p></w:tc>`;
};
const rowOf = (cells) => `<w:tr>${cells.join("")}</w:tr>`;
const table = (rows, widths) => {
  const grid = `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
  const borders = `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/>`).join("")}</w:tblBorders>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${borders}</w:tblPr>${grid}${rows.join("")}</w:tbl><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;
};

// ── Data ────────────────────────────────────────────────────────────────────
const URL = "https://projectops360.vercel.app";
const PASS = "Demo1234!";
const PA = "4ef72bb0-f62f-48c7-87ed-0ecea5af7e8b"; // Mobile App Design
const PB = "5b5d24fd-b113-4fc1-9a2e-b63cc1a8f09e"; // Data Platform Migration

const headerRow = (cols) => rowOf(cols.map((c, idx) => cell(run(c, { b: true, color: "FFFFFF" }), { w: [2600, 2900, 2600, 4000][idx], shade: "2E74B5" })));
const dataRow = (cols) => rowOf(cols.map((c, idx) => cell(run(c, { mono: idx === 1 }), { w: [2600, 2900, 2600, 4000][idx] })));

const usersA = [
  ["PMO_ADMIN", "pmo@xxx-demo.io", PASS, "PMO Command Center · ve los 2 proyectos"],
  ["PROJECT_MANAGER", "pm1@xxx-demo.io", PASS, "PM Center · solo Mobile App Design"],
  ["PROJECT_MANAGER", "pm2@xxx-demo.io", PASS, "PM Center · solo Data Platform Migration"],
  ["PROJECT_MANAGER", "pm3@xxx-demo.io", PASS, "PM Center · miembro de Data Platform Migration"],
  ["TEAM_MEMBER", "dev1@xxx-demo.io", PASS, "My Work · Mobile App Design"],
  ["TEAM_MEMBER", "dev2@xxx-demo.io", PASS, "My Work · Mobile App Design"],
  ["TEAM_MEMBER", "des1@xxx-demo.io", PASS, "My Work · Mobile App Design"],
  ["TEAM_MEMBER", "dev3@xxx-demo.io", PASS, "My Work · Data Platform Migration"],
  ["TEAM_MEMBER", "dev4@xxx-demo.io", PASS, "My Work · Data Platform Migration"],
  ["TEAM_MEMBER", "des2@xxx-demo.io", PASS, "My Work · Data Platform Migration"],
];

const body = [
  para(run("ProjectOps360° — Guía de Pruebas: Roles, Multi-Tenant y PM/PMO Center", { b: true, sz: 40, color: "1F4E79" })),
  para([run("URL de la app: ", { b: true }), run(URL)]),
  para([run("Contraseña (todos los usuarios): ", { b: true }), run(PASS, { mono: true, b: true, color: "C00000" })]),
  para(run("Cada usuario aterriza en una experiencia distinta según su rol y solo ve los proyectos a los que tiene acceso. Ningún usuario ve datos de otra compañía.", { i: true })),

  h1("1. Compañía A — “XXX” (2 proyectos)"),
  para([run("• Mobile App Design", { b: true }), run("  (PM: pm1 · equipo: des1, dev1, dev2)")]),
  para([run("• Data Platform Migration", { b: true }), run("  (PM: pm2 · equipo: des2, dev3, dev4 · pm3 es miembro)")]),
  table(
    [headerRow(["Rol", "Email", "Contraseña", "Aterriza en / Debe ver"]), ...usersA.map(dataRow)],
    [2600, 2900, 2600, 4000]
  ),

  h1("2. Compañía B — “YYY Demo Co” (1 proyecto)"),
  table(
    [headerRow(["Rol", "Email", "Contraseña", "Debe ver"]),
     dataRow(["COMPANY_OWNER", "owner@yyy-demo.io", PASS, "Solo YYY Flagship Project"])],
    [2600, 2900, 2600, 4000]
  ),

  h1("3. Qué probar (checklist)"),
  h2("3.1 Landing y navegación por rol"),
  bullet([run("Entra con "), run("pmo@xxx-demo.io", { mono: true }), run(" → aterriza en PMO Command Center; el menú muestra Command Center, AI Operator, Reports, Team, Billing.")]),
  bullet([run("Entra con "), run("pm1@xxx-demo.io", { mono: true }), run(" → aterriza en PM Center (/pm); el menú muestra “PM Center” (sin Command Center ni Billing).")]),
  bullet([run("Entra con "), run("dev1@xxx-demo.io", { mono: true }), run(" → aterriza en My Work (/my-work) con sus tareas asignadas; sin PM/PMO Center.")]),
  h2("3.2 Aislamiento por proyecto (dentro de la misma compañía)"),
  bullet([run("pm1@", { mono: true }), run(" ve SOLO Mobile App Design; "), run("pm2@", { mono: true }), run(" ve SOLO Data Platform Migration. Un PM no ve el proyecto del otro PM.")]),
  bullet([run("dev1@", { mono: true }), run(" (team member) ve solo su proyecto/tareas asignadas.")]),
  h2("3.3 PMO ve todo su org"),
  bullet([run("pmo@", { mono: true }), run(" ve los 2 proyectos de XXX en /projects, pero NO los de YYY.")]),
  h2("3.4 Aislamiento entre compañías (cross-tenant)"),
  bullet([run("Entra con "), run("owner@yyy-demo.io", { mono: true }), run(" → solo ve “YYY Flagship Project”, nunca proyectos de XXX.")]),
  bullet([run("Estando logueado como owner@yyy, abre por URL directa un proyecto de XXX (ver sección 4) → debe dar 404 (Not Found).")]),

  h1("4. Prueba de acceso por URL directa"),
  para(run("Inicia sesión como un usuario que NO tenga acceso al proyecto (p. ej. owner@yyy-demo.io, o pm2@ para el proyecto de pm1) y pega estas URLs. Resultado esperado: 404.", { i: true })),
  para([run("Mobile App Design: ", { b: true }), run(`${URL}/projects/${PA}/workboard`, { mono: true })]),
  para([run("Data Platform Migration: ", { b: true }), run(`${URL}/projects/${PB}/workboard`, { mono: true })]),

  h1("5. Resultados ya verificados (RLS en producción)"),
  bullet(run("PMO_ADMIN: ve 2 proyectos. ✔")),
  bullet(run("Project Manager (no dueño): ve 1 proyecto (solo el suyo). ✔")),
  bullet(run("Team Member: ve 1 proyecto (asignado). ✔")),
  bullet(run("Dueño de otra compañía: ve 0 proyectos y 0 tareas de XXX (can_access_project = false). ✔")),

  para(run("Nota: si alguna contraseña no funciona, puede restablecerse al instante. Estos son usuarios de demo; no uses estas contraseñas en cuentas reales.", { i: true, color: "808080" })),
];

// ── docx assembly ───────────────────────────────────────────────────────────
const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

const zip = new JSZip();
zip.file("[Content_Types].xml", contentTypes);
zip.folder("_rels").file(".rels", rels);
const word = zip.folder("word");
word.file("document.xml", documentXml);
word.file("numbering.xml", numbering);
word.folder("_rels").file("document.xml.rels", docRels);

const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
mkdirSync("docs", { recursive: true });
const out = "docs/ProjectOps360-Guia-Pruebas-RBAC.docx";
writeFileSync(out, buf);
console.log("Wrote", out, buf.length, "bytes");
