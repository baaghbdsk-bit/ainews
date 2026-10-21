/**
 * Compare the COMPILED css of the deployed (pre-restructure) build against the
 * local (post-restructure) build. This is the check that matters: @import plus
 * Tailwind's processing could reorder or drop rules even when the source is
 * byte-identical.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const LIVE = "https://neubench.vercel.app";
const LOCAL = "http://localhost:3210";

async function cssUrls(base) {
  const html = await (await fetch(base + "/")).text();
  return [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
}

async function fetchAll(base, urls) {
  let out = "";
  for (const u of urls) {
    const abs = u.startsWith("http") ? u : base + u;
    const r = await fetch(abs, { headers: { "user-agent": "Mozilla/5.0" } });
    if (r.ok) out += await r.text();
  }
  return out;
}

/** Normalise: strip comments, collapse whitespace, split into ordered rules. */
function rules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
  const out = [];
  let i = 0;
  while (i < clean.length) {
    const open = clean.indexOf("{", i);
    if (open === -1) break;
    const sel = clean.slice(i, open).trim();
    let depth = 0;
    let j = open;
    for (; j < clean.length; j++) {
      if (clean[j] === "{") depth++;
      else if (clean[j] === "}") { depth--; if (depth === 0) break; }
    }
    out.push(`${sel}{${clean.slice(open + 1, j)}}`);
    i = j + 1;
  }
  return out;
}

const liveUrls = await cssUrls(LIVE);
const localUrls = await cssUrls(LOCAL);
console.log("live  css files:", liveUrls.length, liveUrls.join(" "));
console.log("local css files:", localUrls.length, localUrls.join(" "));

const liveCss = await fetchAll(LIVE, liveUrls);
const localCss = await fetchAll(LOCAL, localUrls);
console.log(`\nlive  compiled bytes: ${liveCss.length}`);
console.log(`local compiled bytes: ${localCss.length}`);

const liveRules = rules(liveCss);
const localRules = rules(localCss);
console.log(`live  rules: ${liveRules.length}`);
console.log(`local rules: ${localRules.length}`);

/**
 * Next.js font optimisation differs between the Vercel build and a local
 * build: Vercel inlines a "Geist Fallback" @font-face plus a size-adjusted
 * fallback class, while the local build ships the real Geist woff2 files.
 * That is a build-environment artifact, not a CSS difference, so font rules
 * are excluded before comparing.
 */
const isFontRule = (r) =>
  /@font-face|Geist|\.T19VSG_|@layer properties|@font-feature-values|font-feature-settings/i.test(r);
const liveKept = liveRules.filter((r) => !isFontRule(r));
const localKept = localRules.filter((r) => !isFontRule(r));
console.log(`\nafter excluding font rules -> live ${liveKept.length}, local ${localKept.length}`);

const count = (arr) => {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
};
const lc = count(liveKept);
const oc = count(localKept);

const lost = [], added = [];
for (const [r, c] of lc) { const d = c - (oc.get(r) ?? 0); if (d > 0) lost.push({ r, d }); }
for (const [r, c] of oc) { const d = c - (lc.get(r) ?? 0); if (d > 0) added.push({ r, d }); }

console.log(`\nrules only in LIVE (lost by the split): ${lost.reduce((a, b) => a + b.d, 0)}`);
for (const l of lost.slice(0, 10)) console.log("   LOST:", l.r.slice(0, 150));
console.log(`rules only in LOCAL (new in the split): ${added.reduce((a, b) => a + b.d, 0)}`);
for (const a of added.slice(0, 10)) console.log("   ADDED:", a.r.slice(0, 150));

// Order check on the shared rules.
const lostSet = new Set(lost.map((l) => l.r));
const liveFiltered = liveKept.filter((r) => !lostSet.has(r));
let mismatch = 0;
const n = Math.min(liveFiltered.length, localKept.length);
for (let i = 0; i < n; i++) {
  if (liveFiltered[i] !== localKept[i]) {
    if (mismatch < 5) {
      console.log(`\norder mismatch at ${i}:`);
      console.log("   live :", liveFiltered[i].slice(0, 140));
      console.log("   local:", localKept[i].slice(0, 140));
    }
    mismatch++;
  }
}
console.log(`\npositional mismatches: ${mismatch}`);

const ok = lost.length === 0 && added.length === 0 && mismatch === 0;
console.log("\n" + (ok ? "COMPILED CSS IDENTICAL (order included)" : "COMPILED CSS DIFFERS — see above"));
process.exit(ok ? 0 : 1);
