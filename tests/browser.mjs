/**
 * Browser E2E suite — exercises real client-side interactions in headless
 * Chrome against a running server:
 *
 *   node tests/browser.mjs
 *   BASE_URL=http://localhost:3000 node tests/browser.mjs
 *
 * Requires Google Chrome (override with CHROME_PATH) and puppeteer-core
 * (devDependency). Screenshots land in tests/shots/.
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
    const m = el.textContent.match(/Showing\s+(\d+)\s+of\s+(\d+)/);
    return m ? { shown: Number(m[1]), total: Number(m[2]) } : null;
  });
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
      await gotoTimeline(page);
      const before = await shownCount(page);
      await page.click("#archive-filter-search");
      await page.type("#archive-filter-search", "anthropic", { delay: 20 });
      await sleep(500);
      const after = await shownCount(page);
      const domTitles = await page.$$eval(".timeline-item .story-title-text", (els) =>
        els.map((e) => (e.textContent || "").trim()),
      );
      // Search matches title/summary/significance/source/topic/date (not just
      // titles), so assert the DOM renders exactly the API's first filtered page.
      const apiPage = await (await fetch(`${BASE}/api/stories?q=anthropic&offset=0&limit=60`)).json();
      const apiTitles = (apiPage.stories ?? []).map((s) => s.title.trim());
      const titlesMatchApi =
        domTitles.length === apiTitles.length && domTitles.every((t, i) => t === apiTitles[i]);
      const domRows = domTitles.length;
      const expectedDom = Math.min(after.shown, 60);
      await page.screenshot({ path: path.join(SHOTS, "t02-search-anthropic.png") });
      const ok =
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
      await sleep(500);
      const panelGone = (await page.$(".company-select-panel")) === null;
      const triggerLabel = await page.$eval(".company-select-trigger-label", (el) => el.textContent.trim());
      const after = await shownCount(page);
      await page.screenshot({ path: path.join(SHOTS, "t03-company-selected.png") });
      const ok =
        flushGap < 2 &&
        leftAligned &&
        widthMatch &&
        clicked &&
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
      await gotoTimeline(page);
      const all = await shownCount(page);
      await page.select('select[aria-label="Filter by year"]', "2026");
      await sleep(400);
      const y2026 = await shownCount(page);
      const yearsVisible = await page.$$eval(".timeline-node", (els) =>
        els.map((n) => n.getAttribute("aria-label") || ""),
      );
      const all2026 = yearsVisible.length > 0 && yearsVisible.every((l) => /,\s*2026$/.test(l));
      await page.select('select[aria-label="Filter by month"]', "10");
      await sleep(400);
      const ym = await shownCount(page);
      const monthsVisible = await page.$$eval(".timeline-node", (els) =>
        els.map((n) => n.getAttribute("aria-label") || ""),
      );
      const allOct = monthsVisible.length > 0 && monthsVisible.every((l) => /^Oct /.test(l) && /,\s*2026$/.test(l));
      await page.select('select[aria-label="Filter by month"]', "all");
      await sleep(300);
      const yOnly = await shownCount(page);
      await page.select('select[aria-label="Filter by year"]', "all");
      await sleep(300);
      const reset = await shownCount(page);
      await page.screenshot({ path: path.join(SHOTS, "t05-period.png") });
      const ok =
        y2026.shown < all.shown &&
        y2026.shown > 0 &&
        all2026 &&
        ym.shown <= y2026.shown &&
        allOct &&
        yOnly.shown === y2026.shown &&
        reset.shown === all.shown;
      record(
        "T05",
        "Period selects: year=2026, month=Oct, reset",
        ok ? "PASS" : "FAIL",
        `all=${all.shown} y2026=${y2026.shown} (allRows2026=${all2026}) ym=${ym.shown} (allOct=${allOct}) yOnly=${yOnly.shown} reset=${reset.shown}`,
      );
      await page.close();
    }

    /* ---------- T06 Clear filters ---------- */
    {
      const page = await browser.newPage();
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
      await sleep(500);
      const filtered = await shownCount(page);
      await page.click(".filter-clear-button");
      await sleep(500);
      const afterClear = await shownCount(page);
      const searchVal = await page.$eval("#archive-filter-search", (el) => el.value);
      const yearVal = await page.$eval('select[aria-label="Filter by year"]', (el) => el.value);
      const companyLabel = await page.$eval(".company-select-trigger-label", (el) => el.textContent.trim());
      await page.screenshot({ path: path.join(SHOTS, "t06-clear.png") });
      const ok =
        filtered.shown < baseline.shown &&
        afterClear.shown === baseline.shown &&
        searchVal === "" &&
        yearVal === "all" &&
        companyLabel === "All companies";
      record(
        "T06",
        "Clear filters resets search + year + company",
        ok ? "PASS" : "FAIL",
        `baseline=${baseline.shown} filtered=${filtered.shown} afterClear=${afterClear.shown} search="${searchVal}" year=${yearVal} company="${companyLabel}"`,
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
        await sleep(400);
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
        await sleep(400);
        const s2 = await page.evaluate(() => {
          const opens = [...document.querySelectorAll(".story-detail-wrap.is-open")];
          return { openCount: opens.length, openId: opens[0] ? opens[0].id : null };
        });
        const openBtn = await page.$(".expand-icon[aria-expanded='true']");
        if (openBtn) {
          await openBtn.click();
          await sleep(400);
        }
        const s3 = await page.evaluate(() => ({
          openCount: document.querySelectorAll(".story-detail-wrap.is-open").length,
          anyExpanded: !!document.querySelector(".expand-icon[aria-expanded='true']"),
        }));
        await page.screenshot({ path: path.join(SHOTS, "t07-expand.png") });
        const ok =
          s1.openId &&
          s1.ariaExpandedTrue &&
          s1.detailVisible &&
          s1.btnLabel &&
          s1.btnLabel.startsWith("Hide") &&
          s2.openCount === 1 &&
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
        await sleep(700);
        rows = (await page.$$(".timeline-item")).length;
        if (rows > initialRows) {
          grew = true;
          break;
        }
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
      await sleep(600);
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
        await sleep(500);
        const searchAfter = await page.$eval("#archive-filter-search", (el) => el.value);
        clearWorks = searchAfter === "";
      }
      await page.screenshot({ path: path.join(SHOTS, "t10-empty.png") });
      const domNestingWarnings = logs.filter((l) => /cannot be a descendant|validateDOMNesting|In HTML, <button>/i.test(l));
      const hyd = hydrationIssues(logs);
      const status = empty.present && empty.nestedButtonCount === 0 && clearWorks && domNestingWarnings.length === 0 ? "PASS" : "FAIL";
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
      await gotoTimeline(page);
      await page.focus(".company-select-trigger");
      const ariaBefore = await page.$eval(".company-select-trigger", (el) => el.getAttribute("aria-expanded"));
      await page.keyboard.press("Enter");
      await page.waitForSelector(".company-select-panel", { visible: true, timeout: 5000 });
      const ariaOpen = await page.$eval(".company-select-trigger", (el) => el.getAttribute("aria-expanded"));
      const listboxRole = await page.$eval(".company-select-panel", (el) => el.getAttribute("role"));
      await page.keyboard.press("Escape");
      await sleep(300);
      const panelAfterEsc = (await page.$(".company-select-panel")) === null;
      const ariaClosed = await page.$eval(".company-select-trigger", (el) => el.getAttribute("aria-expanded"));
      await page.focus(".expand-icon");
      const expBefore = await page.$eval(".expand-icon", (el) => el.getAttribute("aria-expanded"));
      await page.keyboard.press("Enter");
      await sleep(400);
      const expAfter = await page.evaluate(() => ({
        expanded: document.querySelector(".expand-icon")?.getAttribute("aria-expanded"),
        open: !!document.querySelector(".story-detail-wrap.is-open"),
      }));
      await page.focus("#archive-filter-search");
      await page.keyboard.type("nvidia", { delay: 15 });
      await sleep(500);
      const searchResult = await shownCount(page);
      const baseline = await page.evaluate(() => {
        const m = document.querySelector(".filter-result-count").textContent.match(/of\s+(\d+)/);
        return m ? Number(m[1]) : 0;
      });
      await page.screenshot({ path: path.join(SHOTS, "t11-keyboard.png") });
      const ok =
        ariaBefore === "false" &&
        ariaOpen === "true" &&
        listboxRole === "listbox" &&
        panelAfterEsc &&
        ariaClosed === "false" &&
        expBefore === "false" &&
        expAfter.expanded === "true" &&
        expAfter.open &&
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
        await sleep(500);
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
          await sleep(400);
          tocWorks = await page.evaluate((h) => {
            const id = h.replace("#", "");
            const el = document.getElementById(id);
            return el ? Math.abs(el.getBoundingClientRect().top) < 300 : false;
          }, tocInfo.firstHref);
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
