/**
 * Prints the semantic section map of a CSS file.
 *
 *   node scripts/css-sections.mjs [file]
 *
 * For every top-level comment block that introduces a section, prints:
 *   <commentStart> | <commentEnd> | <nextRuleStart> | <first selector of section>
 *
 * The "nextRuleStart" value is a safe cut point: nothing but whitespace and
 * comments sits between the end of the previous rule and that line.
 */
import fs from "node:fs";

const file = process.argv[2] ?? "src/app/globals.css";
const outFile = process.argv[3] ?? null;
const raw = fs.readFileSync(file, "utf8");
const lines = raw.split(/\r?\n/);

const lineStarts = [0];
for (let i = 0; i < raw.length; i++) if (raw[i] === "\n") lineStarts.push(i + 1);
const lineOf = (idx) => {
  let lo = 0,
    hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= idx) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
};

// Pass 1: find top-level rules and the comment blocks that precede them.
const rules = [];
const comments = [];
let depth = 0;
let ruleStart = -1;
let rulePreview = "";
let inString = null;
let inComment = false;
let commentStart = -1;

for (let i = 0; i < raw.length; i++) {
  const ch = raw[i];
  const next = raw[i + 1];

  if (inComment) {
    if (ch === "*" && next === "/") {
      inComment = false;
      i++;
      if (depth === 0) comments.push({ start: lineOf(commentStart), end: lineOf(i), startIdx: commentStart, endIdx: i + 1 });
    }
    continue;
  }
  if (inString) {
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === inString) inString = null;
    continue;
  }
  if (ch === "/" && next === "*") {
    inComment = true;
    commentStart = i;
    i++;
    continue;
  }
  if (ch === '"' || ch === "'") {
    inString = ch;
    continue;
  }
  if (ch === "{") {
    if (depth === 0) {
      ruleStart = i;
      rulePreview = raw.slice(lineStarts[lineOf(i) - 1], i).trim().replace(/\s+/g, " ");
    }
    depth++;
    continue;
  }
  if (ch === "}") {
    depth--;
    if (depth === 0) rules.push({ start: lineOf(ruleStart), end: lineOf(i), preview: rulePreview });
    continue;
  }
}

const out = [];
const say = (line = "") => out.push(line);

say(`file: ${file}  (${lines.length} lines, ${rules.length} top-level rules)`);
say("");
say("commentStart | commentEnd | nextRule | selector");
say("--- section headers (top-level) ---");
for (const c of comments) {
  const next = rules.find((r) => r.start > c.end);
  const preview = next ? next.preview.slice(0, 70) : "(end of file)";
  say(`${String(c.start).padStart(6)} | ${String(c.end).padStart(6)} | ${String(next ? next.start : 0).padStart(6)} | ${preview}`);
}

say("");
say("--- rule boundaries (candidate cut points) ---");
for (const r of rules) {
  say(`${String(r.start).padStart(6)} | ${String(r.end).padStart(6)} | ${r.preview.slice(0, 70)}`);
}

say("");
say("--- banner comments (==== style) ---");
for (let i = 0; i < lines.length; i++) {
  if (/^\s*\/?\*?\s*={5,}\s*$/.test(lines[i])) {
    say(`${String(i + 1).padStart(6)} | ${(lines[i + 1] ?? "").trim()} ${(lines[i + 2] ?? "").trim()}`.trim());
  }
}

say("");
say("--- top-level comment text ---");
for (const c of comments) {
  const body = raw
    .slice(c.startIdx, c.endIdx)
    .replace(/^\/\*+/, "")
    .replace(/\*+\/$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!body) continue;
  say(`${String(c.start).padStart(6)} | ${body.slice(0, 150)}`);
}

const text = out.join("\n") + "\n";
if (outFile) fs.writeFileSync(outFile, text, "utf8");
else process.stdout.write(text);
