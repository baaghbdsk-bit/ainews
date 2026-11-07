import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const executablePath = chromePaths.find(p => fs.existsSync(p));

async function run() {
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const svgContent = fs.readFileSync('public/icon.svg', 'utf8');

  // Render 512
  let page = await browser.newPage();
  await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;width:512px;height:512px;"><div style="width:512px;height:512px;">${svgContent}</div></body></html>`);
  await page.evaluate(() => {
    const el = document.querySelector('svg');
    if (el) {
      el.setAttribute('width', '512');
      el.setAttribute('height', '512');
    }
  });
  await page.screenshot({ path: 'public/icon-512.png', omitBackground: true });
  await page.close();

  // Render 192
  page = await browser.newPage();
  await page.setViewport({ width: 192, height: 192, deviceScaleFactor: 1 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;width:192px;height:192px;"><div style="width:192px;height:192px;">${svgContent}</div></body></html>`);
  await page.evaluate(() => {
    const el = document.querySelector('svg');
    if (el) {
      el.setAttribute('width', '192');
      el.setAttribute('height', '192');
    }
  });
  await page.screenshot({ path: 'public/icon-192.png', omitBackground: true });
  await page.close();

  await browser.close();
  console.log('Successfully regenerated public/icon-192.png and public/icon-512.png with Light Yellow top bar!');
}

run().catch(console.error);
