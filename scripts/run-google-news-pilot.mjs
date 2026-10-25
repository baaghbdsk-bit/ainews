import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runDiscoveryPilot, isPilotEnabled } from '../src/lib/discovery/pilot.ts';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const write = args.write === true;
const dryRun = !write;

if (write && args['confirm-write'] !== true) {
  console.error('Refusing to write: pass --confirm-write together with --write.');
  process.exit(1);
}

if (write && !isPilotEnabled()) {
  console.error('Refusing to write: set GOOGLE_NEWS_PILOT_ENABLED=true first.');
  process.exit(1);
}

const limit = Number(args.limit ?? 25);
const hours = Number(args.hours ?? 24);
const queryIds = args.queries ? String(args.queries).split(',').map((value) => value.trim()).filter(Boolean) : undefined;

const result = await runDiscoveryPilot({
  dryRun,
  limit: Number.isFinite(limit) ? limit : 25,
  hours: Number.isFinite(hours) ? hours : 24,
  queryIds,
  validatePublishers: args['skip-validation'] !== true,
  windowStart: args['window-start'],
  windowEnd: args['window-end'],
});

const outputPath = resolve(args.output ?? 'scratch/google-news-pilot-result.json');
writeFileSync(outputPath, JSON.stringify(result, null, 2));

console.log('Google News pilot complete');
console.log('dryRun:', result.dryRun);
console.log('discovered:', result.metrics?.rawItems ?? 0);
console.log('accepted:', result.metrics?.accepted ?? 0);
console.log('held:', result.metrics?.held ?? 0);
console.log('selected:', result.metrics?.selected ?? 0);
console.log('inserted:', result.metrics?.inserted ?? 0);
console.log('skippedQueue:', result.metrics?.skippedDuplicatesQueue ?? 0);
console.log('skippedTimeline:', result.metrics?.skippedDuplicatesTimeline ?? 0);
console.log('Result written to:', outputPath);
