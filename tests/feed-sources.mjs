import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/feeds/fetch-ai-news.ts', import.meta.url), 'utf8');

const expected = [
  "name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml'",
  "name: 'Apple Machine Learning Research', url: 'https://machinelearning.apple.com/rss.xml'",
  "name: 'Microsoft (AI & tech news)', url: 'https://blogs.microsoft.com/feed/'",
  "name: 'Meta News', url: 'https://about.fb.com/news/feed/'",
  "name: 'Mistral News (official)', url: 'https://mistral.ai/news/rss'",
];

for (const entry of expected) {
  if (!source.includes(entry)) {
    console.error(`Missing expected feed entry: ${entry}`);
    process.exit(1);
  }
}

const feedCount = (source.match(/name:\s*'/g) || []).length;
if (feedCount !== 26) {
  console.error(`Expected 26 feed entries, found ${feedCount}`);
  process.exit(1);
}

console.log(`feed-sources: verified ${expected.length} new sources in ${feedCount} total feeds`);
