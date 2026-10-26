export type Topic = 'Models' | 'Products' | 'Business' | 'Research' | 'Policy' | 'Dev Tools & Infra';

const POLICY_PATTERNS = [
  /\b(?:antitrust|ftc|fcc|sec|eu ai act|copyright|infringement|lawsuit|sued|suing|court|judge|injunction)\b/i,
  /\b(?:regulation|regulator|regulatory|compliance|legislation|legislature|bill|statute|treaty|banned?)\b/i,
  /\b(?:export controls?|tariffs?|sanctions?|chips act|executive order|white house|senate|congress)\b/i,
  /\b(?:ai safety institute|aisi|cetas|bureau of industry and security|commerce department)\b/i,
  /\b(?:national security|sovereign ai|surveillance|subpoena|monopoly|prohibitions?)\b/i,
  /\b(?:legal liability|defamation|privacy violation|data protection|gdpr)\b/i,
  /\b(?:ai safety|alignment research|aligned ai|misalignment|existential risk|x-risk|takeover risk|control problem)\b/i,
  /\b(?:red team(?:ing)?|responsible ai|model spec|constitutional ai safety|ai ethics)\b/i,
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

// Product Patterns: consumer-facing applications and features
const PRODUCT_PATTERNS = [
  /\b(?:app\b|desktop app|mobile app|ios app|android app|windows app|mac app)\b/i,
  /\b(?:canvas|workspace|copilot|assistant|chatgpt plus|chatgpt enterprise|claude pro|teams)\b/i,
  /\b(?:launches|ships|rolls? out|general availability|public preview)\s+(?:for|in|to)\b/i,
  /\b(?:pricing|subscription|tiers?|enterprise plan|pro tier|cost reduction)\b/i,
  /\b(?:agentic workflow|plugin|extension|marketplace)\b/i,
];

// Business Patterns: funding, M&A, leadership, partnerships, revenue
const BUSINESS_PATTERNS = [
  /\b(?:funding|raises?|raised|series [a-e]\b|seed round|valuation|valued at|ipo|spac)\b/i,
  /\b(?:acquires?|acquisition|merger|buyout|takes? (?:a )?stake|majority stake)\b/i,
  /\b(?:hires?|hiring|appointed|appoints?|named (?:ceo|cto|cfo|coo)|chief executive|leadership shake-?up|board of directors|executive team)\b/i,
  /\b(?:partnership|partners with|strategic alliance|joint venture|deal with|signs? (?:a )?(?:deal|partnership))\b/i,
  /\b(?:revenue|profit|earnings|quarterly results|layoffs?|downsizing|billion-dollar|million-dollar)\b/i,
  /\b(?:stock|shares|invests? in|investment)\b/i,
  /\b(?:unicorns?|startup raises|venture capital|vc round)\b/i,
];

// Dev Tools & Infra Patterns: SDKs, APIs, frameworks, IDEs, cloud/ML platforms, hardware
const DEVTOOLS_PATTERNS = [
  /\b(?:gpu|gpu cluster|supercomputer|datacenter|data center|h100|h200|b200|b300|blackwell|gb200|tpu v?\d|mi300|inference chip|accelerator)\b/i,
  /\b(?:cloud platform|bedrock|azure ai|vertex ai|sagemaker|developer console|inference endpoints?|model hosting|serverless inference)\b/i,
  /\b(?:sdk|api|apis|cli|framework|library|open-source library|ide (?:integration|plugin|extension)|vs ?code|cursor|jetbrains|github copilot|code interpreter|mcp|model context protocol|agent skills|openresponses|open responses)\b/i,
  /\b(?:api pricing|api cost|per-token|token pricing|inference cost|price per (?:million )?tokens?)\b/i,
  /\b(?:kubernetes|cuda|pytorch|tensorflow|jax|onnx|vllm|inference stack|mlops|vector database|fine-?tuning platform)\b/i,
];

// Strong product/business signals that override accidental model keyword matches
const PRODUCT_OVERRIDES = [
  /\b(?:app\b|desktop\b|ios\b|android\b|feature in\b|integration with\b|adds support for\b)/i,
  /\b(?:pricing\b|subscription\b|enterprise tier\b|lowers price\b)/i,
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
 * Classifies a story into one of the 6 core topics (Models, Products, Business,
 * Research, Policy, Dev Tools & Infra) based on strict linguistic patterns in
 * the title and content.
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
  const businessScore = scorePatterns(title, BUSINESS_PATTERNS) * 2 + scorePatterns(text, BUSINESS_PATTERNS);
  const devtoolsScore = scorePatterns(title, DEVTOOLS_PATTERNS) * 2 + scorePatterns(text, DEVTOOLS_PATTERNS);

  // If story is heavily about product apps or integrations, penalize modelScore
  const hasProductOverrides = scorePatterns(title, PRODUCT_OVERRIDES) > 0 || scorePatterns(text, PRODUCT_OVERRIDES) >= 2;
  if (hasProductOverrides) {
    productScore += 3;
    modelScore = Math.max(0, modelScore - 2);
  }

  // Determine highest scoring domain
  const maxScore = Math.max(policyScore, researchScore, modelScore, productScore, businessScore, devtoolsScore);

  if (maxScore >= 2) {
    if (policyScore === maxScore) return 'Policy';
    if (businessScore === maxScore) return 'Business';
    if (modelScore === maxScore) return 'Models';
    if (researchScore === maxScore) return 'Research';
    if (devtoolsScore === maxScore) return 'Dev Tools & Infra';
    if (productScore === maxScore) return 'Products';
  }

  // Fallback to designated topic or default to Products
  return input.fallbackTopic ?? 'Products';
}
