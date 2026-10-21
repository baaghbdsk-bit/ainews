/**
 * Verify the CSS split preserved every rule, in the same order.
 *
 * Compares the pre-split globals.css (git HEAD) against the concatenation of
 * the new src/styles/* modules in the order globals.css imports them.
 *
 *   node scripts/verify-css-split.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = "D:\\AiNews";

// The pre-split file, straight from git.
const OLD = execSync("git show HEAD:src/app/globals.css", {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

// The new modules, in the order globals.css imports them.
const entry = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
const imports = [...entry.matchAll(/@import\s+"([^"]+)"/g)]
  .map((m) => m[1])
  .filter((p) => p.includes("styles/"))
  .map((p) => path.join(ROOT, "src/app", p));

console.log("modules imported by globals.css:", imports.length);
for (const p of imports) console.log("   ", path.relative(ROOT, p).replace(/\\/g, "/"));

const NEW = imports.map((p) => readFileSync(p, "utf8")).join("\n");

/** Split CSS into an ordered list of {selector, body}, ignoring comments. */
function rules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let i = 0;
  const n = clean.length;
  while (i < n) {
    const open = clean.indexOf("{", i);
    if (open === -1) break;
    const sel = clean.slice(i, open).trim();
    // Find the matching close brace, accounting for nesting.
    let depth = 0;
    let j = open;
    for (; j < n; j++) {
      if (clean[j] === "{") depth++;
      else if (clean[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = clean.slice(open + 1, j);
    out.push({ sel: sel.replace(/\s+/g, " ").trim(), body: body.replace(/\s+/g, " ").trim() });
    i = j + 1;
  }
  return out;
}

/**
 * Strip leading at-statements (@import / @charset). The old globals.css opened
 * with `@import "tailwindcss";` before its first rule; the new entry file keeps
 * that import but the per-module content does not, so the statements have to
 * come out before the two rule lists can be compared.
 */
function stripLeadingAtStatements(css) {
  let s = css.replace(/^\s*@charset[^;]*;\s*/i, "");
  for (;;) {
    const m = s.match(/^\s*@import\s+[^;]+;\s*/i);
    if (!m) break;
    s = s.slice(m[0].length);
  }
  return s;
}

const oldRules = rules(stripLeadingAtStatements(OLD));
const newRules = rules(NEW);

console.log(`\nold rules: ${oldRules.length}`);
console.log(`new rules: ${newRules.length}`);

// The old file had @import "tailwindcss" as its first statement; the new one
// has it too, so counts should line up closely.
const norm = (r) => `${r.sel}{${r.body}}`;
const oldNorm = oldRules.map(norm);
const newNorm = newRules.map(norm);

// Multiset comparison: what was lost, what was added.
const count = (arr) => {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
};
const oldCount = count(oldNorm);
const newCount = count(newNorm);

const lost = [];
for (const [rule, c] of oldCount) {
  const d = c - (newCount.get(rule) ?? 0);
  if (d > 0) lost.push({ rule, count: d });
}
const added = [];
for (const [rule, c] of newCount) {
  const d = c - (oldCount.get(rule) ?? 0);
  if (d > 0) added.push({ rule, count: d });
}

console.log(`\nrules lost: ${lost.reduce((a, b) => a + b.count, 0)}`);
for (const l of lost.slice(0, 15)) console.log("  LOST:", l.rule.slice(0, 160));
console.log(`rules added: ${added.reduce((a, b) => a + b.count, 0)}`);
for (const a of added.slice(0, 15)) console.log("  ADDED:", a.rule.slice(0, 160));

// Order comparison: is the new sequence the old sequence with only the
// differences above removed?
let cursor = 0;
const outOfOrder = [];
for (const r of newNorm) {
  const idx = oldNorm.indexOf(r, cursor);
  if (idx === -1) continue;
  cursor = idx + 1;
}
console.log(`\nnew sequence is a subsequence of old: ${cursor > 0}`);

// Order comparison: remove the lost rules from the old list, then compare
// position-by-position with the new list.
const lostKeys = new Set(lost.map((l) => l.rule));
const oldFiltered = oldNorm.filter((r) => !lostKeys.has(r));
let mismatches = 0;
const len = Math.min(oldFiltered.length, newNorm.length);
for (let i = 0; i < len; i++) {
  if (oldFiltered[i] !== newNorm[i]) {
    if (mismatches < 8) {
      console.log(`\nfirst ${mismatches + 1} positional mismatch(es):`);
      console.log("  idx", i);
      console.log("   old:", oldFiltered[i].slice(0, 150));
      console.log("   new:", newNorm[i].slice(0, 150));
    }
    mismatches++;
  }
}
console.log(`\npositional mismatches after removing lost rules: ${mismatches}`);

// Every module in src/styles must be imported, or its rules are dead.
const allFiles = readdirSync(path.join(ROOT, "src/styles"))
  .filter((f) => f.endsWith(".css"))
  .map((f) => `../styles/${f}`);
const notImported = allFiles.filter((f) => !imports.some((p) => p.replace(/\\/g, "/").endsWith(f.replace("../styles/", "styles/"))));
console.log(`\ncss files in src/styles: ${allFiles.length}, imported: ${imports.length}`);
console.log("NOT imported (dead rules):", notImported.length ? notImported.join(", ") : "none");

process.exit(lost.length || mismatches || notImported.length ? 1 : 0);
