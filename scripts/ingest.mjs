import { runIngest } from '../src/lib/feeds/ingest.ts';

const mode = process.argv[2] ?? 'full';
const summarizeLimit = process.env.SUMMARIZE_LIMIT ? Number(process.env.SUMMARIZE_LIMIT) : undefined;
const imagesLimit = process.env.IMAGES_LIMIT ? Number(process.env.IMAGES_LIMIT) : undefined;

function optsFor(m) {
  return {
    enrichOnly: m === 'enrich',
    summarizeOnly: m === 'summarize',
    imagesOnly: m === 'images',
    summarizeLimit,
    imagesLimit,
  };
}

const result = await runIngest(optsFor(mode));
console.log(JSON.stringify(result));
