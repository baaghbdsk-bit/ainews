import { AI_MODELS_DATA, BENCHMARK_DEFINITIONS } from './data';
import type { AIModelRecord, BenchmarkDefinition } from './types';

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getModelSlug(model: AIModelRecord): string {
  const shortId = model.id.split('/')[1] || model.id;
  return slugify(shortId);
}

export function findModelBySlug(slug: string): AIModelRecord | undefined {
  const norm = slugify(slug);
  return AI_MODELS_DATA.find((m) => {
    const idSlug = getModelSlug(m);
    const fullIdSlug = slugify(m.id);
    const nameSlug = slugify(m.name);
    if (idSlug === norm || fullIdSlug === norm || nameSlug === norm) return true;
    if (m.aliases?.some((a) => slugify(a) === norm)) return true;
    return false;
  });
}

export function parseComparisonSlug(slug: string): { modelA?: AIModelRecord; modelB?: AIModelRecord } | null {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  const modelA = findModelBySlug(parts[0]);
  const modelB = findModelBySlug(parts[1]);
  if (!modelA || !modelB) return null;
  return { modelA, modelB };
}

export interface BenchmarkComparisonItem {
  benchmarkId: string;
  name: string;
  category: string;
  unit: string;
  description: string;
  higherIsBetter: boolean;
  scoreA?: number;
  scoreB?: number;
  displayA?: string;
  displayB?: string;
  winner: 'A' | 'B' | 'tie' | 'none';
  marginPercent?: number;
}

export interface ComparisonAnalysis {
  modelA: AIModelRecord;
  modelB: AIModelRecord;
  slug: string;
  benchmarks: BenchmarkComparisonItem[];
  winsA: number;
  winsB: number;
  ties: number;
  cheaperInputModel: 'A' | 'B' | 'same' | 'unknown';
  largerContextModel: 'A' | 'B' | 'same';
  faqItems: Array<{ question: string; answer: string }>;
  relatedSlugs: Array<{ slug: string; label: string }>;
}

export function analyzeComparison(modelA: AIModelRecord, modelB: AIModelRecord): ComparisonAnalysis {
  const slug = `${getModelSlug(modelA)}-vs-${getModelSlug(modelB)}`;

  const benchmarks: BenchmarkComparisonItem[] = [];
  let winsA = 0;
  let winsB = 0;
  let ties = 0;

  const allBenchmarkKeys = Object.keys(BENCHMARK_DEFINITIONS);

  for (const key of allBenchmarkKeys) {
    const def = BENCHMARK_DEFINITIONS[key];
    const bmA = modelA.benchmarks[key];
    const bmB = modelB.benchmarks[key];

    if (!bmA && !bmB) continue;

    const higherIsBetter = def?.higherIsBetter ?? true;
    let winner: 'A' | 'B' | 'tie' | 'none' = 'none';
    let marginPercent: number | undefined;

    if (bmA && bmB) {
      if (Math.abs(bmA.score - bmB.score) < 0.05) {
        winner = 'tie';
        ties++;
      } else if (higherIsBetter ? bmA.score > bmB.score : bmA.score < bmB.score) {
        winner = 'A';
        winsA++;
        if (bmB.score > 0) {
          marginPercent = Math.round((Math.abs(bmA.score - bmB.score) / bmB.score) * 100);
        }
      } else {
        winner = 'B';
        winsB++;
        if (bmA.score > 0) {
          marginPercent = Math.round((Math.abs(bmB.score - bmA.score) / bmA.score) * 100);
        }
      }
    } else if (bmA && !bmB) {
      winner = 'none';
    } else if (!bmA && bmB) {
      winner = 'none';
    }

    benchmarks.push({
      benchmarkId: key,
      name: def?.name || bmA?.name || bmB?.name || key,
      category: def?.category || bmA?.category || bmB?.category || 'General',
      unit: def?.unit || bmA?.unit || bmB?.unit || '%',
      description: def?.description || '',
      higherIsBetter,
      scoreA: bmA?.score,
      scoreB: bmB?.score,
      displayA: bmA?.displayValue,
      displayB: bmB?.displayValue,
      winner,
      marginPercent,
    });
  }

  // Cost comparison
  let cheaperInputModel: 'A' | 'B' | 'same' | 'unknown' = 'unknown';
  const priceA = typeof modelA.pricing.inputPerMillion === 'number' ? modelA.pricing.inputPerMillion : null;
  const priceB = typeof modelB.pricing.inputPerMillion === 'number' ? modelB.pricing.inputPerMillion : null;
  if (priceA !== null && priceB !== null) {
    if (priceA < priceB) cheaperInputModel = 'A';
    else if (priceB < priceA) cheaperInputModel = 'B';
    else cheaperInputModel = 'same';
  } else if (modelA.specs.isOpenWeights && !modelB.specs.isOpenWeights) {
    cheaperInputModel = 'A';
  } else if (!modelA.specs.isOpenWeights && modelB.specs.isOpenWeights) {
    cheaperInputModel = 'B';
  }

  // Context window comparison
  let largerContextModel: 'A' | 'B' | 'same' = 'same';
  if (modelA.specs.contextWindowTokens > modelB.specs.contextWindowTokens) {
    largerContextModel = 'A';
  } else if (modelB.specs.contextWindowTokens > modelA.specs.contextWindowTokens) {
    largerContextModel = 'B';
  }

  // Generate dynamic FAQs for SEO rich results
  const topCategoryWinsA = benchmarks.filter((b) => b.winner === 'A').map((b) => b.name);
  const topCategoryWinsB = benchmarks.filter((b) => b.winner === 'B').map((b) => b.name);

  const faqItems: Array<{ question: string; answer: string }> = [
    {
      question: `Is ${modelA.name} better than ${modelB.name}?`,
      answer:
        winsA > winsB
          ? `${modelA.name} leads across ${winsA} evaluated benchmarks compared to ${winsB} for ${modelB.name}${topCategoryWinsA.length ? `, showing notable advantages in ${topCategoryWinsA.slice(0, 3).join(', ')}` : ''}.`
          : winsB > winsA
          ? `${modelB.name} outperforms ${modelA.name} across ${winsB} evaluated benchmarks compared to ${winsA} for ${modelA.name}${topCategoryWinsB.length ? `, excelling in ${topCategoryWinsB.slice(0, 3).join(', ')}` : ''}.`
          : `Both models perform neck-and-neck across available benchmarks, with ${modelA.name} and ${modelB.name} each excelling in distinct tasks.`,
    },
    {
      question: `How does the context window compare between ${modelA.name} and ${modelB.name}?`,
      answer:
        largerContextModel === 'A'
          ? `${modelA.name} offers a larger context capacity of ${modelA.specs.displayContext} (${modelA.specs.contextWindowTokens.toLocaleString()} tokens), compared to ${modelB.specs.displayContext} for ${modelB.name}.`
          : largerContextModel === 'B'
          ? `${modelB.name} has the larger context capacity of ${modelB.specs.displayContext} (${modelB.specs.contextWindowTokens.toLocaleString()} tokens), compared to ${modelA.specs.displayContext} for ${modelA.name}.`
          : `Both models feature equivalent context windows of ${modelA.specs.displayContext} (${modelA.specs.contextWindowTokens.toLocaleString()} tokens).`,
    },
    {
      question: `Which model is more cost-effective: ${modelA.name} or ${modelB.name}?`,
      answer:
        cheaperInputModel === 'A'
          ? `${modelA.name} is more cost-effective. Input tokens cost $${modelA.pricing.inputPerMillion}/M tokens vs $${modelB.pricing.inputPerMillion}/M tokens for ${modelB.name}.`
          : cheaperInputModel === 'B'
          ? `${modelB.name} is more economical. Input tokens cost $${modelB.pricing.inputPerMillion}/M tokens compared to $${modelA.pricing.inputPerMillion}/M tokens for ${modelA.name}.`
          : `Both models have comparable pricing structures or open weight deployment options.`,
    },
    {
      question: `Are ${modelA.name} or ${modelB.name} open weights?`,
      answer: `${modelA.name} is ${modelA.specs.isOpenWeights ? 'an open-weights model' : 'a proprietary cloud API'}. ${modelB.name} is ${modelB.specs.isOpenWeights ? 'an open-weights model' : 'a proprietary cloud API'}.`,
    },
  ];

  // Related models for cross-linking
  const relatedSlugs: Array<{ slug: string; label: string }> = [];
  const otherModels = AI_MODELS_DATA.filter(
    (m) => m.id !== modelA.id && m.id !== modelB.id && Object.keys(m.benchmarks).length >= 4
  ).slice(0, 6);

  for (const other of otherModels) {
    relatedSlugs.push({
      slug: `${getModelSlug(modelA)}-vs-${getModelSlug(other)}`,
      label: `${modelA.name} vs ${other.name}`,
    });
  }

  return {
    modelA,
    modelB,
    slug,
    benchmarks,
    winsA,
    winsB,
    ties,
    cheaperInputModel,
    largerContextModel,
    faqItems,
    relatedSlugs,
  };
}

export const TOP_COMPARISON_PAIRS: Array<[string, string]> = [
  ['claude-sonnet-5-5', 'gpt-6-1-sol'],
  ['claude-opus-5-5', 'gpt-6-1-sol'],
  ['deepseek-v4-1-flash', 'gemini-4-argon'],
  ['claude-sonnet-5-5', 'deepseek-v4-1-flash'],
  ['kimi-k3-1-pro', 'deepseek-v4-1-flash'],
  ['grok-4-7', 'gpt-6-1-sol'],
  ['claude-haiku-5-5', 'gemini-4-argon'],
  ['deepseek-v4-pro-0813', 'claude-opus-5'],
  ['gemini-3-8-flash', 'claude-sonnet-5'],
  ['mistral-large-4-0', 'claude-sonnet-5-5'],
  ['gpt-6-astra', 'claude-opus-5-5'],
  ['deepseek-v4-1-flash', 'gpt-6-1-sol'],
  ['gemini-4-argon', 'claude-opus-5-5'],
  ['step-5-preview', 'claude-sonnet-5-5'],
  ['kimi-k3-1-pro', 'claude-sonnet-5-5'],
  ['grok-4-7', 'claude-sonnet-5-5'],
  ['qwen3-8-flash', 'deepseek-v4-1-flash'],
  ['meta-muse-spark-open', 'deepseek-v4-1-flash'],
  ['anthropic-claude-opus-4-8', 'gpt-6-1-sol'],
  ['z-ai-glm-5-2', 'deepseek-v4-1-flash'],
];

export function getCuratedComparisonSlugs(): string[] {
  const slugs: string[] = [];
  for (const [a, b] of TOP_COMPARISON_PAIRS) {
    const modelA = findModelBySlug(a);
    const modelB = findModelBySlug(b);
    if (modelA && modelB) {
      slugs.push(`${getModelSlug(modelA)}-vs-${getModelSlug(modelB)}`);
    }
  }
  return slugs;
}
