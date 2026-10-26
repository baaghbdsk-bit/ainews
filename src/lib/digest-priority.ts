import type { StoryDisplay } from '@/lib/timeline-shared';

const LAUNCH_LANGUAGE = /\b(?:introduce(?:s|d|ing)?|unveil(?:s|ed)?|release(?:s|d|ing)?|launch(?:es|ed|ing)?|announce(?:s|d|ing)?|debut(?:s|ed)?|ship(?:s|ped|ping)?|rolls?\s+out|now\s+available)\b/i;
const NAMED_MODEL = /\b(?:gpt|claude|gemini|llama|qwen|mistral|deepseek|grok|kimi)[-\s]?\d+(?:\.\d+)*(?:\s+[a-z][a-z0-9-]*)?\b/i;
const MODEL_LANGUAGE = /\b(?:foundation|frontier|reasoning|open[- ]weights?|checkpoint|model|weights?)\b/i;
const MILESTONE_LANGUAGE = /\b(?:breakthrough|landmark|flagship|state[- ]of[- ]the[- ]art|industry[- ]wide|major|first)\b/i;
const ROUTINE_LANGUAGE = /\b(?:customer story|case study|partners?\s+to|integrat(?:es|ed|ing)|pricing|tutorial|guide|webinar|community|newsletter)\b/i;

function storyText(story: StoryDisplay): string {
  return `${story.title} ${story.summary || ''} ${story.significance || ''}`;
}

function companyKey(story: StoryDisplay): string {
  return (story.company || story.source || '').trim().toLowerCase();
}

/**
 * Score a story for the daily executive briefing. The score deliberately
 * favors concrete launches and frontier model releases over routine product
 * updates, while a small recency bonus keeps ties chronological.
 */
export function scoreDigestStory(story: StoryDisplay, recencyIndex = 0): number {
  const title = story.title;
  const text = storyText(story);
  let score = Math.max(0, 5 - recencyIndex * 0.1);

  if (story.topic === 'Models') score += 16;
  else if (story.topic === 'Products') score += 4;

  if (LAUNCH_LANGUAGE.test(title)) score += 12;
  if (NAMED_MODEL.test(title)) score += 10;
  if (MODEL_LANGUAGE.test(text)) score += 4;
  if (MILESTONE_LANGUAGE.test(text)) score += 4;
  if (ROUTINE_LANGUAGE.test(title)) score -= 3;

  return score;
}

function isMajorStory(story: StoryDisplay, score: number): boolean {
  return (
    (story.topic === 'Models' && LAUNCH_LANGUAGE.test(story.title) && NAMED_MODEL.test(story.title)) ||
    score >= 30
  );
}

/**
 * Select the stories shown in “What Happened Today”. Company diversity remains
 * useful, but a high-impact launch is allowed to displace a routine story from
 * the same company instead of disappearing behind it.
 */
export function selectDigestHighlights(stories: StoryDisplay[], limit = 5): StoryDisplay[] {
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
      selected.push(candidate);
      selectedStories.add(candidate.story.slug);
    }
  }

  return selected.map((candidate) => candidate.story);
}
