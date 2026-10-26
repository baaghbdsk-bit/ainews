import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
await page.goto(BASE + "/benchmarks", { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise((r) => setTimeout(r, 5000));

const out = await page.evaluate(() => {
  const chip = document.querySelector(".audit-freshness");
  const icon = chip?.querySelector("svg");
  return {
    chipText: chip?.textContent?.trim() ?? null,
    chipVisible: chip ? chip.getBoundingClientRect().width > 0 : false,
    iconColorClass: icon?.getAttribute("class") ?? null,
    iconColor: icon ? getComputedStyle(icon).color : null,
    title: chip?.getAttribute("title") ?? null,
    // Generation label in the specs table (switch view to specs)
  };
});
console.log("=== freshness chip ===");
console.log(JSON.stringify(out, null, 2));

// API audit shape
const api = await (await fetch(BASE + "/api/benchmarks")).json();
console.log("\n=== /api/benchmarks audit ===");
console.log(JSON.stringify(api.audit, null, 2).slice(0, 900));
if (
  !api.success ||
  !api.audit ||
  api.audit.scoredModelCount + api.audit.unscoredModelCount !== api.audit.totalModels ||
  Object.keys(api.audit.benchmarkCoverage ?? {}).length === 0
) {
  throw new Error("Benchmark API audit is missing reconciled coverage data");
}
console.log(
  "coverage ledger:",
  api.audit.scoredModelCount,
  "scored models |",
  api.audit.unscoredModelCount,
  "unscored |",
  api.audit.uniqueSourceUrlCount,
  "source URLs"
);

// Generation filter round-trip
const all = await (await fetch(BASE + "/api/benchmarks?generation=all")).json();
const cur = await (await fetch(BASE + "/api/benchmarks?generation=current")).json();
const prev = await (await fetch(BASE + "/api/benchmarks?generation=previous")).json();
console.log("\n=== generation filter ===");
console.log("all:", all.count, "| current:", cur.count, "| previous:", prev.count,
  "| sum matches:", cur.count + prev.count === all.count ? "YES" : "NO");

// The removed filter must now be rejected.
const bad = await fetch(BASE + "/api/benchmarks?generation=historical-baseline");
console.log("historical-baseline filter →", bad.status, "(expect 400)");

// Specs view shows the live generation label.
await page.goto(BASE + "/benchmarks?view=specs", { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));
const specLabels = await page.evaluate(() =>
  [...document.querySelectorAll(".table-td-sub")].map((n) => n.textContent.trim()).slice(0, 8)
);
console.log("\n=== specs table generation labels ===");
console.log(JSON.stringify(specLabels));

await browser.close();
