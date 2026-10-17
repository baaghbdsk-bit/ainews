/**
 * HTTP regression suite — run against a live server (dev or production):
 *
 *   node tests/http.mjs                 # defaults to http://localhost:3000
 *   BASE_URL=http://localhost:3000 node tests/http.mjs
 *
 * Covers routes and status codes (including real 404s for unknown story/topic
 * slugs), metadata (canonical/robots), payload size, caching headers, the
 * paginated stories API, cron auth, and reflected-payload safety.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const results = [];

function record(id, name, ok, detail = "") {
  results.push({ id, name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id} ${name}${detail ? " — " + detail : ""}`);
}

function check(id, name, ok, detail) {
  record(id, name, !!ok, detail);
}

async function get(path, init) {
  const res = await fetch(BASE + path, init);
  const text = await res.text();
  return { res, text, headers: res.headers };
}

async function main() {
  // Server reachable?
  try {
    const probe = await fetch(BASE + "/", { signal: AbortSignal.timeout(5000) });
    if (!probe.ok) throw new Error(`status ${probe.status}`);
  } catch (err) {
    console.error(`Cannot reach ${BASE} (${err.message ?? err}). Start the server first: npm run start (or npm run dev).`);
    process.exit(2);
  }

  /* ---------- Routes & status codes ---------- */
  const home = await get("/");
  check("H01", "GET / → 200", home.res.status === 200, `status=${home.res.status}`);

  check(
    "H02",
    "Homepage HTML payload < 600KB",
    home.text.length < 600 * 1024,
    `${(home.text.length / 1024).toFixed(0)}KB`,
  );

  // A real, currently-published story (fetched live so the suite never rots
  // when ingested stories rotate out).
  const apiFirst = await (await fetch(`${BASE}/api/stories?limit=1`)).json();
  const liveSlug = apiFirst?.stories?.[0]?.slug;
  check("H03", "GET /api/stories?limit=1 → published story", !!liveSlug, `slug=${liveSlug ?? "none"}`);

  if (liveSlug) {
    const story = await get(`/story/${liveSlug}`);
    check("H04", "GET /story/[live] → 200", story.res.status === 200, `status=${story.res.status}`);
    const storyCanonical = /<link rel="canonical" href="([^"]*)"/.exec(story.text)?.[1] ?? "";
    check(
      "H05",
      "Story page has self-referencing canonical",
      storyCanonical === `https://ainews-smel.vercel.app/story/${liveSlug}`,
      storyCanonical,
    );
    check("H06", "Story page has <h1>", /<h1>/.test(story.text), "");
  }

  const story404 = await get("/story/qa-definitely-missing-story-zzz");
  check("H07", "GET /story/[unknown] → 404", story404.res.status === 404, `status=${story404.res.status}`);
  check(
    "H08",
    "Story 404 carries noindex",
    /name="robots" content="noindex"/.test(story404.text),
    "",
  );

  const topic = await get("/topic/anthropic");
  check("H09", "GET /topic/anthropic → 200", topic.res.status === 200, `status=${topic.res.status}`);
  const topicCanonical = /<link rel="canonical" href="([^"]*)"/.exec(topic.text)?.[1] ?? "";
  check(
    "H10",
    "Topic page has self-referencing canonical",
    topicCanonical === "https://ainews-smel.vercel.app/topic/anthropic",
    topicCanonical,
  );

  const topic404 = await get("/topic/qa-definitely-missing-topic-zzz");
  check("H11", "GET /topic/[unknown] → 404", topic404.res.status === 404, `status=${topic404.res.status}`);
  check(
    "H12",
    "Topic 404 carries noindex",
    /name="robots" content="noindex"/.test(topic404.text),
    "",
  );

  /* ---------- Home metadata ---------- */
  const homeCanonical = /<link rel="canonical" href="([^"]*)"/.exec(home.text)?.[1] ?? "";
  check(
    "H13",
    "Homepage has canonical",
    homeCanonical.startsWith("https://ainews-smel.vercel.app"),
    homeCanonical,
  );

  /* ---------- robots / sitemap ---------- */
  const robots = await get("/robots.txt");
  check("H14", "GET /robots.txt → 200", robots.res.status === 200, `status=${robots.res.status}`);
  check(
    "H15",
    "robots.txt disallows /api/",
    /Disallow:\s*\/api\//.test(robots.text),
    robots.text.split("\n")[0],
  );

  const sitemap = await get("/sitemap.xml");
  const sitemapUrls = (sitemap.text.match(/<loc>/g) ?? []).length;
  check("H16", "GET /sitemap.xml → 200", sitemap.res.status === 200, `status=${sitemap.res.status}`);
  check("H17", "sitemap has > 500 URLs", sitemapUrls > 500, `urls=${sitemapUrls}`);

  /* ---------- Caching headers ---------- */
  for (const [id, label, path] of [
    ["H18", "Homepage Cache-Control is CDN-public", "/"],
    ["H19", "Story Cache-Control is CDN-public", `/story/${liveSlug ?? "x"}`],
    ["H20", "Topic Cache-Control is CDN-public", "/topic/anthropic"],
  ]) {
    if (!liveSlug && id === "H19") continue;
    const cc = (await get(path)).headers.get("cache-control") ?? "";
    check(id, label, /public/.test(cc) && /s-maxage=/.test(cc), cc);
  }

  // Vercel honors s-maxage for the edge cache but strips it from the
  // client-facing header, so accept either the header (local) or an observed
  // edge HIT on a repeat request (production).
  const apiCacheProbe = await get("/api/stories?limit=1");
  const apiCC = apiCacheProbe.headers.get("cache-control") ?? "";
  const apiCacheRepeat = await get("/api/stories?limit=1");
  const edgeCache = apiCacheRepeat.headers.get("x-vercel-cache") ?? "";
  const apiSMaxAge = Number(/s-maxage=(\d+)/.exec(apiCC)?.[1] ?? NaN);
  const shortEdgeTtl = Number.isFinite(apiSMaxAge) && apiSMaxAge > 0 && apiSMaxAge <= 300;
  check(
    "H21",
    "Stories API is CDN-cached for a short window",
    /public/.test(apiCC) &&
      !/no-store/.test(apiCC) &&
      (shortEdgeTtl || /HIT|STALE/.test(edgeCache)),
    `cc="${apiCC}" x-vercel-cache="${edgeCache}" s-maxage=${Number.isFinite(apiSMaxAge) ? apiSMaxAge : "n/a"}`,
  );

  const cronCC = (await get("/api/cron/ingest")).headers.get("cache-control") ?? "";
  check("H22", "Cron route is not CDN-cached", !/s-maxage/.test(cronCC), cronCC || "(no cache-control)");

  /* ---------- Stories API: pagination, clamping, filters ---------- */
  const page0 = await (await fetch(`${BASE}/api/stories?offset=0&limit=5`)).json();
  const page1 = await (await fetch(`${BASE}/api/stories?offset=5&limit=5`)).json();
  check("H23", "API limit=5 returns 5 stories", page0.stories?.length === 5, `got=${page0.stories?.length}`);
  check(
    "H24",
    "API pagination returns distinct pages",
    page0.stories?.[0]?.slug !== page1.stories?.[0]?.slug,
    `${page0.stories?.[0]?.slug} vs ${page1.stories?.[0]?.slug}`,
  );
  check(
    "H25",
    "API reports a stable total",
    typeof page0.matching === "number" && page0.matching >= page0.stories.length,
    `matching=${page0.matching} returned=${page0.stories?.length}`,
  );

  const clamped = await (await fetch(`${BASE}/api/stories?limit=999`)).json();
  check("H26", "API clamps limit to 200", clamped.stories?.length <= 200, `got=${clamped.stories?.length}`);

  const beyond = await (await fetch(`${BASE}/api/stories?offset=100000&limit=5`)).json();
  check("H27", "API offset beyond end → empty page", Array.isArray(beyond.stories) && beyond.stories.length === 0, `got=${beyond.stories?.length}`);

  const topicPage = await (await fetch(`${BASE}/api/stories?q=anthropic&limit=50`)).json();
  const haystackOf = (s) =>
    `${s.title} ${s.summary} ${s.significance} ${s.source} ${s.topic} ${s.date}`.toLowerCase();
  const topicBad = (topicPage.stories ?? []).filter((s) => !haystackOf(s).includes("anthropic"));
  check(
    "H28",
    "API q=anthropic: every result matches the search haystack",
    topicPage.stories?.length > 0 && topicBad.length === 0,
    `results=${topicPage.stories?.length} nonMatching=${topicBad.length}`,
  );

  const companyPage = await (await fetch(`${BASE}/api/stories?company=Anthropic&limit=50`)).json();
  const companyBad = (companyPage.stories ?? []).filter((s) => s.company !== "Anthropic");
  check(
    "H29",
    "API company filter: every result matches",
    companyPage.stories?.length > 0 && companyBad.length === 0,
    `results=${companyPage.stories?.length} nonMatching=${companyBad.length}`,
  );

  const noSuch = await (await fetch(`${BASE}/api/stories?company=NoSuchCompanyLtd&limit=50`)).json();
  check("H30", "API unknown company → empty results", noSuch.stories?.length === 0, `got=${noSuch.stories?.length}`);

  /* ---------- Cron auth ---------- */
  const cronNoAuth = await get("/api/cron/ingest");
  check("H31", "GET /api/cron/ingest without auth → 401", cronNoAuth.res.status === 401, `status=${cronNoAuth.res.status}`);

  const cronBadAuth = await get("/api/cron/ingest", { headers: { authorization: "Bearer wrong-secret" } });
  check("H32", "GET /api/cron/ingest with wrong secret → 401", cronBadAuth.res.status === 401, `status=${cronBadAuth.res.status}`);

  const cronPost = await get("/api/cron/ingest", { method: "POST" });
  check("H33", "POST /api/cron/ingest → 405", cronPost.res.status === 405, `status=${cronPost.res.status}`);

  const dossierNoAuth = await get("/api/cron/dossier");
  check("H34", "GET /api/cron/dossier without auth → 401", dossierNoAuth.res.status === 401, `status=${dossierNoAuth.res.status}`);

  /* ---------- Reflected-payload safety ---------- */
  const xssHome = await get("/?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
  check(
    "H35",
    "Script payload in URL is not reflected raw into HTML",
    xssHome.res.status === 200 && !xssHome.text.includes("<script>alert(1)</script>"),
    `status=${xssHome.res.status} reflected=${xssHome.text.includes("<script>alert(1)</script>")}`,
  );

  const xssApiRes = await fetch(`${BASE}/api/stories?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E&limit=5`);
  const xssApiType = xssApiRes.headers.get("content-type") ?? "";
  check(
    "H36",
    "API with script payload returns JSON (not HTML)",
    xssApiRes.status === 200 && xssApiType.includes("application/json"),
    `status=${xssApiRes.status} type=${xssApiType}`,
  );

  const xssStory = await get("/story/%3Cscript%3Ealert(1)%3C%2Fscript%3E");
  check(
    "H37",
    "Script payload as story slug → 404, not reflected",
    xssStory.res.status === 404 && !xssStory.text.includes("<script>alert(1)</script>"),
    `status=${xssStory.res.status}`,
  );

  /* ---------- Summary ---------- */
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log("\n===== HTTP SUMMARY =====");
  console.log(`PASS=${passed} FAIL=${failed} TOTAL=${results.length}`);
  if (failed > 0) {
    for (const r of results.filter((r) => !r.ok)) console.log(`FAIL\t${r.id}\t${r.name}\t${r.detail}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("HTTP SUITE ERROR:", err);
  process.exit(1);
});
