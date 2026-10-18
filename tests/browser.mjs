/**
 * Browser E2E suite — exercises real client-side interactions in headless
 * Chrome against a running server:
 *
 *   node tests/browser.mjs
 *   BASE_URL=http://localhost:3000 node tests/browser.mjs
 *
 * Requires Google Chrome (override with CHROME_PATH) and puppeteer-core
 * (devDependency). Screenshots land in tests/shots/.
 *
 * Filtering against production can take a couple of seconds (serverless cold
 * merge), so every wait below polls the real end-state (DOM predicate) instead
 * of sleeping a fixed amount and hoping.
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const SHOTS = path.join(__dirname, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function record(id, name, status, detail) {
  results.push({ id, name, status, detail });
  console.log(`[${status}] ${id} ${name}${detail ? " — " + detail : ""}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WAIT_TIMEOUT = 30000;

async function collectConsole(page) {
  const logs = [];
  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error" || t === "warning") logs.push(`console.${t}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => logs.push(`pageerror: ${err.message}`));
  return logs;
}

function hydrationIssues(logs) {
  return logs.filter((l) => /hydrat|did not match|server rendered|Text content/i.test(l));
}

async function gotoTimeline(page) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".timeline-item", { timeout: 90000 });
  await page.waitForSelector(".company-select-trigger", { timeout: 30000 });
  await sleep(600); // let hydration settle
}

async function shownCount(page) {
  return page.$eval(".filter-result-count", (el) => {
    const m = el.textContent.match(/Showing\s+([\d,]+)\s+of\s+([\d,]+)/);
    return m ? { shown: Number(m[1].replace(/,/g, '')), total: Number(m[2].replace(/,/g, '')) } : null;
  });
}

/** Poll a DOM predicate until it passes (or time out), instead of sleeping.
 *  `predicate` runs in the page and receives `...args`. */
async function waitUntil(page, predicate, args = [], timeout = WAIT_TIMEOUT) {
  try {
    await page.waitForFunction(predicate, { timeout, polling: 100 }, ...args);
    return true;
  } catch {
    return false;
  }
}

/** Watch the page's /api/stories traffic so waits can key off "the request
 *  that the interaction triggered has actually finished". */
function trackApi(page) {
  const state = { inflight: 0, done: 0 };
  const isApi = (u) => u.includes("/api/stories");
  page.on("request", (r) => {
    if (isApi(r.url())) state.inflight++;
  });
  const settle = (r) => {
    if (isApi(r.url())) {
      state.inflight = Math.max(0, state.inflight - 1);
      state.done++;
    }
  };
  page.on("requestfinished", settle);
  page.on("requestfailed", settle);
  return state;
}

/** Wait until at least one /api/stories request started after this call has
 *  finished, and no others are in flight for `quietMs`. */
async function waitForApi(state, { quietMs = 500, timeout = WAIT_TIMEOUT } = {}) {
  const start = Date.now();
  const baseDone = state.done;
  let quietSince = null;
  while (Date.now() - start < timeout) {
    if (state.done > baseDone && state.inflight === 0) {
      quietSince ??= Date.now();
      if (Date.now() - quietSince >= quietMs) return true;
    } else {
      quietSince = null;
    }
    await sleep(100);
  }
  return false;
}

(async () => {
  // Server reachable?
  try {
    const probe = await fetch(BASE + "/", { signal: AbortSignal.timeout(5000) });
    if (!probe.ok) throw new Error(`status ${probe.status}`);
  } catch (err) {
    console.error(`Cannot reach ${BASE} (${err.message ?? err}). Start the server first: npm run start (or npm run dev).`);
    process.exit(2);
  }
  if (!fs.existsSync(CHROME)) {
    console.error(`Chrome not found at ${CHROME}. Set CHROME_PATH to a Chrome/Chromium executable.`);
    process.exit(2);
  }

  // Live story slug, so the suite never rots when ingested stories rotate.
  let liveSlug = null;
  try {
    const api = await (await fetch(`${BASE}/api/stories?limit=1`)).json();
    liveSlug = api?.stories?.[0]?.slug ?? null;
  } catch {
    /* handled below */
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    /* ---------- T01 Hydration (desktop, fresh load) ---------- */
    {
      const page = await browser.newPage();
      const logs = await collectConsole(page);
      await gotoTimeline(page);
      const hyd = hydrationIssues(logs);
      const otherErrors = logs.filter((l) => !hydrationIssues([l]).length);
      await page.screenshot({ path: path.join(SHOTS, "t01-home-desktop.png") });
      if (hyd.length === 0)
        record(
          "T01",
          "Hydration clean on home (desktop)",
          "PASS",
          `0 hydration issues; ${otherErrors.length} other console errors${otherErrors.length ? ": " + otherErrors.slice(0, 2).join(" | ").slice(0, 200) : ""}`,
        );
      else record("T01", "Hydration clean on home (desktop)", "FAIL", hyd.slice(0, 3).join(" | ").slice(0, 400));
      await page.close();
    }

    /* ---------- T02 Search filtering ---------- */
    {
      const page = await browser.newPage();
      const logs = await collectConsole(page);
      const api = trackApi(page);
      await gotoTimeline(page);
      const before = await shownCount(page);
      await page.click("#archive-filter-search");
      await page.type("#archive-filter-search", "anthropic", { delay: 20 });
      // Search matches title/summary/significance/source/topic/date (not just
      // titles), so assert the DOM renders exactly the API's first filtered page.
      const apiPage = await (await fetch(`${BASE}/api/stories?q=anthropic&offset=0&limit=60`)).json();
      const apiTitles = (apiPage.stories ?? []).map((s) => s.title.trim());
      const matched = await waitUntil(
        page,
        (expected, prev) => {
          const els = [...document.querySelectorAll(".timeline-item .story-title-text")];
          const titles = els.map((e) => (e.textContent || "").trim());
          const m = document.querySelector(".filter-result-count")?.textContent?.match(/Showing\s+([\d,]+)\s+of\s+([\d,]+)/);
          const shown = m ? Number(m[1].replace(/,/g, '')) : 0;
          if (shown >= prev || shown === 0) return false;
          if (titles.length !== expected.length) return false;
          return titles.every((t, i) => t === expected[i]);
        },
        [apiTitles, before.shown],
      );
      await waitForApi(api);
      const after = await shownCount(page);
      const domTitles = await page.$$eval(".timeline-item .story-title-text", (els) =>
        els.map((e) => (e.textContent || "").trim()),
      );
      const titlesMatchApi = domTitles.length === apiTitles.length && domTitles.every((t, i) => t === apiTitles[i]);
      const domRows = domTitles.length;
      const expectedDom = apiTitles.length;
      await page.screenshot({ path: path.join(SHOTS, "t02-search-anthropic.png") });
      const ok =
        matched &&
        after.shown < before.shown &&
        after.shown > 0 &&
        apiPage.stories?.length > 0 &&
        titlesMatchApi &&
        domRows === expectedDom;
      record(
        "T02",
        "Search filtering (term 'anthropic') — DOM matches API filtered page",
        ok ? "PASS" : "FAIL",
        `before=${before.shown}/${before.total} after=${after.shown}/${after.total} domRows=${domRows} expectedDom=${expectedDom} apiResults=${apiPage.stories?.length} titlesMatchApi=${titlesMatchApi}${hydrationIssues(logs).length ? " HYDRATION: " + hydrationIssues(logs)[0].slice(0, 150) : ""}`,
      );
      await page.close();
    }

    /* ---------- T03 Company dropdown: open, flush position, select, filter ---------- */
    {
      const page = await browser.newPage();
      const logs = await collectConsole(page);
      const api = trackApi(page);
      await gotoTimeline(page);
      const before = await shownCount(page);
      await page.click(".company-select-trigger");
      await page.waitForSelector(".company-select-panel", { visible: true, timeout: 5000 });
      const geo = await page.evaluate(() => {
        const t = document.querySelector(".company-select-trigger").getBoundingClientRect();
        const p = document.querySelector(".company-select-panel").getBoundingClientRect();
        return { tTop: t.top, tBottom: t.bottom, tLeft: t.left, tWidth: t.width, pTop: p.top, pLeft: p.left, pWidth: p.width };
      });
      const flushGap = Math.abs(geo.pTop - geo.tBottom);
      const leftAligned = Math.abs(geo.pLeft - geo.tLeft) < 2;
      const widthMatch = Math.abs(geo.pWidth - geo.tWidth) < 2;
      const options = await page.$$eval(".company-select-option", (els) => els.map((e) => e.textContent.trim()));
      const clicked = await page.evaluate(() => {
        const btn = [...document.querySelectorAll(".company-select-option")].find((b) => b.textContent.trim() === "Anthropic");
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      const applied = await waitUntil(
        page,
        (prev) => {
          const label = document.querySelector(".company-select-trigger-label")?.textContent?.trim();
          const m = document.querySelector(".filter-result-count")?.textContent?.match(/Showing\s+([\d,]+)\s+of\s+([\d,]+)/);
          const shown = m ? Number(m[1].replace(/,/g, '')) : 0;
          return label === "Anthropic" && shown > 0 && shown < prev && !document.querySelector(".company-select-panel");
        },
        [before.shown],
      );
      await waitForApi(api);
      const panelGone = (await page.$(".company-select-panel")) === null;
      const triggerLabel = await page.$eval(".company-select-trigger-label", (el) => el.textContent.trim());
      const after = await shownCount(page);
      await page.screenshot({ path: path.join(SHOTS, "t03-company-selected.png") });
      const ok =
        flushGap < 2 &&
        leftAligned &&
        widthMatch &&
        clicked &&
        applied &&
        panelGone &&
        triggerLabel === "Anthropic" &&
        after.shown < before.shown &&
        after.shown > 0;
      record(
        "T03",
        "Company dropdown: open, flush-to-field panel, select Anthropic, filter applies",
        ok ? "PASS" : "FAIL",
        `flushGap=${flushGap.toFixed(1)}px leftAligned=${leftAligned} widthMatch=${widthMatch} options=${options.length} panelClosedAfterSelect=${panelGone} triggerLabel="${triggerLabel}" shown ${before.shown}→${after.shown}${hydrationIssues(logs).length ? " HYDRATION" : ""}`,
      );
      await page.close();
    }

    /* ---------- T04 Company dropdown flip-up when space below is scarce ---------- */
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 420 }); // short viewport forces flip
      await gotoTimeline(page);
      await page.click(".company-select-trigger");
      await page.waitForSelector(".company-select-panel", { visible: true, timeout: 5000 });
      const flip = await page.evaluate(() => {
        const panel = document.querySelector(".company-select-panel");
        const t = document.querySelector(".company-select-trigger").getBoundingClientRect();
        const p = panel.getBoundingClientRect();
        return {
          hasUpClass: panel.classList.contains("panel-open-up"),
          pBottom: p.bottom,
          tTop: t.top,
          pTop: p.top,
          tBottom: t.bottom,
        };
      });
      const adjacent = flip.hasUpClass
        ? Math.abs(flip.pBottom - flip.tTop) < 2
        : Math.abs(flip.pTop - flip.tBottom) < 2;
      await page.screenshot({ path: path.join(SHOTS, "t04-company-flip.png") });
      record(
        "T04",
        "Company dropdown flip-up in short viewport",
        adjacent ? "PASS" : "FAIL",
        `panelOpenUp=${flip.hasUpClass} adjacentToTrigger=${adjacent} (pBottom=${flip.pBottom.toFixed(0)} tTop=${flip.tTop.toFixed(0)} pTop=${flip.pTop.toFixed(0)} tBottom=${flip.tBottom.toFixed(0)})`,
      );
      await page.close();
    }

    /* ---------- T05 Period selects (year, month, combined) ---------- */
    {
      const page = await browser.newPage();
      const api = trackApi(page);
      await gotoTimeline(page);
      const all = await shownCount(page);
      await page.select('select[aria-label="Filter by year"]', "2026");
      await waitForApi(api);
      const y2026 = await shownCount(page);
      const yearsVisible = await page.$$eval(".timeline-node", (els) =>
        els.map((n) => n.getAttribute("aria-label") || ""),
      );
      const all2026 = yearsVisible.length > 0 && yearsVisible.every((l) => /,\s*2026$/.test(l));
      await page.select('select[aria-label="Filter by month"]', "10");
      await waitForApi(api);
      const ym = await shownCount(page);
      const monthsVisible = await page.$$eval(".timeline-node", (els) =>
        els.map((n) => n.getAttribute("aria-label") || ""),
      );
      const allOct = monthsVisible.length > 0 && monthsVisible.every((l) => /^Oct /.test(l) && /,\s*2026$/.test(l));
      await page.select('select[aria-label="Filter by month"]', "all");
      await waitForApi(api);
      const yOnly = await shownCount(page);
      await page.select('select[aria-label="Filter by year"]', "all");
      await waitForApi(api);
      const reset = await shownCount(page);
      await page.screenshot({ path: path.join(SHOTS, "t05-period.png") });
      const ok =
        !!y2026 &&
        y2026.shown < all.shown &&
        y2026.shown > 0 &&
        all2026 &&
        !!ym &&
        ym.shown <= y2026.shown &&
        allOct &&
        !!yOnly &&
        yOnly.shown === y2026.shown &&
        !!reset &&
        reset.shown === all.shown;
      record(
        "T05",
        "Period selects: year=2026, month=Oct, reset",
        ok ? "PASS" : "FAIL",
        `all=${all.shown} y2026=${y2026?.shown} (allRows2026=${all2026}) ym=${ym?.shown} (allOct=${allOct}) yOnly=${yOnly?.shown} reset=${reset?.shown}`,
      );
      await page.close();
    }

    /* ---------- T06 Clear filters ---------- */
    {
      const page = await browser.newPage();
      const api = trackApi(page);
      await gotoTimeline(page);
      const baseline = await shownCount(page);
      await page.type("#archive-filter-search", "gemini");
      await page.select('select[aria-label="Filter by year"]', "2026");
      await page.click(".company-select-trigger");
      await page.waitForSelector(".company-select-panel", { visible: true, timeout: 5000 });
      await page.evaluate(() => {
        const b = [...document.querySelectorAll(".company-select-option")].find((x) => x.textContent.trim() === "OpenAI");
        if (b) b.click();
      });
      await waitForApi(api, { quietMs: 800 });
      const filtered = await shownCount(page);
      await page.click(".filter-clear-button");
      await waitForApi(api);
      const afterClear = await shownCount(page);
      const searchVal = await page.$eval("#archive-filter-search", (el) => el.value);
      const yearVal = await page.$eval('select[aria-label="Filter by year"]', (el) => el.value);
      const companyLabel = await page.$eval(".company-select-trigger-label", (el) => el.textContent.trim());
      await page.screenshot({ path: path.join(SHOTS, "t06-clear.png") });
      const ok =
        !!filtered &&
        filtered.shown < baseline.shown &&
        !!afterClear &&
        afterClear.shown === baseline.shown &&
        searchVal === "" &&
        yearVal === "all" &&
        companyLabel === "All companies";
      record(
        "T06",
        "Clear filters resets search + year + company",
        ok ? "PASS" : "FAIL",
        `baseline=${baseline.shown} filtered=${filtered?.shown} afterClear=${afterClear?.shown} search="${searchVal}" year=${yearVal} company="${companyLabel}"`,
      );
      await page.close();
    }

    /* ---------- T07 Row expand / collapse / exclusivity ---------- */
    {
      const page = await browser.newPage();
      await gotoTimeline(page);
      const expanders = await page.$$(".expand-icon");
      if (expanders.length < 2) {
        record("T07", "Row expand/collapse", "FAIL", `only ${expanders.length} expand buttons found`);
      } else {
        await expanders[0].click();
        const opened1 = await waitUntil(page, () => {
          const open = document.querySelector(".story-detail-wrap.is-open");
          const btn = document.querySelector(".expand-icon[aria-expanded='true']");
          return !!open && !!btn && open.getBoundingClientRect().height > 20;
        });
        const s1 = await page.evaluate(() => {
          const open = document.querySelector(".story-detail-wrap.is-open");
          const btn = document.querySelector(".expand-icon[aria-expanded='true']");
          return {
            openId: open ? open.id : null,
            ariaExpandedTrue: !!btn,
            detailVisible: open ? open.getBoundingClientRect().height > 20 : false,
            btnLabel: btn ? btn.getAttribute("aria-label") : null,
          };
        });
        const expanders2 = await page.$$(".expand-icon");
        await expanders2[1].click();
        const switched = await waitUntil(page, () => {
          const opens = [...document.querySelectorAll(".story-detail-wrap.is-open")];
          return opens.length === 1 && opens[0] !== null;
        });
        const s2 = await page.evaluate(() => {
          const opens = [...document.querySelectorAll(".story-detail-wrap.is-open")];
          return { openCount: opens.length, openId: opens[0] ? opens[0].id : null };
        });
        const openBtn = await page.$(".expand-icon[aria-expanded='true']");
        if (openBtn) await openBtn.click();
        const collapsed = await waitUntil(page, () => document.querySelectorAll(".story-detail-wrap.is-open").length === 0 && !document.querySelector(".expand-icon[aria-expanded='true']"));
        const s3 = await page.evaluate(() => ({
          openCount: document.querySelectorAll(".story-detail-wrap.is-open").length,
          anyExpanded: !!document.querySelector(".expand-icon[aria-expanded='true']"),
        }));
        await page.screenshot({ path: path.join(SHOTS, "t07-expand.png") });
        const ok =
          opened1 &&
          s1.openId &&
          s1.ariaExpandedTrue &&
          s1.detailVisible &&
          s1.btnLabel &&
          s1.btnLabel.startsWith("Hide") &&
          switched &&
          s2.openCount === 1 &&
          collapsed &&
          s3.openCount === 0 &&
          !s3.anyExpanded;
        record(
          "T07",
          "Row expand/collapse, aria-expanded, single-open exclusivity",
          ok ? "PASS" : "FAIL",
          `expand1=${JSON.stringify(s1)} switchTo2=${JSON.stringify(s2)} collapse=${JSON.stringify(s3)}`,
        );
      }
      await page.close();
    }

    /* ---------- T08 Infinite scroll grows the list ---------- */
    {
      const page = await browser.newPage();
      await gotoTimeline(page);
      const initialRows = (await page.$$(".timeline-item")).length;
      const total = (await shownCount(page)).total;
      let grew = false;
      let rows = initialRows;
      for (let i = 0; i < 8 && rows < Math.min(total, 240); i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        grew = await waitUntil(
          page,
          (initial) => document.querySelectorAll(".timeline-item").length > initial,
          [initialRows],
          12000,
        );
        rows = (await page.$$(".timeline-item")).length;
        if (grew) break;
      }
      const sentinelExists = (await page.$(".timeline-sentinel")) !== null;
      await page.screenshot({ path: path.join(SHOTS, "t08-infscroll.png") });
      record(
        "T08",
        "Infinite scroll appends more rows",
        grew ? "PASS" : "FAIL",
        `initialRows=${initialRows} afterScroll=${rows} totalStories=${total} sentinelPresent=${sentinelExists}`,
      );
      await page.close();
    }

    /* ---------- T09 Mobile layout: filter panel reachability ---------- */
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await gotoTimeline(page);
      const state = await page.evaluate(() => {
        const panel = document.querySelector(".archive-filter-panel");
        const panelStyle = panel ? getComputedStyle(panel).display : "missing";
        const trigger = document.querySelector(".archive-mobile-filter");
        const triggerInEmptyState = trigger ? !!trigger.closest(".empty-state") : null;
        const anyToggle = [...document.querySelectorAll("button")].some((b) =>
          /filter/i.test(b.getAttribute("aria-label") || b.textContent || ""),
        );
        const searchVisible = (() => {
          const s = document.querySelector("#archive-filter-search");
          if (!s) return "missing";
          const r = s.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })();
        return { panelStyle, triggerExists: !!trigger, triggerInEmptyState, anyFilterToggle: anyToggle, searchVisible };
      });
      await page.screenshot({ path: path.join(SHOTS, "t09-mobile-filters.png"), fullPage: false });
      const filtersReachable = state.panelStyle !== "none" || (!!state.triggerExists && !state.triggerInEmptyState);
      record(
        "T09",
        "Mobile (390px): filter panel reachable with results present",
        filtersReachable ? "PASS" : "FAIL",
        JSON.stringify(state),
      );
      await page.close();
    }

    /* ---------- T10 Empty state: no nested buttons, Clear filters works ---------- */
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      const logs = await collectConsole(page);
      await gotoTimeline(page);
      await page.type("#archive-filter-search", "zzqqxxnotarealterm9999", { delay: 5 });
      const emptyAppeared = await waitUntil(page, () => !!document.querySelector(".empty-state"), [], 20000);
      const empty = await page.evaluate(() => {
        const es = document.querySelector(".empty-state");
        if (!es) return { present: false };
        const buttons = [...es.querySelectorAll("button")];
        const nested = [...es.querySelectorAll("button button")].length;
        return {
          present: true,
          buttonCount: buttons.length,
          nestedButtonCount: nested,
          text: es.textContent.replace(/\s+/g, " ").trim().slice(0, 120),
        };
      });
      let clearWorks = false;
      if (empty.present) {
        await page.evaluate(() => {
          const b = [...document.querySelectorAll(".empty-state button")].find((x) => /clear/i.test(x.textContent));
          if (b) b.click();
        });
        clearWorks = await waitUntil(page, () => document.querySelector("#archive-filter-search")?.value === "");
      }
      await page.screenshot({ path: path.join(SHOTS, "t10-empty.png") });
      const domNestingWarnings = logs.filter((l) => /cannot be a descendant|validateDOMNesting|In HTML, <button>/i.test(l));
      const hyd = hydrationIssues(logs);
      const status = emptyAppeared && empty.present && empty.nestedButtonCount === 0 && clearWorks && domNestingWarnings.length === 0 ? "PASS" : "FAIL";
      record(
        "T10",
        "Empty state: no nested <button>, Clear filters resets search, no DOM-nesting warnings",
        status,
        `structure=${JSON.stringify(empty)} clearWorks=${clearWorks} domNestingWarnings=${domNestingWarnings.length}${domNestingWarnings[0] ? " :: " + domNestingWarnings[0].slice(0, 180) : ""} hydrationIssues=${hyd.length}`,
      );
      await page.close();
    }

    /* ---------- T11 Keyboard/a11y: company dropdown + expand toggle ---------- */
    {
      const page = await browser.newPage();
      const api = trackApi(page);
      await gotoTimeline(page);
      await page.focus(".company-select-trigger");
      const ariaBefore = await page.$eval(".company-select-trigger", (el) => el.getAttribute("aria-expanded"));
      await page.keyboard.press("Enter");
      await page.waitForSelector(".company-select-panel", { visible: true, timeout: 5000 });
      const ariaOpen = await page.$eval(".company-select-trigger", (el) => el.getAttribute("aria-expanded"));
      const listboxRole = await page.$eval(".company-select-panel", (el) => el.getAttribute("role"));
      await page.keyboard.press("Escape");
      const panelClosed = await waitUntil(page, () => !document.querySelector(".company-select-panel"));
      const panelAfterEsc = (await page.$(".company-select-panel")) === null;
      const ariaClosed = await page.$eval(".company-select-trigger", (el) => el.getAttribute("aria-expanded"));
      await page.focus(".expand-icon");
      const expBefore = await page.$eval(".expand-icon", (el) => el.getAttribute("aria-expanded"));
      await page.keyboard.press("Enter");
      const expanded = await waitUntil(page, () => {
        const btn = document.querySelector(".expand-icon");
        return btn?.getAttribute("aria-expanded") === "true" && !!document.querySelector(".story-detail-wrap.is-open");
      });
      const expAfter = await page.evaluate(() => ({
        expanded: document.querySelector(".expand-icon")?.getAttribute("aria-expanded"),
        open: !!document.querySelector(".story-detail-wrap.is-open"),
      }));
      const baseline = await page.evaluate(() => {
        const m = document.querySelector(".filter-result-count").textContent.match(/of\s+(\d+)/);
        return m ? Number(m[1].replace(/,/g, '')) : 0;
      });
      await page.focus("#archive-filter-search");
      await page.keyboard.type("nvidia", { delay: 15 });
      await waitForApi(api);
      const searched = await waitUntil(
        page,
        (base) => {
          const m = document.querySelector(".filter-result-count")?.textContent?.match(/Showing\s+([\d,]+)\s+of\s+([\d,]+)/);
          const shown = m ? Number(m[1].replace(/,/g, '')) : 0;
          return shown > 0 && shown < base;
        },
        [baseline],
      );
      const searchResult = await shownCount(page);
      await page.screenshot({ path: path.join(SHOTS, "t11-keyboard.png") });
      const ok =
        ariaBefore === "false" &&
        ariaOpen === "true" &&
        listboxRole === "listbox" &&
        panelClosed &&
        panelAfterEsc &&
        ariaClosed === "false" &&
        expBefore === "false" &&
        expanded &&
        expAfter.expanded === "true" &&
        expAfter.open &&
        searched &&
        searchResult.shown > 0 &&
        searchResult.shown < baseline;
      record(
        "T11",
        "Keyboard: Enter opens company listbox, Escape closes; Enter toggles row; typing searches",
        ok ? "PASS" : "FAIL",
        `company aria ${ariaBefore}→${ariaOpen}→${ariaClosed} role=${listboxRole} escClosed=${panelAfterEsc} expand ${expBefore}→${JSON.stringify(expAfter)} searchShown=${searchResult.shown}/${baseline}`,
      );
      await page.close();
    }

    /* ---------- T12 Hydration on story + dossier pages ---------- */
    {
      if (!liveSlug) {
        record("T12", "Hydration clean on story + dossier; dossier TOC jump works", "FAIL", "no live story slug available from API");
      } else {
        const page = await browser.newPage();
        const logs = await collectConsole(page);
        await page.goto(BASE + "/story/" + liveSlug, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForSelector("h1", { timeout: 60000 });
        await sleep(500);
        const storyHyd = hydrationIssues(logs);
        logs.length = 0;
        await page.goto(BASE + "/topic/anthropic", { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForSelector(".dossier", { timeout: 60000 });
        await sleep(400);
        const tocInfo = await page.evaluate(() => {
          const tocLinks = [...document.querySelectorAll(".dossier-toc a, .dossier a[href^='#']")];
          return { tocLinkCount: tocLinks.length, firstHref: tocLinks[0] ? tocLinks[0].getAttribute("href") : null };
        });
        let tocWorks = null;
        if (tocInfo.firstHref) {
          await page.evaluate((h) => {
            const a = [...document.querySelectorAll(`a[href="${h}"]`)].find(
              (x) => x.closest(".dossier-toc") || x.closest(".dossier"),
            );
            if (a) a.click();
          }, tocInfo.firstHref);
          tocWorks = await waitUntil(
            page,
            (h) => {
              const el = document.getElementById(h.replace("#", ""));
              return el ? Math.abs(el.getBoundingClientRect().top) < 300 : false;
            },
            [tocInfo.firstHref],
            10000,
          );
        }
        const topicHyd = hydrationIssues(logs);
        await page.screenshot({ path: path.join(SHOTS, "t12-dossier.png") });
        const ok = storyHyd.length === 0 && topicHyd.length === 0 && tocWorks !== false;
        record(
          "T12",
          "Hydration clean on story + dossier; dossier TOC jump works",
          ok ? "PASS" : "FAIL",
          `slug=${liveSlug} storyHyd=${storyHyd.length} topicHyd=${topicHyd.length} tocLinks=${tocInfo.tocLinkCount} first=${tocInfo.firstHref} tocJumpOk=${tocWorks}`,
        );
        await page.close();
      }
    }

    /* ---------- T13 Company dropdown fits viewport horizontally ---------- */
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1100, height: 700 });
      await gotoTimeline(page);
      await page.click(".company-select-trigger");
      await page.waitForSelector(".company-select-panel", { visible: true, timeout: 5000 });
      const inside = await page.evaluate(() => {
        const p = document.querySelector(".company-select-panel").getBoundingClientRect();
        return { left: p.left, right: p.right, vw: window.innerWidth, fits: p.left >= 0 && p.right <= window.innerWidth + 1 };
      });
      record(
        "T13",
        "Company dropdown panel fits viewport horizontally at 1100px",
        inside.fits ? "PASS" : "FAIL",
        JSON.stringify(inside),
      );
      await page.close();
    }

    /* ---------- T14 Mobile compatibility matrix: no horizontal overflow,
       filter controls reachable, tap targets >= 40px ---------- */
    {
      const widths = [320, 360, 390, 414, 768];
      const problems = [];
      const report = [];
      for (const width of widths) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: 844, isMobile: width < 768, hasTouch: width < 768 });
        await gotoTimeline(page);
        const state = await page.evaluate(() => {
          const doc = document.documentElement;
          const overflowPx = Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
          const search = document.querySelector("#archive-filter-search");
          const trigger = document.querySelector(".archive-mobile-filter") || document.querySelector(".company-select-trigger");
          const panel = document.querySelector(".archive-filter-panel");
          const rect = (el) => (el ? el.getBoundingClientRect() : null);
          const tap = (el) => {
            const r = rect(el);
            return r ? Math.round(Math.min(r.width, r.height)) : null;
          };
          const filterVisible =
            (panel && getComputedStyle(panel).display !== "none") || !!rect(trigger);
          return {
            overflowPx,
            filterVisible: !!filterVisible,
            searchTap: tap(search),
            triggerTap: tap(trigger),
            searchVisible: search ? rect(search).width > 0 && rect(search).height > 0 : false,
          };
        });
        await page.screenshot({ path: path.join(SHOTS, `t14-mobile-${width}.png`), fullPage: false });
        report.push({ width, ...state });
        if (state.overflowPx > 2) problems.push(`${width}px horizontal overflow ${state.overflowPx}px`);
        if (!state.filterVisible) problems.push(`${width}px filters unreachable`);
        if (state.triggerTap !== null && state.triggerTap < 40) problems.push(`${width}px trigger tap target ${state.triggerTap}px`);
        await page.close();
      }
      record(
        "T14",
        "Mobile matrix (320–768px): no horizontal overflow, filters reachable, tap targets ≥40px",
        problems.length === 0 ? "PASS" : "FAIL",
        problems.length ? problems.join(" | ") : report.map((r) => `${r.width}:ok`).join(" "),
      );
    }

    /* ---------- T15 Row lead thumbnails ---------- */
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await gotoTimeline(page);
      const state = await page.evaluate(() => {
        const rows = document.querySelectorAll(".timeline-item").length;
        const thumbs = [...document.querySelectorAll(".timeline-item .story-thumb")];
        const imgs = [...document.querySelectorAll(".timeline-item .story-thumb img")];
        const monos = [...document.querySelectorAll(".timeline-item .story-thumb-mono")];
        // Tiles below the fold are lazy, so only on-screen ones should report a
        // decoded bitmap.
        const visible = imgs.filter((img) => {
          const r = img.getBoundingClientRect();
          return r.top < window.innerHeight && r.bottom > 0 && r.width > 0;
        });
        return {
          rows,
          thumbs: thumbs.length,
          imgs: imgs.length,
          monos: monos.length,
          visible: visible.length,
          loaded: visible.filter((img) => img.complete && img.naturalWidth > 0).length,
          insecureSrc: imgs.filter((img) => !/^https:\/\//.test(img.currentSrc || img.src)).length,
        };
      });
      await page.screenshot({ path: path.join(SHOTS, "t15-thumbnails.png"), fullPage: false });
      const problems = [];
      if (state.rows === 0) problems.push("no timeline rows");
      if (state.thumbs !== state.rows) problems.push(`${state.thumbs} tiles for ${state.rows} rows`);
      if (state.imgs + state.monos !== state.rows)
        problems.push(`${state.imgs} images + ${state.monos} monograms != ${state.rows} rows`);
      if (state.insecureSrc > 0) problems.push(`${state.insecureSrc} tiles not served over https`);
      if (state.visible > 0 && state.loaded === 0) problems.push("no visible lead image decoded");
      await page.close();
      record(
        "T15",
        "Row lead thumbnails: one tile per row (image or monogram), https sources, on-screen images decode",
        problems.length === 0 ? "PASS" : "FAIL",
        problems.length
          ? problems.join(" | ")
          : `${state.imgs} images (${state.loaded}/${state.visible} on-screen decoded) + ${state.monos} monograms over ${state.rows} rows`,
      );
    }
  } finally {
    await browser.close();
  }

  /* ---------- Summary ---------- */
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  console.log("\n===== BROWSER SUMMARY =====");
  console.log(`PASS=${pass} FAIL=${fail} TOTAL=${results.length}`);
  for (const r of results) console.log(`${r.status}\t${r.id}\t${r.name}`);
  if (fail > 0) process.exitCode = 1;
})().catch((err) => {
  console.error("HARNESS ERROR:", err);
  process.exit(1);
});
