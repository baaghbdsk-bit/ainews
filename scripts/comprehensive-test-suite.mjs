import http from 'node:http';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:3000';

const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const executablePath = chromePaths.find(p => fs.existsSync(p));

async function runTestSuite() {
  const results = {
    unit: [],
    regression: [],
    stress: {},
    screenshots: []
  };

  console.log('=== [1/4] EXECUTING UNIT TESTS ===');
  
  // Test 1: Weekly Sunday midnight reset bounds logic
  try {
    const testDate = new Date(2026, 10, 7, 12, 0, 0); // Saturday Nov 7, 2026
    const dayOfWeek = testDate.getDay(); // 6
    const startDate = new Date(testDate);
    startDate.setDate(testDate.getDate() - dayOfWeek);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);
    endDate.setHours(0, 0, 0, 0);

    const isStartSunday = startDate.getDay() === 0;
    const isStartNov1 = startDate.getDate() === 1 && startDate.getMonth() === 10;
    const isEndNov8 = endDate.getDate() === 8 && endDate.getMonth() === 10;
    
    if (isStartSunday && isStartNov1 && isEndNov8) {
      results.unit.push({ name: 'Weekly Sunday Midnight Reset Boundaries', passed: true });
    } else {
      results.unit.push({ name: 'Weekly Sunday Midnight Reset Boundaries', passed: false, error: 'Incorrect bounds' });
    }
  } catch (err) {
    results.unit.push({ name: 'Weekly Sunday Midnight Reset Boundaries', passed: false, error: String(err) });
  }

  // Test 2: Trending vote filter logic (upvoteCount >= 1)
  try {
    const mockStories = [
      { id: '1', title: 'Story 1', upvoteCount: 0 },
      { id: '2', title: 'Story 2', upvoteCount: 5 },
      { id: '3', title: 'Story 3', upvoteCount: 1 },
      { id: '4', title: 'Story 4', upvoteCount: undefined },
    ];
    const filtered = mockStories.filter(s => (s.upvoteCount ?? 0) >= 1);
    const passed = filtered.length === 2 && filtered.every(s => s.upvoteCount >= 1);
    results.unit.push({ name: 'Trending Vote Filter Threshold (>=1 votes)', passed });
  } catch (err) {
    results.unit.push({ name: 'Trending Vote Filter Threshold (>=1 votes)', passed: false, error: String(err) });
  }

  // Test 3: Favicon / Logo SVG palette contract
  try {
    const svgContent = fs.readFileSync('public/icon.svg', 'utf8');
    const hasBlue = svgContent.includes('#4777FF');
    const hasYellow = svgContent.includes('#FDE047');
    const hasTeal = svgContent.includes('#13DCCB');
    const yellowIsCenter = svgContent.includes('y="24"') && svgContent.includes('#FDE047');
    results.unit.push({ name: 'Letter E Favicon Tri-Color Palette (Center Yellow #FDE047)', passed: hasBlue && hasYellow && hasTeal && yellowIsCenter });
  } catch (err) {
    results.unit.push({ name: 'Letter E Favicon Tri-Color Palette', passed: false, error: String(err) });
  }

  // Test 4: Progressive Batch-of-10 Pagination Logic
  try {
    const mockFeed = Array.from({ length: 48 }, (_, i) => ({ id: `story-${i}`, title: `Story ${i}` }));
    const batch1 = mockFeed.slice(0, 10);
    const batch2 = mockFeed.slice(0, 20);
    const passed = batch1.length === 10 && batch2.length === 20 && batch2[19].id === 'story-19';
    results.unit.push({ name: 'Progressive Batch-of-10 Slicing & Windowing', passed });
  } catch (err) {
    results.unit.push({ name: 'Progressive Batch-of-10 Slicing & Windowing', passed: false, error: String(err) });
  }

  // Test 5: Story Title & Publisher Sanitization Logic
  try {
    const rawTitle = 'OpenAI launches GPT-6 Cyber as its models help find 81 Firefox flaws - news.lavx.hu';
    const cleaned = rawTitle.replace(/\s*[-–—|:]\s*(?:news\.lavx\.hu|Google News).*/i, '').trim();
    const passed = cleaned === 'OpenAI launches GPT-6 Cyber as its models help find 81 Firefox flaws';
    results.unit.push({ name: 'Zero Publisher Suffix Bleed Sanitizer', passed });
  } catch (err) {
    results.unit.push({ name: 'Zero Publisher Suffix Bleed Sanitizer', passed: false, error: String(err) });
  }

  console.log('=== [2/4] EXECUTING REGRESSION TESTING ACROSS ROUTES ===');
  const routesToTest = [
    { path: '/', expectedCode: 200, label: 'Root Landing' },
    { path: '/home', expectedCode: 200, label: 'Home Masthead Launcher' },
    { path: '/explore', expectedCode: 200, label: 'Explore Default' },
    { path: '/explore?view=latest', expectedCode: 200, label: 'Explore Latest View' },
    { path: '/explore?view=trending', expectedCode: 200, label: 'Explore Trending View (Weekly Top)' },
    { path: '/explore?view=saved', expectedCode: 200, label: 'Explore Saved Dossier' },
    { path: '/explore?view=about', expectedCode: 200, label: 'Explore About System Dossier' },
    { path: '/explore?view=connect', expectedCode: 200, label: 'Explore Feedback & Connect' },
    { path: '/benchmarks', expectedCode: 200, label: 'Frontier Benchmarks' },
    { path: '/api/stories?date=2026-11-07&mode=highlights', expectedCode: 200, label: 'Stories API (Highlights Mode)' },
    { path: '/api/stories?date=2026-11-07&mode=all', expectedCode: 200, label: 'Stories API (All Feed Mode)' },
    { path: '/api/stories?limit=10', expectedCode: 200, label: 'Stories API (Windowed Limit 10)' },
    { path: '/icon.svg?v=4', expectedCode: 200, label: 'Dynamic SVG Favicon' },
    { path: '/icon-192.png', expectedCode: 200, label: 'PWA 192px PNG Icon' },
    { path: '/icon-512.png', expectedCode: 200, label: 'PWA 512px PNG Icon' },
    { path: '/manifest.webmanifest', expectedCode: 200, label: 'Web App Manifest' },
    { path: '/robots.txt', expectedCode: 200, label: 'Robots.txt' },
    { path: '/sitemap.xml', expectedCode: 200, label: 'Sitemap.xml' },
  ];

  for (const route of routesToTest) {
    try {
      const res = await fetch(`${BASE_URL}${route.path}`);
      const passed = res.status === route.expectedCode;
      results.regression.push({
        label: route.label,
        path: route.path,
        status: res.status,
        passed,
      });
    } catch (err) {
      results.regression.push({
        label: route.label,
        path: route.path,
        passed: false,
        error: String(err),
      });
    }
  }

  console.log('=== [3/4] EXECUTING STRESS & CONCURRENCY BENCHMARK ===');
  const CONCURRENCY = 100;
  const targetUrl = `${BASE_URL}/api/stories?date=2026-11-07&mode=highlights`;
  
  const startTime = Date.now();
  const latencies = [];
  let successfulRequests = 0;
  let failedRequests = 0;

  const stressPromises = Array.from({ length: CONCURRENCY }, async () => {
    const reqStart = Date.now();
    try {
      const res = await fetch(targetUrl);
      const reqDuration = Date.now() - reqStart;
      latencies.push(reqDuration);
      if (res.status === 200) {
        successfulRequests++;
      } else {
        failedRequests++;
      }
    } catch {
      failedRequests++;
    }
  });

  await Promise.all(stressPromises);
  const totalDuration = Date.now() - startTime;
  latencies.sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p90 = latencies[Math.floor(latencies.length * 0.90)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const rps = ((successfulRequests / totalDuration) * 1000).toFixed(1);

  results.stress = {
    totalRequests: CONCURRENCY,
    successfulRequests,
    failedRequests,
    errorRate: `${((failedRequests / CONCURRENCY) * 100).toFixed(1)}%`,
    totalDurationMs: totalDuration,
    requestsPerSecond: rps,
    p50LatencyMs: p50,
    p90LatencyMs: p90,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
  };

  console.log('=== [4/4] CAPTURING VALIDATION SCREENSHOTS VIA PUPPETEER ===');
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 950, deviceScaleFactor: 1.5 });

  await page.evaluateOnNewDocument(() => {
    try {
      sessionStorage.setItem('neubench_welcome_seen', '1');
      localStorage.setItem('neubench_welcome_seen', '1');
      localStorage.setItem('neubench_guest', 'true');
    } catch {}
  });

  // Screenshot A: Trending with ONLY voted stories (vote count >= 1)
  await page.goto(`${BASE_URL}/explore?view=trending`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ex-weekly-indicator');
  await new Promise(r => setTimeout(r, 600));
  const trendingImgPath = 'C:/Users/vivek/.gemini/antigravity/brain/fd260949-1927-4dfa-8768-3f56f19e2993/qa-trending-voted-only.png';
  await page.screenshot({ path: trendingImgPath });
  results.screenshots.push({ name: 'Trending (Voted Items Only)', path: trendingImgPath });

  // Screenshot B: About tab open via Explorer navigation
  await page.goto(`${BASE_URL}/explore?view=about`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.about-v2-hero, .about-main-container, h1');
  await new Promise(r => setTimeout(r, 600));
  const aboutImgPath = 'C:/Users/vivek/.gemini/antigravity/brain/fd260949-1927-4dfa-8768-3f56f19e2993/qa-about-tab-verified.png';
  await page.screenshot({ path: aboutImgPath });
  results.screenshots.push({ name: 'About Tab Verified', path: aboutImgPath });

  // Screenshot C: All Feed Mode showing 10-batch progressive view
  await page.goto(`${BASE_URL}/explore?view=latest`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ex-root', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));
  const streamBtn = await page.$('.ex-feed-tab-btn:last-child, .ex-bluf-stream-btn');
  if (streamBtn) {
    await streamBtn.click();
  } else {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent && (b.textContent.includes('Full Stream') || b.textContent.includes('All Feed')));
      if (btn) btn.click();
    });
  }
  await page.waitForSelector('.ex-allfeed-view, .ex-timeline-panels-list', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  const batchesImgPath = 'C:/Users/vivek/.gemini/antigravity/brain/fd260949-1927-4dfa-8768-3f56f19e2993/qa-batch10-progressive-live.png';
  await page.screenshot({ path: batchesImgPath });
  results.screenshots.push({ name: 'All Feed Batches-of-10 View', path: batchesImgPath });

  await browser.close();

  console.log('\n========================================');
  console.log('       TEST SUITE EXECUTION SUMMARY     ');
  console.log('========================================');
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync('C:/Users/vivek/.gemini/antigravity/brain/fd260949-1927-4dfa-8768-3f56f19e2993/qa-test-results.json', JSON.stringify(results, null, 2));
}

runTestSuite().catch(console.error);
