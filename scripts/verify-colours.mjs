import { createRequire } from "node:module";
const require = createRequire("D:\\AiNews\\package.json");
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
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise((r) => setTimeout(r, 12000));

const out = await page.evaluate(() => {
  const rgb = (c) => (c.match(/\d+/g) ?? []).slice(0, 3).join(",");
  const badge = (cls) => {
    const el = document.querySelector(`.sidebar-badge-pill.${cls}`);
    return el ? rgb(getComputedStyle(el).color) : null;
  };
  const navIcon = (cls) => {
    const el = document.querySelector(`.sidebar-nav-item.item-${cls}.is-active .sidebar-nav-icon`);
    return el ? rgb(getComputedStyle(el).color) : null;
  };
  // The timeline topic dot for a real story row.
  const dot = document.querySelector(".topic-dot");
  return {
    badges: {
      models: badge("pill-models"),
      products: badge("pill-products"),
      research: badge("pill-research"),
      policy: badge("pill-policy"),
    },
    activeNavIcon: {
      models: navIcon("models"),
      products: navIcon("products"),
      research: navIcon("research"),
      policy: navIcon("policy"),
    },
    firstDotColor: dot ? rgb(getComputedStyle(dot).color) : null,
    firstDotClass: dot?.className ?? null,
    rows: document.querySelectorAll(".timeline-item").length,
    wordmark: document.querySelector(".wordmark")?.textContent?.trim(),
    bodyFont: getComputedStyle(document.body).fontFamily?.slice(0, 40),
    bodyBg: rgb(getComputedStyle(document.body).backgroundColor),
  };
});

console.log(JSON.stringify(out, null, 2));

// Expected legend from src/lib/story-colors.ts:
//   Policy=blue #7AA5FF -> 122,165,255
//   Models=violet #A78BFA -> 167,139,250
//   Products=cyan #2DD4BF -> 45,212,191
//   Research=amber #FBBF24 -> 251,191,36
const EXPECT = {
  models: "167,139,250",
  products: "45,212,191",
  research: "251,191,36",
  policy: "122,165,255",
};

let ok = true;
for (const [k, want] of Object.entries(EXPECT)) {
  const got = out.badges[k];
  const pass = got === want;
  if (!pass) ok = false;
  console.log(`  ${pass ? "PASS" : "FAIL"}  badge ${k.padEnd(9)} ${got} (want ${want})`);
}
console.log(ok ? "\nCOLOUR LEGEND CORRECT after the CSS split" : "\nCOLOUR LEGEND MISMATCH");

await browser.close();
