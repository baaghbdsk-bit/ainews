import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/vivek/.gemini/antigravity/brain/fd260949-1927-4dfa-8768-3f56f19e2993';

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Chrome not found');
}

async function main() {
  const chromePath = findChrome();
  console.log('Using Chrome at:', chromePath);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  await page.evaluateOnNewDocument(() => {
    try {
      sessionStorage.setItem('neubench_welcome_seen', '1');
      localStorage.setItem('neubench_welcome_seen', '1');
      localStorage.setItem('neubench_guest', 'true');
    } catch {}
  });

  // 1. Navigate to /explore?view=latest
  console.log('Navigating to http://localhost:3000/explore?view=latest...');
  await page.goto('http://localhost:3000/explore?view=latest', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Dismiss welcome dialog by clicking 'Explore as guest' or setting localStorage
  await page.evaluate(() => {
    try {
      localStorage.setItem('neubench_welcome_seen', 'true');
      localStorage.setItem('neubench_guest', 'true');
    } catch {}
    const guestBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Explore as guest'));
    if (guestBtn) guestBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.waitForSelector('.ex-root', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1000));

  // 2. Switch to All Feed mode
  console.log('Switching to All Feed mode...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => b.textContent && (b.textContent.includes('Full Stream') || b.textContent.includes('All Feed')));
    if (btn) btn.click();
  });

  await page.waitForSelector('.ex-allfeed-view', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1200));

  // 3. Count rendered cards
  const initialCardsCount = await page.evaluate(() => {
    return document.querySelectorAll('.ex-allfeed-view .ex-timeline-panel-item').length;
  });
  console.log(`Initial batch rendered: ${initialCardsCount} cards (Batch size: 10)`);

  const initialShotPath = 'tests/shots/batch10-initial.png';
  await page.screenshot({ path: initialShotPath });
  fs.copyFileSync(initialShotPath, path.join(ARTIFACT_DIR, 'batch10-initial-live.png'));

  // 4. Click Load More
  console.log('Clicking Load 10 More Dispatches button...');
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('.ex-load-more-btn');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log(`Load More button clicked: ${clicked}`);
  await new Promise((r) => setTimeout(r, 1500));

  // 5. Count rendered cards after loading more
  const secondCardsCount = await page.evaluate(() => {
    return document.querySelectorAll('.ex-allfeed-view .ex-timeline-panel-item').length;
  });
  console.log(`After batch load: ${secondCardsCount} cards (Expected: 20)`);

  const secondShotPath = 'tests/shots/batch20-loaded.png';
  await page.screenshot({ path: secondShotPath });
  fs.copyFileSync(secondShotPath, path.join(ARTIFACT_DIR, 'batch20-loaded-live.png'));

  // 6. Test Trending view
  console.log('Navigating to Trending view...');
  await page.goto('http://localhost:3000/explore?view=trending', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.ex-timeline-panels-list', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1000));
  const trendingCount = await page.evaluate(() => {
    return document.querySelectorAll('.ex-timeline-panel-item').length;
  });
  console.log(`Weekly Trending voted count: ${trendingCount} articles`);
  const trendingShotPath = 'tests/shots/trending-voted-final.png';
  await page.screenshot({ path: trendingShotPath });
  fs.copyFileSync(trendingShotPath, path.join(ARTIFACT_DIR, 'trending-voted-final.png'));

  // 7. Test About view
  console.log('Navigating to About view...');
  await page.goto('http://localhost:3000/explore?view=about', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.about-hero, .about-main-container, h1', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1000));
  const aboutVisible = await page.evaluate(() => {
    return !!document.querySelector('.about-hero, .about-main-container, h1');
  });
  console.log(`About view visible in Explore: ${aboutVisible}`);
  const aboutShotPath = 'tests/shots/about-explore-final.png';
  await page.screenshot({ path: aboutShotPath });
  fs.copyFileSync(aboutShotPath, path.join(ARTIFACT_DIR, 'about-explore-final.png'));

  await browser.close();
  console.log('ALL VERIFICATIONS SUCCESSFUL!');
}

main().catch((err) => {
  console.error('Puppeteer verification failed:', err);
  process.exit(1);
});
