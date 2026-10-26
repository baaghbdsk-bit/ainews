import assert from 'node:assert/strict';
import { selectDigestHighlights } from '../src/lib/digest-priority.ts';

function story(overrides) {
  return {
    id: overrides.slug,
    slug: overrides.slug,
    title: overrides.title,
    summary: overrides.summary ?? '',
    significance: '',
    source: overrides.source ?? overrides.company,
    sourceUrl: 'https://example.com/story',
    company: overrides.company,
    imageUrl: null,
    deck: null,
    keyPoints: null,
    whyItMatters: null,
    topic: overrides.topic ?? 'Products',
    date: '2026-10-26',
    day: '26',
    month: 'Oct',
    year: '2026',
    color: 'cyan',
  };
}

const stories = [
  story({
    slug: 'routine-openai-update',
    title: 'OpenAI shares a customer story about AI workflows',
    company: 'OpenAI',
  }),
  story({
    slug: 'google-research',
    title: 'Google publishes new AI research findings',
    company: 'Google',
    topic: 'Research',
  }),
  story({
    slug: 'terra',
    title: 'Introducing GPT-6.1 Terra',
    summary: 'OpenAI introduces a new frontier model for fast computer use.',
    company: 'OpenAI',
    topic: 'Models',
  }),
  story({
    slug: 'amazon-platform',
    title: 'Amazon expands its cloud AI platform',
    company: 'Amazon',
    topic: 'Dev Tools & Infra',
  }),
  story({
    slug: 'anthropic-business',
    title: 'Anthropic announces an enterprise partnership',
    company: 'Anthropic',
    topic: 'Business',
  }),
  story({
    slug: 'meta-research',
    title: 'Meta publishes a new evaluation report',
    company: 'Meta',
    topic: 'Research',
  }),
];

const highlights = selectDigestHighlights(stories);
const titles = highlights.map((highlight) => highlight.title);

assert.equal(titles[0], 'Introducing GPT-6.1 Terra');
assert.ok(titles.includes('Introducing GPT-6.1 Terra'), 'major model launch should be highlighted');
assert.equal(new Set(highlights.map((highlight) => highlight.company)).size, 5);

console.log('Daily digest priority regression tests passed.');
