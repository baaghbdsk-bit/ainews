export type Topic = 'Models' | 'Products' | 'Research' | 'Policy';

const POLICY_PATTERNS = [
  /\b(?:antitrust|ftc|fcc|sec|eu ai act|copyright|infringement|lawsuit|sued|suing|court|judge|injunction)\b/i,
  /\b(?:regulation|regulator|regulatory|compliance|legislation|legislature|bill|statute|treaty|banned?)\b/i,
  /\b(?:export controls?|tariffs?|sanctions?|chips act|executive order|white house|senate|congress)\b/i,
  /\b(?:ai safety institute|aisi|cetas|bureau of industry and security|commerce department)\b/i,
  /\b(?:national security|sovereign ai|surveillance|subpoena|monopoly|prohibitions?)\b/i,
  /\b(?:legal liability|defamation|privacy violation|data protection|gdpr)\b/i,
];

const RESEARCH_PATTERNS = [
  /\b(?:arxiv|published paper|scientific paper|peer-reviewed|ablation study|empirical study)\b/i,
  /\b(?:mechanistic interpretability|representation engineering|latent space|loss function|gradient descent)\b/i,
  /\b(?:reinforcement learning|rlhf|rlaif|direct preference optimization|dpo|grpo|self-play)\b/i,
  /\b(?:benchmark dataset|evaluation framework|scaling laws|synthetic data generation)\b/i,
  /\b(?:mathematical proof|theorem|neurosymbolic|computational biology|alphafold|protein structure)\b/i,
];

// Strict Model Patterns: specifically about model weights, architecture, checkpoints, or new foundation models
const MODEL_PATTERNS = [
  /\b(?:unveils?|releases?|launches?|introduces?|announces?)\s+(?:the\s+)?(?:new\s+)?(?:[a-z0-9\.\-]+\s+)?(?:foundation\s+|frontier\s+|multimodal\s+|reasoning\s+|language\s+|diffusion\s+|open-weight\s+)?model\b/i,
  /\b(?:open-weights?|open-source model|foundation model|frontier model|reasoning model)\b/i,
  /\b(?:multimodal foundation model|vision-language model|audio language model|video generation model)\b/i,
  /\b(?:\d+b|\d+m)\s+(?:dense|moe|parameters?|weights?|model)\b/i,
  /\b(?:mixture-of-experts architecture|moe architecture|model weights|checkpoint released)\b/i,
  /\b(?:weights available on hugging face|downloadable weights|hugging face checkpoint)\b/i,
  /\b(?:gpt-4o|gpt-5|o1(?:-mini|-preview)?|o3(?:-mini)?|claude\s+3(?:\.5|\.7)?\s+(?:sonnet|opus|haiku)|claude\s+4|gemini\s+(?:1\.5|2\.0|2\.5|3\.0)|llama\s+[34](?:\.[0-9]+)?|deepseek\s+(?:v3|r1)|qwen\s+2(?:\.5)?|mistral\s+(?:large|small|nemo|codestral)|grok\s+[23])\b/i,
  /\b(?:pre-training|post-training|context window expansion to|native multimodal training)\b/i,
];

// Product Patterns: applications, desktop apps, IDE extensions, cloud platforms, hardware, corporate deals, pricing
const PRODUCT_PATTERNS = [
  /\b(?:app\b|desktop app|mobile app|ios app|android app|windows app|mac app)\b/i,
  /\b(?:canvas|workspace|copilot|assistant|chatgpt plus|chatgpt enterprise|claude pro|teams)\b/i,
  /\b(?:launches|ships|rolls? out|general availability|public preview)\s+(?:for|in|to)\b/i,
  /\b(?:pricing|subscription|tiers?|enterprise plan|pro tier|api pricing|cost reduction)\b/i,
  /\b(?:agentic workflow|plugin|extension|ide integration|cursor|vs code|marketplace)\b/i,
  /\b(?:hardware|gpu cluster|supercomputer|datacenter|h100|h200|b200|blackwell|tpu v5|tpu v6)\b/i,
  /\b(?:cloud platform|bedrock integration|azure ai studio|vertex ai platform|developer console|sdk)\b/i,
  /\b(?:partnership|deal|acquires?|acquisition|funding|raises? \$|valuation|invests?|ipo)\b/i,
  /\b(?:hiring|hires|appoints|ceo|cfo|cto|leadership|board member|executive)\b/i,
];

// Strong product/business signals that override accidental model keyword matches
const PRODUCT_OVERRIDES = [
  /\b(?:app\b|desktop\b|ios\b|android\b|feature in\b|integration with\b|adds support for\b)/i,
  /\b(?:pricing\b|subscription\b|enterprise tier\b|lowers price\b|api cost\b)/i,
  /\b(?:partnership\b|acquires?\b|acquisition\b|hires?\b|cfo\b|ceo\b|board of directors\b)/i,
  /\b(?:deal with\b|invests? in\b|funding round\b|\$[0-9]+(?:\.[0-9]+)?\s*(?:million|billion)\b)/i,
  /\b(?:preview in|available in amazon bedrock|available on azure|now on google cloud)\b/i,
];

function scorePatterns(text: string, patterns: RegExp[]): number {
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) score += 1;
  }
  return score;
}

/**
 * Classifies a story into one of the 4 core topics (Models, Products, Research, Policy)
 * based on strict linguistic patterns in the title and content.
 * 
 * Free, deterministic, and instant — prevents commercial apps, corporate news,
 * and platform integrations from leaking into the Models category.
 */
export function classifyStoryTopic(input: {
  title: string;
  summary?: string | null;
  fallbackTopic?: Topic;
}): Topic {
  const title = input.title.toLowerCase();
  const text = `${input.title} ${input.summary ?? ''}`.toLowerCase();

  // Title matches carry double weight
  const policyScore = scorePatterns(title, POLICY_PATTERNS) * 2 + scorePatterns(text, POLICY_PATTERNS);
  const researchScore = scorePatterns(title, RESEARCH_PATTERNS) * 2 + scorePatterns(text, RESEARCH_PATTERNS);
  let modelScore = scorePatterns(title, MODEL_PATTERNS) * 2 + scorePatterns(text, MODEL_PATTERNS);
  let productScore = scorePatterns(title, PRODUCT_PATTERNS) * 2 + scorePatterns(text, PRODUCT_PATTERNS);

  // If story is heavily about product apps, integrations, or corporate deals, penalize modelScore
  const hasProductOverrides = scorePatterns(title, PRODUCT_OVERRIDES) > 0 || scorePatterns(text, PRODUCT_OVERRIDES) >= 2;
  if (hasProductOverrides) {
    productScore += 3;
    modelScore = Math.max(0, modelScore - 2);
  }

  // Determine highest scoring domain
  const maxScore = Math.max(policyScore, researchScore, modelScore, productScore);

  if (maxScore >= 2) {
    if (policyScore === maxScore) return 'Policy';
    if (productScore === maxScore) return 'Products';
    if (modelScore === maxScore) return 'Models';
    if (researchScore === maxScore) return 'Research';
  }

  // Fallback to designated topic or default to Products
  return input.fallbackTopic ?? 'Products';
}

