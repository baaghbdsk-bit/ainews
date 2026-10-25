const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const results = [];
function record(id, name, ok, detail = '') {
  results.push({ id, name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  try {
    const probe = await fetch(BASE + '/', { signal: AbortSignal.timeout(5000) });
    if (!probe.ok) throw new Error(`status ${probe.status}`);
  } catch (err) {
    console.error(`Cannot reach ${BASE} (${err.message ?? err}).`);
    process.exit(2);
  }

  const adminPage = await fetch(BASE + '/admin', { redirect: 'manual' });
  record('A01', 'GET /admin without session redirects away', adminPage.status >= 300 && adminPage.status < 400, `status=${adminPage.status}`);

  const getReview = await fetch(BASE + '/api/news-review');
  record('A02', 'GET /api/news-review without session → 401', getReview.status === 401, `status=${getReview.status}`);

  const postReview = await fetch(BASE + '/api/news-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000000', action: 'approve' }),
  });
  record('A03', 'POST /api/news-review without session → 401', postReview.status === 401, `status=${postReview.status}`);

  for (const path of ['/api/admin/news-review', '/api/admin/news-review/pilot', '/api/admin/review', '/api/news-review/pilot', '/api/review']) {
    const res = await fetch(BASE + path);
    record(`A04-${path}`, `GET ${path} without session → 401`, res.status === 401, `status=${res.status}`);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n===== ADMIN AUTH SUMMARY =====\nPASS=${results.length - failed} FAIL=${failed} TOTAL=${results.length}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('ADMIN AUTH SUITE ERROR:', err);
  process.exit(1);
});
