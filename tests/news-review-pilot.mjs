import assert from 'node:assert/strict';
import {
  runDiscovery,
  defaultUtcWindow,
} from '../src/lib/discovery/google-news.ts';
import {
  dedupeKeyForCandidate,
  validationStatusFor,
  holdReasonFor,
  clampPilotLimit,
  selectPilotCandidates,
  runDiscoveryPilot,
  isPilotEnabled,
} from '../src/lib/discovery/pilot.ts';

let passed = 0;
let failed = 0;
function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log('[PASS] ' + name);
  } else {
    failed += 1;
    console.error('[FAIL] ' + name + (detail ? ' — ' + detail : ''));
  }
}

const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Anthropic launches Claude update - Example Publisher</title>
      <link>https://news.google.com/rss/articles/abc123?oc=5</link>
      <pubDate>Sun, 25 Oct 2026 12:00:00 GMT</pubDate>
      <source url="https://example.com">Example Publisher</source>
    </item>
  </channel>
</rss>`;
const publisherHtml = `<!doctype html><html><head>
  <title>Anthropic launches Claude update</title>
  <link rel="canonical" href="https://example.com/claude-update" />
  <meta property="article:published_time" content="2026-10-25T11:00:00Z" />
</head><body></body></html>`;
const window = { start: '2026-10-25T00:00:00.000Z', end: '2026-10-26T00:00:00.000Z' };
const mockFetch = async (url) => {
  if (String(url).includes('/rss/search')) {
    return { ok: true, status: 200, url: String(url), headers: new Headers(), text: async () => rssXml };
  }
  return { ok: true, status: 200, url: 'https://example.com/claude-update', headers: new Headers(), text: async () => publisherHtml };
};

const result = await runDiscovery({
  queries: [{ id: 'anthropic-claude', label: 'Anthropic / Claude', query: 'Anthropic OR Claude AI' }],
  window,
  fetchImpl: mockFetch,
});

check('discovery produced candidate', result.candidates.length === 1);
const candidate = result.candidates[0];
check('candidate accepted', candidate.status === 'accepted');

const key = dedupeKeyForCandidate(candidate);
check('dedupe key stable', key === dedupeKeyForCandidate({ ...candidate }));
check('validation status validated', validationStatusFor(candidate) === 'validated');
check('hold reason null for accepted', holdReasonFor(candidate) === null);
check('clamp limit lower bound', clampPilotLimit(0, 10) === 1);
check('clamp limit upper bound', clampPilotLimit(50, 10) === 10);
check('clamp limit default', clampPilotLimit('nope') === 25);

const selection = selectPilotCandidates(result, { limit: 1, discoveredAt: '2026-10-25T12:00:00.000Z' });
check('selected one candidate', selection.inserts.length === 1);
check('summary one candidate', selection.summaries.length === 1);
const insert = selection.inserts[0];
check('insert headline', insert.headline === candidate.title);
check('insert review pending', insert.review_status === 'pending');
check('insert not approved', insert.approved_for_publishing === false);
check('insert validation status', insert.validation_status === 'validated');
check('insert dedupe key', insert.dedupe_key === key);
check('insert discovered_at', insert.discovered_at === '2026-10-25T12:00:00.000Z');
check('insert google news url', insert.google_news_url === candidate.googleNewsUrl);
check('insert canonical url', insert.canonical_url === candidate.canonicalUrl);
check('insert original url', insert.original_url === candidate.publisherUrl);
check('insert reasons array', Array.isArray(insert.reasons));
check('source evidence present', !!insert.source_evidence);

// bounded batch with many duplicate-ish candidates
const manyXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
${Array.from({ length: 5 }, (_, i) => `  <item>
    <title>Story ${i} - Example Publisher</title>
    <link>https://news.google.com/rss/articles/id${i}?oc=5</link>
    <pubDate>Sun, 25 Oct 2026 12:00:00 GMT</pubDate>
    <source url="https://example.com">Example Publisher</source>
  </item>`).join('\n')}
</channel></rss>`;
const manyFetch = async (url) => {
  if (String(url).includes('/rss/search')) {
    return { ok: true, status: 200, url: String(url), headers: new Headers(), text: async () => manyXml };
  }
  return { ok: true, status: 200, url: 'https://example.com/story', headers: new Headers(), text: async () => publisherHtml };
};
const manyResult = await runDiscovery({
  queries: [{ id: 'anthropic-claude', label: 'Anthropic / Claude', query: 'Anthropic OR Claude AI' }],
  window,
  fetchImpl: manyFetch,
});
const bounded = selectPilotCandidates(manyResult, { limit: 2 });
check('bounded batch respects limit', bounded.inserts.length <= 2);

// held candidate mapping
const inaccessibleFetch = async (url) => {
  if (String(url).includes('/rss/search')) {
    return { ok: true, status: 200, url: String(url), headers: new Headers(), text: async () => rssXml };
  }
  return { ok: false, status: 403, url: 'https://example.com/missing', headers: new Headers(), text: async () => '' };
};
const heldResult = await runDiscovery({
  queries: [{ id: 'anthropic-claude', label: 'Anthropic / Claude', query: 'Anthropic OR Claude AI' }],
  window,
  fetchImpl: inaccessibleFetch,
});
check('held candidate exists', heldResult.candidates.some((c) => c.status === 'held'));
const heldCandidate = heldResult.candidates.find((c) => c.status === 'held');
check('held validation status', validationStatusFor(heldCandidate) === 'held');
check('held reason present', typeof holdReasonFor(heldCandidate) === 'string');

// runDiscoveryPilot dry run does not require DB and does not write
const pilot = await runDiscoveryPilot({
  dryRun: true,
  limit: 1,
  window,
  queries: [{ id: 'anthropic-claude', label: 'Anthropic / Claude', query: 'Anthropic OR Claude AI' }],
  fetchImpl: mockFetch,
  discoveredAt: '2026-10-25T12:00:00.000Z',
});
check('pilot dry run ok', pilot.ok === true);
check('pilot dry run flag', pilot.dryRun === true);
check('pilot dry run no inserts', pilot.insertedIds.length === 0);
check('pilot dry run metrics', !!pilot.metrics);
check('pilot dry run candidates', pilot.candidates.length <= 1);

// writes disabled by default
check('pilot disabled by default', isPilotEnabled() === false);
const writeAttempt = await runDiscoveryPilot({
  dryRun: false,
  limit: 1,
  window,
  queries: [{ id: 'anthropic-claude', label: 'Anthropic / Claude', query: 'Anthropic OR Claude AI' }],
  fetchImpl: mockFetch,
});
check('write attempt blocked', writeAttempt.ok === false);
check('write attempt error mentions disabled', String(writeAttempt.error).includes('disabled'));

// duplicate queue prevention
const duplicatePilot = await runDiscoveryPilot({
  dryRun: true,
  limit: 5,
  window,
  queries: [{ id: 'anthropic-claude', label: 'Anthropic / Claude', query: 'Anthropic OR Claude AI' }],
  fetchImpl: mockFetch,
  existingQueueKeys: [dedupeKeyForCandidate(candidate)],
});
check('duplicate queue skipped', (duplicatePilot.metrics?.skippedDuplicatesQueue ?? 0) >= 1);

// timeline duplicate prevention
const timelinePilot = await runDiscoveryPilot({
  dryRun: true,
  limit: 5,
  window,
  queries: [{ id: 'anthropic-claude', label: 'Anthropic / Claude', query: 'Anthropic OR Claude AI' }],
  fetchImpl: mockFetch,
  existingStories: [{ slug: 'existing-story', source_url: candidate.canonicalUrl, title: candidate.title, event_date: candidate.eventDate }],
});
check('timeline duplicate skipped', (timelinePilot.metrics?.skippedDuplicatesTimeline ?? 0) >= 1);

console.log('='.repeat(70));
console.log('TOTAL: ' + (passed + failed) + ' | PASSED: ' + passed + ' | FAILED: ' + failed);
console.log('='.repeat(70));
if (failed > 0) process.exit(1);
else console.log('ALL NEWS REVIEW PILOT TESTS PASSED');
