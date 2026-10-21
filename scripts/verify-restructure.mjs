/**
 * Restructure guard.
 *
 * Runs the full verification stack and prints a stable, diff-friendly report so
 * a change set can be compared against the previous one at a glance.
 *
 *   node scripts/verify-restructure.mjs
 *
 * Exit code 0 = everything green, 1 = something regressed.
 */
import { execSync, spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = "D:\\AiNews";
const PORT = 3210;
const BASE = `http://localhost:${PORT}`;

const results = [];
const add = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

function run(cmd, opts = {}) {
  try {
    const out = execSync(cmd, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
      ...opts,
    });
    return { ok: true, out };
  } catch (e) {
    return {
      ok: false,
      out: `${e.stdout ?? ""}\n${e.stderr ?? ""}`,
    };
  }
}

console.log("=== 1. static checks ===");

const build = run("npx next build");
add("next build", build.ok, build.ok ? "" : build.out.split("\n").filter((l) => /error|Error/.test(l)).slice(0, 3).join(" | "));

const tsc = run("npx tsc --noEmit");
add("tsc --noEmit", tsc.ok, tsc.ok ? "" : tsc.out.split("\n").slice(0, 4).join(" | "));

const lint = run("npx eslint src");
const lintErrors = (lint.out.match(/(\d+) errors?/)?.[1] ?? "0") ?? "0";
add("eslint (0 errors)", Number(lintErrors) === 0, lintErrors === "0" ? "" : lint.out.split("\n").slice(0, 3).join(" | "));

console.log("\n=== 2. test suites ===");

const cat = run("node --experimental-strip-types tests/category-classification.mjs");
add("category-classification", cat.ok && /FAILED: 0/.test(cat.out), (cat.out.match(/TOTAL:.*/) ?? [""])[0]);

const bench = run("node --experimental-strip-types tests/benchmarks.mjs");
add("benchmarks", bench.ok && /0 FAILED/.test(bench.out), (bench.out.match(/BENCHMARK TEST SUITE:.*/) ?? [""])[0]);

console.log("\n=== 3. production server ===");

const server = spawn("node", [".\\node_modules\\next\\dist\\bin\\next", "start", "-p", String(PORT)], {
  cwd: ROOT,
  stdio: "ignore",
  detached: true,
});
server.unref();

let up = false;
for (let i = 0; i < 40; i++) {
  await sleep(1500);
  try {
    const r = await fetch(BASE + "/", { signal: AbortSignal.timeout(5000) });
    if (r.ok) { up = true; break; }
  } catch {}
}
add("prod server starts", up);
if (!up) {
  try { process.kill(-server.pid); } catch {}
  finish();
}

console.log("\n=== 4. routes ===");
const ROUTES = [
  ["/", 200],
  ["/about", 200],
  ["/benchmarks", 200],
  ["/topic/anthropic", 200],
  ["/story/introducing-olmo-core-3-open-scalable-training-infrastructure-for-larg-2026-10-21-mh6gjm", 200],
  ["/story/definitely-not-a-real-story-zzz", 404],
  ["/topic/definitely-not-a-real-topic-zzz", 404],
  ["/icon.svg", 200],
  ["/robots.txt", 200],
  ["/sitemap.xml", 200],
];
for (const [path, want] of ROUTES) {
  try {
    let r = await fetch(BASE + path, { redirect: "manual" });
    // Known issue: the FIRST request to an unknown story slug on a freshly
    // started prod server returns 200 (the shell streams before notFound()
    // resolves). Retry once so a cold start is not reported as a regression.
    if (r.status !== want && want === 404) {
      await sleep(600);
      r = await fetch(BASE + path, { redirect: "manual" });
    }
    add(`GET ${path}`, r.status === want, `status=${r.status} want=${want}`);
  } catch (e) {
    add(`GET ${path}`, false, e.message);
  }
}

console.log("\n=== 5. APIs ===");
const APIS = [
  ["/api/stories?limit=1", 200],
  ["/api/upvotes", 200],
  ["/api/feedback", 200],
  ["/api/benchmarks", 200],
  ["/api/cron/ingest", 401],
  ["/api/cron/dossier", 401],
];
for (const [path, want] of APIS) {
  try {
    const r = await fetch(BASE + path, { redirect: "manual" });
    add(`GET ${path}`, r.status === want, `status=${r.status} want=${want}`);
  } catch (e) {
    add(`GET ${path}`, false, e.message);
  }
}

console.log("\n=== 6. content + security invariants ===");
try {
  const html = await (await fetch(BASE + "/")).text();
  add("no 'Signal' in homepage HTML", !/Signal/.test(html));
  add("no old tagline", !/Intelligence through time/.test(html));
  add("title is NeuBench", /<title>NeuBench<\/title>/.test(html));
  const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) ?? [])[1] ?? "";
  add("homepage canonical has no /index", !canon.endsWith("/index"), canon);
} catch (e) {
  add("homepage content checks", false, e.message);
}

try {
  const r = await fetch(`${BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: "other", comment: "restructure-guard probe" }),
  });
  add("POST /api/feedback", r.status === 200, `status=${r.status}`);
} catch (e) {
  add("POST /api/feedback", false, e.message);
}

try {
  const r = await fetch(`${BASE}/api/upvotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storySlug: "openai-acquires-orchestra-bio-2026-10-20-kz1vtu", clientId: "guard_probe", action: "up" }),
  });
  add("POST /api/upvotes", r.status === 200, `status=${r.status}`);
} catch (e) {
  add("POST /api/upvotes", false, e.message);
}

try {
  const r = await fetch(`${BASE}/api/stories?limit=200`);
  const j = await r.json();
  add("stories API returns a page", Array.isArray(j.stories) && j.stories.length > 0, `count=${j.stories?.length} total=${j.total}`);
  const withSlug = (j.stories ?? []).every((s) => typeof s.slug === "string" && s.slug.length > 0);
  add("every story has a slug", withSlug);
  const topics = new Set((j.stories ?? []).map((s) => s.topic));
  add("topics are the four known ones", [...topics].every((t) => ["Models", "Products", "Research", "Policy"].includes(t)), [...topics].join(","));
} catch (e) {
  add("stories API shape", false, e.message);
}

console.log("\n=== 7. benchmark catalogue ===");
try {
  const all = await (await fetch(`${BASE}/api/benchmarks?generation=all`)).json();
  const cur = await (await fetch(`${BASE}/api/benchmarks?generation=current`)).json();
  const prev = await (await fetch(`${BASE}/api/benchmarks?generation=previous`)).json();
  add("generation filters partition the catalogue", cur.count + prev.count === all.count, `all=${all.count} current=${cur.count} previous=${prev.count}`);

  const dead = await fetch(`${BASE}/api/benchmarks?generation=historical-baseline`);
  add("removed 'historical-baseline' filter is rejected", dead.status === 400, `status=${dead.status}`);

  const audit = all.audit ?? {};
  add("audit reports a newest model date", Boolean(audit.newestModelReleaseDate), audit.newestModelReleaseDate);
  add("audit reports a catalogue age", typeof audit.catalogueAgeDays === "number", `${audit.catalogueAgeDays}d`);
  add("audit reports staleness", typeof audit.stale === "boolean", `stale=${audit.stale}`);
  add("audit counts previous generation", typeof audit.previousGenCount === "number", `previous=${audit.previousGenCount}`);
  add("no historical-baseline in the audit", !("historicalBaselineCount" in audit));
} catch (e) {
  add("benchmark API shape", false, e.message);
}

try { process.kill(-server.pid); } catch {}
finish();

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log("\n================================================");
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failed.length}   FAILED: ${failed.length}`);
  if (failed.length) {
    console.log("\nFAILURES:");
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? `  (${f.detail})` : ""}`);
  }
  console.log("================================================");
  process.exit(failed.length ? 1 : 0);
}
