/**
 * Maps the top-level structure of a CSS file: every top-level rule and every
 * at-rule (media query, supports, layer) with its line range.
 *
 *   node scripts/css-map.mjs src/app/globals.css
 */
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "src/app/globals.css";
const src = readFileSync(file, "utf8");
const lines = src.split(/\r?\n/);

let depth = 0;
let start = 0;
let buf = "";
const stack = [];

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const line = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const trimmed = line.trim();

  if (depth === 0) {
    buf = trimmed ? buf + " " + trimmed : buf;
  }

  for (const ch of line) {
    if (ch === "{") {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const header = buf.replace(/\s+/g, " ").replace(/\s*\{\s*$/, "").trim();
        stack.push({ header, start, end: i + 1 });
        buf = "";
      }
    }
  }
}

for (const r of stack) {
  console.log(`${String(r.start).padStart(6)}-${String(r.end).padStart(6)}  ${r.header.slice(0, 150)}`);
}
console.log(`\nTOTAL LINES: ${lines.length}  TOP-LEVEL BLOCKS: ${stack.length}`);
