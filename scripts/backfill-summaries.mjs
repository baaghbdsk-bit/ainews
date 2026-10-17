// Drains the reader-facing summary backlog by repeatedly calling the app's
// cron endpoint in summarize-only mode.
//
//   npm run summarize:backfill
//   npm run summarize:backfill -- --base-url https://ainews-smel.vercel.app
//   npm run summarize:backfill -- --max-rows 362 --limit 50   (just the deckless rows)
//
// The endpoint is idempotent and resumable (progress lives in the stories table
// and `summary_attempts`), so stopping early is always safe: run it again later.
//
// Options:
//   --base-url <url>   app to call (default http://localhost:3000 or $BASE_URL)
//   --limit <n>        rows per call (default 40; the route caps it at 500)
//   --max-rows <n>     stop after this many summaries (default: no limit)
//   --max-minutes <n>  stop after this long (default 20)
//   --passes <n>       stop after this many calls (default: no limit)
//
// Requires CRON_SECRET in the environment. The `summarize:backfill` npm script
// loads .env.local, so the local value is picked up automatically.

const args = process.argv.slice(2);

function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

const baseUrl = (argValue('--base-url', process.env.BASE_URL ?? 'http://localhost:3000')).replace(
  /\/+$/,
  '',
);
const secret = process.env.CRON_SECRET;
const limit = Math.floor(positiveNumber(argValue('--limit', '40'), 40));
const maxRows = positiveNumber(argValue('--max-rows', ''), Number.POSITIVE_INFINITY);
const maxMinutes = positiveNumber(argValue('--max-minutes', '20'), 20);
const maxPasses = positiveNumber(argValue('--passes', ''), Number.POSITIVE_INFINITY);

if (!secret || secret === 'change-me') {
  console.error(
    'CRON_SECRET is not set (or is still the placeholder).\n' +
      'Use the npm script (it loads .env.local) or export CRON_SECRET first.',
  );
  process.exit(1);
}

const deadline = Date.now() + maxMinutes * 60_000;
const startedAt = Date.now();

let total = 0;
let passes = 0;
let noProgress = 0;
let throttledStreak = 0;
let remaining = null;
let stopReason = 'unknown';

console.log(`Summarize backfill -> ${baseUrl} (limit=${limit}/call, max ${maxMinutes}min)`);

while (true) {
  if (passes >= maxPasses) {
    stopReason = `reached --passes ${maxPasses}`;
    break;
  }
  if (Date.now() >= deadline) {
    stopReason = `reached --max-minutes ${maxMinutes}`;
    break;
  }
  if (total >= maxRows) {
    stopReason = `reached --max-rows ${maxRows}`;
    break;
  }

  passes += 1;
  let body;
  try {
    const res = await fetch(`${baseUrl}/api/cron/ingest?mode=summarize&summarizeLimit=${limit}`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      console.error(`pass ${passes}: HTTP ${res.status} — ${JSON.stringify(body ?? '(no body)')}`);
      stopReason = `HTTP ${res.status}`;
      process.exitCode = 1;
      break;
    }
  } catch (error) {
    console.error(`pass ${passes}: request failed — ${error.message}`);
    stopReason = 'request failed (is the app running?)';
    process.exitCode = 1;
    break;
  }

  const summarized = body.summarized ?? 0;
  const rateLimited = body.rateLimited === true;
  const errors = Array.isArray(body.errors) ? body.errors : [];
  remaining = body.summaryRemaining ?? remaining;
  total += summarized;

  console.log(
    `pass ${passes}: +${summarized} (total ${total}) remaining=${remaining} rateLimited=${rateLimited}` +
      (errors.length ? ` errors=${errors.length}` : ''),
  );
  for (const message of errors.slice(0, 5)) console.log(`    ! ${message}`);

  if (remaining === 0) {
    stopReason = 'backlog drained';
    break;
  }

  // No progress at all means the queue is either stuck on rows the model can't
  // summarize or the provider is unavailable; stop rather than spin.
  if (summarized === 0) {
    noProgress += 1;
    if (noProgress >= 3) {
      stopReason = 'no progress across 3 passes';
      break;
    }
  } else {
    noProgress = 0;
  }

  throttledStreak = rateLimited && summarized === 0 ? throttledStreak + 1 : 0;
  if (throttledStreak >= 2) {
    stopReason = 'provider is throttling us';
    break;
  }

  if (body.ok === false) {
    stopReason = `endpoint error: ${body.error ?? 'unknown'}`;
    process.exitCode = 1;
    break;
  }
}

const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
console.log(
  `SUMMARY passes=${passes} summarized=${total} remaining=${remaining ?? '?'} elapsed=${elapsedSeconds}s stop="${stopReason}"`,
);
