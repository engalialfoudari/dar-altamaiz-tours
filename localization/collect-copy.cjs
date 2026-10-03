// Build the offline translation inventory from customer-facing app source.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const strings = new Set();
const locations = {};
function add(text, file) {
  text = text.replace(/\s+/g, " ").trim();
  if (!text || text.length > 8000 || /https?:\/\/|^[./@#]|^[A-Za-z0-9_-]{18,}$/.test(text)) return;
  if (!/[\u0600-\u06ff]/.test(text) && !/[A-Za-z]/.test(text)) return;
  if (!/[\u0600-\u06ff\s]/.test(text) && !/^[A-Z][a-z]{1,20}$/.test(text)) return;
  if (/^(?:SELECT|INSERT|UPDATE|CREATE|ALTER|DELETE|console\.|function |return |import )/.test(text)) return;
  if (/\b(?:function|window|document|XMLHttpRequest|localStorage|sessionStorage)\b/.test(text) || /(?:=>|;\s*(?:var|let|const)|\.[A-Za-z]+\()/.test(text)) return;
  strings.add(text);
  (locations[text] ??= []).push(file);
}
function collect(file) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!ts.isImportDeclaration(node.parent) && !ts.isPropertyAssignment(node.parent) || node.parent.initializer === node) add(node.text, path.relative(root, file));
    }
    if (ts.isTemplateExpression(node)) {
      add(node.head.text + node.templateSpans.map((span, i) => `{${i}}${span.literal.text}`).join(""), path.relative(root, file));
    }
    if (ts.isJsxText(node)) add(node.text, path.relative(root, file));
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast).endsWith("Text")) {
      let index = 0;
      add(node.children.map(child => ts.isJsxText(child) ? child.text : `{${index++}}`).join(""), path.relative(root, file));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(tsx?|js)$/.test(file) && !/\.(test|spec)\./.test(file)) collect(file);
  }
}
for (const dir of ["app", "components", "utils", "lib"]) walk(path.join(root, dir));
const inventory = [...strings].sort();
const output = process.argv[2] || "/tmp/dt-turkish-copy.json";
fs.writeFileSync(output, JSON.stringify(inventory, null, 2));
fs.writeFileSync(output.replace(/\.json$/, "-locations.json"), JSON.stringify(locations));
console.log(JSON.stringify({ strings: inventory.length, bytes: fs.statSync(output).size }));