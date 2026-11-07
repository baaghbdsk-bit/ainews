import type { StoryDisplay } from './timeline-shared.ts';
import { areDuplicateStories, deduplicateStories } from './story-dedup.ts';

const LAUNCH_LANGUAGE = /\b(?:introduce(?:s|d|ing)?|unveil(?:s|ed)?|release(?:s|d|ing)?|launch(?:es|ed|ing)?|announce(?:s|d|ing)?|debut(?:s|ed)?|ship(?:s|ped|ping)?|rolls?\s+out|now\s+available|acquires?|discloses?)\b/i;
const TIER1_LABS = /\b(?:openai|google|deepmind|anthropic|meta|nvidia|deepseek|mistral|microsoft|apple|asml|tsmc|thinking machines|metr|xai)\b/i;
const NAMED_FLAGSHIP_MODELS = /\b(?:gpt[-\s]?[56]|claude[-\s]?[34]|gemini[-\s]?[234]|deepseek[-\s]?(?:v[34]|r1)|llama[-\s]?[34]|mistral[-\s]?(?:large|pixtral)|grok[-\s]?[34]|qwen[-\s]?2\.5|inkling|codemender|genie[-\s]?4)\b/i;
const HIGH_IMPACT_THEMES = /\b(?:billion|trillion|ipo|valuation|funding round|mega-round|exploit|vulnerabilit(?:y|ies)|cyber|kernel|linux|firefox|sell-off|plunge|rout|semiconductor|nasdaq|zero[- ]day|breakthrough|benchmark|supercluster|blackwell|quantum|open[- ]weights?|radar|conductor|fleet)\b/i;
const NICHE_FLUFF_NOISE = /\b(?:shopify|crm|ecommerce|e-commerce|avatar|golfwiz|flipsnack|cult\.fit|signups|webinar|student|protest|school|children|lawsuit|certificate|p&c agencies|insurgrid|resignation of director|course|podcast|how to|guide|tutorial|opinion|local city|council|book|hotel|travel agent|campus|protest)\b/i;
const ROUTINE_LANGUAGE = /\b(?:customer story|case study|partners?\s+to|integrat(?:es|ed|ing)|pricing|tutorial|guide|webinar|community|newsletter)\b/i;

function storyText(story: StoryDisplay): string {
  return `${story.title} ${story.summary || ''} ${story.significance || ''}`;
}

function companyKey(story: StoryDisplay): string {
  return (story.company || story.source || '').trim().toLowerCase();
}

/**
 * Score a story for the daily highlight briefing. The score strictly prioritizes
 * what people in the AI ecosystem are actually talking about (frontier lab releases,
 * major architecture breakthroughs, massive compute/funding shocks) while severely
 * penalizing routine B2B features, plugins, press releases, and niche noise.
 */
export function scoreDigestStory(story: StoryDisplay, recencyIndex = 0): number {
  const title = story.title || '';
  const text = storyText(story);
  let score = Math.max(0, 5 - recencyIndex * 0.1);

  // 1. Tier 1 Leading AI Giants & Labs (Who the AI community actually discusses)
  const isTier1 = TIER1_LABS.test(story.company || '') || TIER1_LABS.test(title);
  if (isTier1) score += 35;

  // 2. Named Frontier Flagship Models
  if (NAMED_FLAGSHIP_MODELS.test(title)) score += 30;
  else if (NAMED_FLAGSHIP_MODELS.test(text)) score += 15;

  // 3. High-Impact Industry / Technical Shockwaves
  if (HIGH_IMPACT_THEMES.test(title)) score += 25;
  else if (HIGH_IMPACT_THEMES.test(text)) score += 10;

  // 4. Topic Bonus
  if (story.topic === 'Models') score += 15;
  else if (story.topic === 'Dev Tools & Infra') score += 10;
  else if (story.topic === 'Research') score += 8;

  // 5. Concrete Launch Action
  if (LAUNCH_LANGUAGE.test(title)) score += 12;

  // 6. Heavy Penalties for Routine Noise / Marketing / Non-Highlight Fluff
  if (NICHE_FLUFF_NOISE.test(title)) score -= 55;
  if (NICHE_FLUFF_NOISE.test(text)) score -= 25;

  if (/\b(?:shopify|golf|marketing|sales|conversion|signups|flipsnack|cult\.fit)\b/i.test(title)) score -= 40;
  if (ROUTINE_LANGUAGE.test(title)) score -= 20;

  return score;
}

function isMajorStory(story: StoryDisplay, score: number): boolean {
  return score >= 60;
}

/**
 * Select the stories shown in “What Happened Today”. Company diversity remains
 * useful, but a high-impact launch is allowed to displace a routine story from
 * the same company instead of disappearing behind it.
 */
function isJunkStory(s: StoryDisplay): boolean {
  const t = `${s.title || ''} ${s.summary || ''}`.toLowerCase();
  return t.includes('hacking fears') || t.includes('limited cybersecurity data');
}

export function selectDigestHighlights(stories: StoryDisplay[], limit = 5): StoryDisplay[] {
  stories = deduplicateStories(stories.filter((s) => !isJunkStory(s)));
  const ranked = stories
    .map((story, index) => {
      const score = scoreDigestStory(story, index);
      return { story, index, score, major: isMajorStory(story, score) };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const selected: typeof ranked = [];
  const seenCompanies = new Set<string>();

  for (const candidate of ranked) {
    if (selected.length >= limit) break;
    // Strict semantic deduplication: no copycat/duplicate of an already selected story
    if (selected.some((sel) => areDuplicateStories(sel.story, candidate.story))) continue;

    const key = companyKey(candidate.story);
    if (key && seenCompanies.has(key) && !candidate.major) continue;
    selected.push(candidate);
    if (key) seenCompanies.add(key);
  }

  // If the window contains fewer than `limit` distinct companies, fill the
  // remaining slots with the next highest-impact stories.
  if (selected.length < limit) {
    const selectedStories = new Set(selected.map((candidate) => candidate.story.slug));
    for (const candidate of ranked) {
      if (selected.length >= limit) break;
      if (selectedStories.has(candidate.story.slug)) continue;
      if (selected.some((sel) => areDuplicateStories(sel.story, candidate.story))) continue;
      selected.push(candidate);
      selectedStories.add(candidate.story.slug);
    }
  }

  return selected.map((candidate) => candidate.story);
}
