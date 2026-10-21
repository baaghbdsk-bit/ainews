import type { StoryDisplay } from '@/lib/timeline-shared';

/**
 * AI Concept clusters for semantic expansion and relevance scoring.
 * Enables zero-cost, instant client/server semantic matching without paid LLM/embedding APIs.
 */
export const AI_CONCEPTS: Record<string, { label: string; terms: string[] }> = {
  reasoning: {
    label: 'Reasoning Models',
    terms: [
      'reasoning',
      'thinking',
      'chain of thought',
      'cot',
      'o1',
      'o3',
      'r1',
      'deepseek',
      'reflection',
      'strawberry',
      'test-time compute',
      'deliberation',
      'math',
      'proof',
    ],
  },
  open_weights: {
    label: 'Open Weights & Open Source',
    terms: [
      'open source',
      'open-source',
      'open weight',
      'open weights',
      'llama',
      'mistral',
      'qwen',
      'gemma',
      'deepseek',
      'weights release',
      'hugging face',
      'apache',
      'permissive',
      'local ai',
    ],
  },
  agents: {
    label: 'AI Agents & Automation',
    terms: [
      'agent',
      'agents',
      'agentic',
      'tool use',
      'function calling',
      'computer use',
      'operator',
      'mcp',
      'model context protocol',
      'autonomous',
      'swarm',
      'workflows',
      'action model',
    ],
  },
  hardware: {
    label: 'Chips & Compute Infrastructure',
    terms: [
      'chip',
      'chips',
      'gpu',
      'tpu',
      'blackwell',
      'h100',
      'b200',
      'b100',
      'nvidia',
      'amd',
      'tsmc',
      'semiconductor',
      'datacenter',
      'compute',
      'cluster',
      'wafer',
      'memory bandwidth',
    ],
  },
  policy_safety: {
    label: 'Policy, Safety & Regulation',
    terms: [
      'policy',
      'regulation',
      'act',
      'ban',
      'sanction',
      'export controls',
      'ftc',
      'copyright',
      'lawsuit',
      'safety',
      'alignment',
      'risk',
      'eu ai act',
      'white house',
      'executive order',
      'security',
    ],
  },
  generative_media: {
    label: 'Vision, Video & Media',
    terms: [
      'vision',
      'image',
      'video',
      'diffusion',
      'flux',
      'sora',
      'genai',
      'midjourney',
      'runway',
      'kling',
      'veo',
      'dall-e',
      'multimodal',
      'voice',
      'audio',
      'speech',
      'tts',
    ],
  },
  coding: {
    label: 'Code & Software Engineering',
    terms: [
      'code',
      'coding',
      'swe-bench',
      'benchmark',
      'evals',
      'cursor',
      'copilot',
      'devin',
      'sonnet',
      'claude code',
      'programming',
      'compiler',
      'refactor',
    ],
  },
  frontier_llm: {
    label: 'Frontier Models',
    terms: [
      'frontier',
      'gpt-4',
      'gpt-5',
      'claude',
      'gemini',
      'context window',
      'tokens',
      'pretraining',
      'rlhf',
      'grpo',
      'moe',
      'mixture of experts',
    ],
  },
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'about', 'how', 'what', 'when', 'where', 'who', 'why',
]);

function cleanText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
}

function tokenize(text: string): string[] {
  return cleanText(text)
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export interface SemanticSearchResult {
  story: StoryDisplay;
  score: number;
  matchedConcepts: string[];
}

/**
 * Perform semantic search with AI concept expansion and weighted relevance scoring.
 */
export function performSemanticSearch(
  stories: StoryDisplay[],
  rawQuery: string,
): SemanticSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // 1. Identify which AI concepts the user is asking about
  const activeConcepts = new Set<string>();
  for (const [conceptKey, concept] of Object.entries(AI_CONCEPTS)) {
    for (const term of concept.terms) {
      if (query.includes(term) || queryTokens.some((t) => term.includes(t) && t.length >= 3)) {
        activeConcepts.add(conceptKey);
        break;
      }
    }
  }

  const results: SemanticSearchResult[] = [];

  for (const story of stories) {
    const titleClean = cleanText(story.title);
    const summaryClean = cleanText(story.summary || '');
    const significanceClean = cleanText(story.significance || '');
    const whyItMattersClean = cleanText(story.whyItMatters || '');
    const companyClean = cleanText(story.company || '');
    const topicClean = cleanText(story.topic || '');

    let score = 0;
    const matchedConceptLabels = new Set<string>();

    // Exact query phrase matching (highest precision)
    if (titleClean.includes(query)) score += 30;
    else if (summaryClean.includes(query)) score += 15;
    else if (whyItMattersClean.includes(query) || significanceClean.includes(query)) score += 10;

    // Token frequency & position weighting
    for (const token of queryTokens) {
      // Title tokens (5x)
      if (titleClean.includes(token)) score += 6;
      // Company match (4x)
      if (companyClean.includes(token)) score += 4;
      // Topic match (3x)
      if (topicClean.includes(token)) score += 3;
      // Summary / Why it matters tokens (2x)
      if (summaryClean.includes(token)) score += 2;
      if (whyItMattersClean.includes(token) || significanceClean.includes(token)) score += 2;
    }

    // Semantic concept expansion matching
    const storyCombinedText = `${titleClean} ${summaryClean} ${significanceClean} ${whyItMattersClean} ${companyClean}`;

    for (const conceptKey of activeConcepts) {
      const concept = AI_CONCEPTS[conceptKey];
      let conceptHits = 0;
      for (const term of concept.terms) {
        if (storyCombinedText.includes(term)) {
          conceptHits++;
        }
      }
      if (conceptHits > 0) {
        // Boost for semantic alignment
        score += Math.min(conceptHits * 3, 15);
        matchedConceptLabels.add(concept.label);
      }
    }

    // Include if it meets threshold
    if (score > 0) {
      results.push({
        story,
        score,
        matchedConcepts: Array.from(matchedConceptLabels),
      });
    }
  }

  // Sort descending by relevance score
  return results.sort((a, b) => b.score - a.score);
}

