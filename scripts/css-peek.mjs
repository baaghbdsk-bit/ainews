/**
 * Prints numbered line ranges from a text file.
 *
 *   node scripts/css-peek.mjs src/app/globals.css 240 300
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
const lines = readFileSync(file, "utf8").split(/\r?\n/);
const ranges = [];
for (let i = 3; i < process.argv.length; i += 2) {
  ranges.push([Number(process.argv[i]), Number(process.argv[i + 1])]);
}
for (const [from, to] of ranges) {
  console.log(`\n----- ${file} : ${from}-${to} -----`);
  for (let i = from; i <= to && i <= lines.length; i++) {
    console.log(`${String(i).padStart(6)}| ${lines[i - 1]}`);
  }
}
