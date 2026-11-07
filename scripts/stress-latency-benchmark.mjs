import http from 'node:http';
import { performance } from 'node:perf_hooks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const ENDPOINTS = [
  '/',
  '/explore?view=latest',
  '/explore?view=trending',
  '/explore?view=about',
  '/api/stories?limit=10',
  '/api/stories?date=2026-11-07&mode=highlights',
  '/api/stories?date=2026-11-07&mode=all',
  '/benchmarks',
  '/robots.txt',
];

function fetchOnce(url) {
  return new Promise((resolve) => {
    const start = performance.now();
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = performance.now() - start;
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, duration });
      });
    });
    req.on('error', (err) => {
      const duration = performance.now() - start;
      resolve({ ok: false, error: err.message, duration });
    });
    req.setTimeout(8000, () => {
      req.destroy();
      const duration = performance.now() - start;
      resolve({ ok: false, error: 'TIMEOUT', duration });
    });
  });
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function runStage(concurrency, totalRequests) {
  console.log(`\n======================================================`);
  console.log(`STRESS STAGE: ${concurrency} Concurrent Workers | ${totalRequests} Total Requests`);
  console.log(`======================================================`);

  let completed = 0;
  let inFlight = 0;
  let currentIndex = 0;
  const results = [];

  const wallStart = performance.now();

  return new Promise((resolve) => {
    function next() {
      if (completed >= totalRequests) {
        const wallDuration = (performance.now() - wallStart) / 1000;
        const durations = results.map((r) => r.duration).sort((a, b) => a - b);
        const successes = results.filter((r) => r.ok).length;
        const failures = results.length - successes;
        const errorRate = ((failures / results.length) * 100).toFixed(2);
        const rps = (results.length / wallDuration).toFixed(1);
        const min = durations[0]?.toFixed(1) || 0;
        const max = durations[durations.length - 1]?.toFixed(1) || 0;
        const sum = durations.reduce((a, b) => a + b, 0);
        const mean = (sum / (durations.length || 1)).toFixed(1);
        const p50 = percentile(durations, 50).toFixed(1);
        const p90 = percentile(durations, 90).toFixed(1);
        const p95 = percentile(durations, 95).toFixed(1);
        const p99 = percentile(durations, 99).toFixed(1);

        console.log(`Results:`);
        console.log(`  Total: ${results.length} | Success: ${successes} | Failures: ${failures} (${errorRate}% errors)`);
        console.log(`  Wall Time: ${wallDuration.toFixed(2)}s | Throughput: ${rps} req/sec`);
        console.log(`  Latency Metrics:`);
        console.log(`    Min:  ${min} ms`);
        console.log(`    Mean: ${mean} ms`);
        console.log(`    P50:  ${p50} ms`);
        console.log(`    P90:  ${p90} ms`);
        console.log(`    P95:  ${p95} ms`);
        console.log(`    P99:  ${p99} ms`);
        console.log(`    Max:  ${max} ms`);

        return resolve({
          concurrency,
          totalRequests,
          successes,
          failures,
          errorRate: parseFloat(errorRate),
          rps: parseFloat(rps),
          p50: parseFloat(p50),
          p90: parseFloat(p90),
          p95: parseFloat(p95),
          p99: parseFloat(p99),
          mean: parseFloat(mean),
        });
      }

      while (inFlight < concurrency && currentIndex < totalRequests) {
        const ep = ENDPOINTS[currentIndex % ENDPOINTS.length];
        const url = `${BASE_URL}${ep}`;
        currentIndex++;
        inFlight++;

        fetchOnce(url).then((res) => {
          results.push(res);
          inFlight--;
          completed++;
          next();
        });
      }
    }

    next();
  });
}

async function main() {
  console.log(`=== NEUBENCH DEEP LATENCY & CONCURRENCY BENCHMARK ===`);
  console.log(`Target: ${BASE_URL}`);

  // Warm up
  console.log('\nWarming up cache with initial requests...');
  for (const ep of ENDPOINTS) {
    await fetchOnce(`${BASE_URL}${ep}`);
  }

  const stages = [
    { concurrency: 10, total: 30 },
    { concurrency: 25, total: 50 },
    { concurrency: 50, total: 100 },
    { concurrency: 75, total: 150 },
  ];

  const summary = [];
  for (const s of stages) {
    const res = await runStage(s.concurrency, s.total);
    summary.push(res);
  }

  console.log('\n======================================================');
  console.log('FINAL BENCHMARK CONSOLIDATED MATRIX:');
  console.log('======================================================');
  console.table(summary);
}

main().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
