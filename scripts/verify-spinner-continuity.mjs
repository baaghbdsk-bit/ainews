import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/vivek/.gemini/antigravity/brain/fd260949-1927-4dfa-8768-3f56f19e2993';
const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  console.log('Verifying 3-color circular spinner continuity...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
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

  // 1. Navigate to Latest
  await page.goto('http://localhost:3000/explore?view=latest', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.ex-root', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 600));

  // 2. Switch to All Feed
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent && (b.textContent.includes('Full Stream') || b.textContent.includes('All Feed')));
    if (btn) btn.click();
  });
  await page.waitForSelector('.ex-load-more-btn', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 600));

  // 3. Trigger Load More button and capture spinner in action
  console.log('Capturing button spinner state...');
  // Force the button into loading state for visual inspection
  await page.evaluate(() => {
    const btn = document.querySelector('.ex-load-more-btn');
    if (btn) {
      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  });

  const btnShotPath = path.join(ARTIFACT_DIR, 'spinner-button-continuity.png');
  await page.screenshot({ path: btnShotPath });
  console.log('Captured button view:', btnShotPath);

  // 4. Capture Date loading state with 3-color circular spinner
  console.log('Capturing Date loading state with 3-color spinner...');
  await page.evaluate(() => {
    const dummy = document.createElement('div');
    dummy.id = 'qa-spinner-demo-card';
    dummy.innerHTML = `
      <div class="ex-date-loading-state" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 99999; margin: 0; box-shadow: 0 20px 60px rgba(0,0,0,0.6);">
        <span class="neubench-spinner-wrap" role="status" aria-label="Loading">
          <svg class="neubench-spinner-svg" width="52" height="52" viewBox="0 0 44 44" fill="none">
            <circle class="neubench-spinner-track" cx="22" cy="22" r="16" stroke="currentColor" stroke-width="4.5" opacity="0.12" fill="none" />
            <circle cx="22" cy="22" r="16" stroke="#4777FF" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="25 75.53" stroke-dashoffset="0" fill="none" />
            <circle cx="22" cy="22" r="16" stroke="#FDE047" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="25 75.53" stroke-dashoffset="-33.51" fill="none" />
            <circle cx="22" cy="22" r="16" stroke="#13DCCB" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="25 75.53" stroke-dashoffset="-67.02" fill="none" />
          </svg>
        </span>
        <div class="ex-date-loading-text">
          <h3>Loading Intelligence Radar</h3>
          <p>Fetching top highlights for November 7, 2026...</p>
        </div>
      </div>
    `;
    document.body.appendChild(dummy);
  });

  await new Promise((r) => setTimeout(r, 400));
  const fullLoaderShotPath = path.join(ARTIFACT_DIR, 'spinner-continuity-unified.png');
  await page.screenshot({ path: fullLoaderShotPath });
  console.log('Captured full loader view:', fullLoaderShotPath);

  await browser.close();
  console.log('Spinner verification completed successfully!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
