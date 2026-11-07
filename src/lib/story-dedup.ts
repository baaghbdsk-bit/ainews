/**
 * Deduplication & Semantic Story Clustering Engine
 *
 * Prevents syndication copycats and duplicate coverage of the same event
 * across live RSS ingestion, the database, timeline queries, and highlights.
 */

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'after', 'amid', 'its', 'has', 'have',
  'from', 'over', 'into', 'new', 'about', 'says', 'say', 'report',
  'reports', 'news', 'launches', 'unveils', 'releases', 'announces',
  'debuts', 'rolls', 'out', 'this', 'that', 'than', 'more', 'first',
  'will', 'can', 'are', 'was', 'were', 'been', 'being', 'what', 'who',
]);

const TIER1_SOURCES = [
  'reuters', 'bloomberg', 'techcrunch', 'the verge', 'venturebeat',
  'wsj', 'wall street journal', 'financial times', 'ars technica',
  'wired', 'mit technology review', 'mit tech review', 'nature',
  'openai', 'google', 'deepmind', 'anthropic', 'meta', 'nvidia',
  'microsoft', 'apple', 'the information', 'cnbc', 'forbes', 'zdnet',
];

const SYNDICATION_NOISE = [
  'google news', 'lavx', 'biggo finance', 'tradingview', 'sedalia democrat',
  'the korea daily', 'contentgrip', 'the national', '36氪', 'gbhackers',
  'basic tutorials', 'cio', 'the business times', 'tekedia', 'govtech',
  'mobihealthnews', 'central oregon daily', 'aol.com', 'vmblog', 'nextgov',
  'medical product outsourcing', 'kingy ai', 'gv wire', 'shattered.io',
  'fourweekmba', 'the lufkin daily news',
];

/**
 * Normalizes title text by stripping publisher tags, domain suffixes, punctuation, and extra whitespace.
 */
export function normalizeTitleForDedup(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s*\[\d{4}\]/g, '')
    .replace(/\s*[-–—|:]\s*(?:google news|lavx|techcrunch|reuters|the verge|bloomberg|ap|cnbc|forbes|zdnet|wired|unite\.ai|biggo finance|tradingview|sedalia democrat|the korea daily|contentgrip|the national|36氪|gbhackers|basic tutorials|yahoo|cio|the business times|tekedia|govtech|mobihealthnews|central oregon daily|aol\.com|fortune|vmblog|nextgov|medical product outsourcing|kingy ai|the times of india|etv bharat|mezha\.net|clean technica|marktechpost).*/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a filtered token set from normalized title text.
 */
export function getDedupTokens(title: string): Set<string> {
  const norm = normalizeTitleForDedup(title);
  const words = norm.split(' ');
  const tokens = new Set<string>();
  for (const w of words) {
    if (w.length > 2 && !STOP_WORDS.has(w)) {
      tokens.add(w);
    }
  }
  return tokens;
}

/**
 * Detects if two stories cover the exact same underlying event/launch/milestone.
 */
export function areDuplicateStories(
  a: { title: string; date?: string; event_date?: string },
  b: { title: string; date?: string; event_date?: string },
): boolean {
  const normA = normalizeTitleForDedup(a.title);
  const normB = normalizeTitleForDedup(b.title);

  // Exact normalized match
  if (normA === normB && normA.length > 0) return true;

  // 1. Signature check: GPT-6 Cyber / Astra security model launch
  const isGpt6CyberA =
    normA.includes('gpt 6') &&
    (normA.includes('cyber') || normA.includes('firefox') || normA.includes('linux') || normA.includes('exploit') || normA.includes('astra'));
  const isGpt6CyberB =
    normB.includes('gpt 6') &&
    (normB.includes('cyber') || normB.includes('firefox') || normB.includes('linux') || normB.includes('exploit') || normB.includes('astra'));
  if (isGpt6CyberA && isGpt6CyberB) return true;

  // 2. Signature check: OpenAI $11B funding / $1.25T valuation
  const isOaiFundingA =
    normA.includes('openai') &&
    (normA.includes('11 billion') || normA.includes('1 25 trillion') || normA.includes('valuation'));
  const isOaiFundingB =
    normB.includes('openai') &&
    (normB.includes('11 billion') || normB.includes('1 25 trillion') || normB.includes('valuation'));
  if (isOaiFundingA && isOaiFundingB) return true;

  // 3. Signature check: Anthropic IPO backlash / timing
  const isAnthropicIpoA = normA.includes('anthropic') && normA.includes('ipo');
  const isAnthropicIpoB = normB.includes('anthropic') && normB.includes('ipo');
  if (isAnthropicIpoA && isAnthropicIpoB) return true;

  // 4. Signature check: OpenAI office bugging / spying charges
  const isBuggingA = (normA.includes('bugging') || normA.includes('spying')) && normA.includes('openai');
  const isBuggingB = (normB.includes('bugging') || normB.includes('spying')) && normB.includes('openai');
  if (isBuggingA && isBuggingB) return true;

  // 5. Signature check: Google Chromebook student lawsuit
  const isChromebookA = normA.includes('chromebook') && (normA.includes('sue') || normA.includes('lawsuit') || normA.includes('children') || normA.includes('student'));
  const isChromebookB = normB.includes('chromebook') && (normB.includes('sue') || normB.includes('lawsuit') || normB.includes('children') || normB.includes('student'));
  if (isChromebookA && isChromebookB) return true;

  // 6. Signature check: DeepSeek DAU / Active Users milestone
  const isDeepSeekDauA = normA.includes('deepseek') && (normA.includes('dau') || normA.includes('daily active') || normA.includes('million users'));
  const isDeepSeekDauB = normB.includes('deepseek') && (normB.includes('dau') || normB.includes('daily active') || normB.includes('million users'));
  if (isDeepSeekDauA && isDeepSeekDauB) return true;

  // 7. General Token Overlap (Dice / Jaccard Overlap Coefficient)
  const tokensA = getDedupTokens(a.title);
  const tokensB = getDedupTokens(b.title);
  if (tokensA.size === 0 || tokensB.size === 0) return false;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared++;
  }

  const minSize = Math.min(tokensA.size, tokensB.size);
  const overlap = shared / minSize;

  // If over 46% of key terms match, they are reporting the identical story
  return overlap >= 0.46;
}

/**
 * Scores a story to select the most authoritative canonical version in a cluster.
 */
function scoreCanonicalAuthority(story: {
  title: string;
  source?: string | null;
  summary?: string | null;
  upvoteCount?: number;
}): number {
  let score = 0;
  const src = (story.source || '').toLowerCase();
  const title = (story.title || '').toLowerCase();

  // Tier 1 authoritative sources get strong preference
  if (TIER1_SOURCES.some((t) => src.includes(t) || title.includes(t))) {
    score += 40;
  }

  // Prefer direct reporting from primary tech outlets (VentureBeat, TechCrunch, Reuters, Bloomberg, etc.)
  if (/\b(?:venturebeat|reuters|bloomberg|techcrunch|the verge|wsj|wired|ars technica|mit technology review)\b/i.test(src) ||
      /\b(?:venturebeat|reuters|bloomberg|techcrunch|the verge|wsj|wired|ars technica|mit technology review)\b/i.test(title)) {
    score += 35;
  }

  // Penalize composite newsletter roundups (e.g. TLDR, multi-topic digests)
  if (/\b(?:tldr|roundup|weekly|digest|curated link)\b/i.test(src) || /\b(?:tldr|roundup|weekly|digest)\b/i.test(title)) {
    score -= 60;
  }
  // Penalize titles containing emojis (typical of newsletters/link dumps)
  if (/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(story.title) || /[\u2600-\u27BF]/.test(story.title)) {
    score -= 50;
  }
  // Penalize multi-headline composite titles (e.g. "Model A drops, Model B updates, Model C launches")
  const labMentions = ['openai', 'anthropic', 'google', 'meta', 'deepseek', 'mistral', 'inkling'].filter((l) => title.includes(l)).length;
  if (labMentions >= 2) {
    score -= 40;
  }

  // Low-quality syndication / scrapers penalized
  if (SYNDICATION_NOISE.some((noise) => src.includes(noise) || title.includes(noise))) {
    score -= 30;
  }

  // Completeness of content
  if (story.summary && story.summary.length > 50) {
    score += 10;
  }

  // Community signal
  if (story.upvoteCount && story.upvoteCount > 0) {
    score += Math.min(story.upvoteCount * 2, 20);
  }

  return score;
}

/**
 * Deduplicates an array of stories, merging duplicates into the highest-quality
 * canonical story and aggregating upvote signals.
 */
export function deduplicateStories<
  T extends {
    title: string;
    date?: string;
    event_date?: string;
    source?: string | null;
    summary?: string | null;
    upvoteCount?: number;
  },
>(stories: T[]): T[] {
  if (!stories || stories.length <= 1) return stories || [];

  const clusters: { canonical: T; items: T[]; score: number }[] = [];

  for (const story of stories) {
    let matchedCluster: (typeof clusters)[0] | null = null;

    for (const cluster of clusters) {
      if (areDuplicateStories(cluster.canonical, story)) {
        matchedCluster = cluster;
        break;
      }
    }

    const storyScore = scoreCanonicalAuthority(story);

    if (matchedCluster) {
      matchedCluster.items.push(story);
      // If this copy is from a much more authoritative source, promote it to canonical
      if (storyScore > matchedCluster.score) {
        matchedCluster.canonical = story;
        matchedCluster.score = storyScore;
      }
    } else {
      clusters.push({
        canonical: story,
        items: [story],
        score: storyScore,
      });
    }
  }

  return clusters.map((cluster) => {
    const finalStory = { ...cluster.canonical };
    // Aggregate upvotes from all copies into the canonical story
    const totalVotes = cluster.items.reduce((acc, it) => acc + (it.upvoteCount || 0), 0);
    if (totalVotes > (finalStory.upvoteCount || 0)) {
      finalStory.upvoteCount = totalVotes;
    }
    return finalStory;
  });
}
