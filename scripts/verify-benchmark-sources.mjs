/**
 * Checks that every benchmark and model citation in the generated catalogue is
 * reachable. This is intentionally separate from the data integrity tests:
 * network checks are useful in the refresh workflow but are not deterministic
 * enough for every local test run.
 *
 * Usage: node --experimental-strip-types scripts/verify-benchmark-sources.mjs
 */
import { AI_MODELS_DATA } from '../src/lib/benchmarks/data.ts';

const TIMEOUT_MS = 12_000;
const RETRIES = 2;
const CONCURRENCY = 10;

const urls = [
  ...AI_MODELS_DATA.map((model) => model.officialSourceUrl),
  ...AI_MODELS_DATA.map((model) => model.officialDocumentationUrl).filter(Boolean),
  ...AI_MODELS_DATA.flatMap((model) => Object.values(model.benchmarks).map((score) => score.sourceUrl)),
].filter((url, index, all) => url && all.indexOf(url) === index);

async function request(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'NeuBench-source-audit/1.0',
        ...(method === 'GET' ? { Range: 'bytes=0-2048' } : {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url) {
  let lastError = '';
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      let response = await request(url, 'HEAD');
      if ([403, 405, 501].includes(response.status)) response = await request(url, 'GET');
      if ([401, 403].includes(response.status)) {
        return { url, status: response.status, finalUrl: response.url, protected: true };
      }
      if (response.ok || (response.status >= 300 && response.status < 400)) {
        return { url, status: response.status, finalUrl: response.url };
      }
      lastError = `HTTP ${response.status}`;
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  return { url, status: null, finalUrl: url, error: lastError || 'unreachable' };
}

const results = [];
let cursor = 0;
async function worker() {
  while (cursor < urls.length) {
    const url = urls[cursor++];
    results.push(await checkUrl(url));
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));

const protectedUrls = results.filter((result) => result.protected);
const failures = results.filter(
  (result) => (result.status === null || result.status >= 400) && !result.protected
);
const statusCounts = {};
for (const result of results) {
  const key = result.status === null ? 'error' : String(result.status);
  statusCounts[key] = (statusCounts[key] ?? 0) + 1;
}

console.log(`Checked ${results.length} unique benchmark/model source URLs.`);
console.log(`HTTP statuses: ${Object.entries(statusCounts).map(([status, count]) => `${status}=${count}`).join(', ')}`);
if (protectedUrls.length) {
  console.warn(`${protectedUrls.length} documentation URL(s) responded with 401/403 and require access; they are not treated as dead links.`);
}

if (failures.length) {
  console.error('Unreachable or failing citations:');
  for (const failure of failures) {
    console.error(`- ${failure.url} (${failure.error ?? `HTTP ${failure.status}`})`);
  }
  process.exitCode = 1;
} else {
  console.log('All benchmark and model citations are reachable or explicitly access-protected.');
}
