/**
 * Zero-cost statistical and architectural extraction for AI stories.
 * Extracts metrics, benchmarks, and context windows algorithmically without any paid APIs.
 */

export interface StoryStat {
  label: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
}

export interface StoryMetricBar {
  label: string;
  value: number; // 0 - 100
  displayValue: string;
  color: string;
  category?: string;
}

export interface StructuredStorySection {
  title: string;
  iconName?: string;
  content: string[];
}

export interface StoryAnalytics {
  stats: StoryStat[];
  bars: StoryMetricBar[];
  sections: StructuredStorySection[];
}

/**
 * Extracts key statistics (numbers, percentages, benchmarks, pricing, context)
 * from story text at zero cost.
 */
export function extractStoryAnalytics(input: {
  title: string;
  summary?: string | null;
  body?: string | null;
  deck?: string | null;
  brief?: string | null;
  keyPoints?: string[] | null;
  whyItMatters?: string | null;
  topic?: string;
}): StoryAnalytics {
  const fullText = [
    input.title,
    input.deck,
    input.summary,
    input.brief,
    input.body,
    input.whyItMatters,
    ...(input.keyPoints ?? []),
  ]
    .filter(Boolean)
    .join(' ');

  const stats: StoryStat[] = [];

  // 1. Context Window extraction (e.g., 1M tokens, 128k context, 200k)
  const contextMatch = fullText.match(/\b(\d+(?:\.\d+)?\s*[kKmMbB]?|\d+,\d+)\s*(?:-token|tokens?|token context|context window)\b/i);
  if (contextMatch) {
    stats.push({
      label: 'Context Window',
      value: contextMatch[0].trim(),
      subtext: 'Input / Output Capacity',
      highlight: true,
    });
  }

  // 2. Parameter count or Architecture (e.g., 70B, 405B, 8x7B, Mixture-of-Experts)
  const paramMatch = fullText.match(/\b(\d+[bB]|\d+x\d+[bB]|\d+\s*billion)\s*(?:parameters?|params?|weights?)?\b/i);
  const moeMatch = fullText.match(/\b(mixture-of-experts|moe|dense architecture|multimodal reasoning)\b/i);
  if (paramMatch) {
    stats.push({
      label: 'Model Size',
      value: paramMatch[1].toUpperCase(),
      subtext: moeMatch ? 'MoE Architecture' : 'Dense Parameters',
      highlight: true,
    });
  } else if (moeMatch) {
    stats.push({
      label: 'Architecture',
      value: 'Mixture of Experts',
      subtext: 'Specialized Routing',
    });
  }

  // 3. Percentages / Accuracy / Speed improvements (e.g. 98.4%, 5x faster, 40% reduction)
  const percentMatch = fullText.match(/\b(\d+(?:\.\d+)?%)\s*(?:accuracy|improvement|faster|gain|benchmark|reduction|efficiency|cost savings?)?\b/i);
  const multiplierMatch = fullText.match(/\b(\d+(?:\.\d+)?x)\s*(?:faster|cheaper|lower latency|speedup|throughput)\b/i);
  if (multiplierMatch) {
    stats.push({
      label: 'Efficiency Gain',
      value: multiplierMatch[0],
      subtext: 'Relative Performance',
      highlight: true,
    });
  } else if (percentMatch) {
    stats.push({
      label: 'Benchmark Metric',
      value: percentMatch[1],
      subtext: 'Reported Accuracy / Gain',
    });
  }

  // 4. Financial / Compute Investment (e.g. $500B, $100M, 100k GPUs, Colossus)
  const moneyMatch = fullText.match(/\$(\d+(?:\.\d+)?\s*(?:billion|million|trillion|[bBmM]))\b/i);
  const computeMatch = fullText.match(/\b(\d+(?:,\d+)?|\d+[kK])\s*(?:H100|B200|Blackwell|GPUs?|accelerators?)\b/i);
  if (moneyMatch) {
    stats.push({
      label: 'Capital / Scale',
      value: moneyMatch[0],
      subtext: 'Committed Investment',
    });
  } else if (computeMatch) {
    stats.push({
      label: 'Compute Cluster',
      value: computeMatch[0],
      subtext: 'Dedicated Hardware Scale',
    });
  }

  // 5. Video Capacity / Media Duration (e.g. 2 hours of video, 60 minutes)
  const videoMatch = fullText.match(/\b(?:up to\s*)?(\d+\s*(?:hours?|hrs?|minutes?|mins?))\s*(?:of video|video processing|video duration)?\b/i);
  if (videoMatch && /\b(video|clip|multimodal|pegasus)\b/i.test(fullText)) {
    stats.push({
      label: 'Video Capacity',
      value: videoMatch[0].trim(),
      subtext: 'Max Input Duration',
      highlight: true,
    });
  }

  // 6. Structured Output / Metadata Formats
  const schemaMatch = fullText.match(/\b(json schema|timestamped metadata|structured json|segment definitions?)\b/i);
  if (schemaMatch) {
    stats.push({
      label: 'Output Format',
      value: 'Structured JSON',
      subtext: 'Timestamped Metadata',
    });
  }

  // 7. Modality / Inputs
  const isMultimodal = /\b(multimodal prompting|reference images?|video language model|vision-language)\b/i.test(fullText);
  if (isMultimodal) {
    stats.push({
      label: 'Modality',
      value: 'Video + Vision + Text',
      subtext: 'Multimodal Grounding',
    });
  }

  // 8. Hosting Platform / Cloud Ecosystem
  const platformMatch = fullText.match(/\b(amazon bedrock|aws|azure ai|google cloud vertex|hugging face)\b/i);
  if (platformMatch) {
    stats.push({
      label: 'Deployment Platform',
      value: platformMatch[0],
      subtext: 'Cloud Infrastructure',
    });
  }

  // 9. Licensing / Deployment Mode
  const isOpen = /\b(open-weights?|open source|apache 2\.0|mit license|downloadable weights)\b/i.test(fullText);
  const isApi = /\b(api access|developer api|public preview|generally available|chatgpt plus)\b/i.test(fullText);
  if (isOpen) {
    stats.push({
      label: 'Ecosystem Access',
      value: 'Open Weights',
      subtext: 'Self-hostable & Fine-tunable',
    });
  } else if (isApi) {
    stats.push({
      label: 'Access Mode',
      value: 'API & Platform',
      subtext: 'Managed Enterprise Cloud',
    });
  }

  // Ensure we always have at least 2-3 stats by filling fallback attributes
  if (stats.length < 3) {
    stats.push({
      label: 'Category',
      value: input.topic ?? 'Frontier AI',
      subtext: 'Industry Domain',
    });
  }

  // Extract authentic empirical benchmarks directly from the source text (0% synthetic)
  const bars = extractStoryBenchmarks(fullText);

  // Build Structured Sections dynamically based on semantic content
  const paragraphs = (input.body || input.brief || input.summary || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sections: StructuredStorySection[] = [];
  const used = new Set<number>();

  // 1. The Core Development / Overview
  const coreParas: string[] = [];
  for (let i = 0; i < Math.min(3, paragraphs.length); i++) {
    coreParas.push(paragraphs[i]);
    used.add(i);
  }
  sections.push({
    title: 'The Core Development',
    iconName: 'sparkles',
    content: coreParas.length > 0 ? coreParas : [input.deck || input.summary || input.title],
  });

  // 2. What's New in this Version / Release
  const whatsNewParas: string[] = [];
  const WHATS_NEW_RE = /\b(what(?:’|')s new|changes compared to|earlier versions|differs most|introduces|new feature|enhances the core|retains and enhances|key enhancements?)\b/i;
  paragraphs.forEach((p, idx) => {
    if (!used.has(idx) && WHATS_NEW_RE.test(p)) {
      whatsNewParas.push(p);
      used.add(idx);
      if (idx + 1 < paragraphs.length && !used.has(idx + 1) && paragraphs[idx + 1].length > 80 && !paragraphs[idx + 1].startsWith('The following')) {
        whatsNewParas.push(paragraphs[idx + 1]);
        used.add(idx + 1);
      }
    }
  });
  if (whatsNewParas.length > 0) {
    sections.push({
      title: 'What’s New in This Version',
      iconName: 'sparkles',
      content: whatsNewParas.slice(0, 4),
    });
  }

  // 3. How It Works & Technical Architecture
  const techParas: string[] = [];
  const TECH_RE = /\b(video segmentation|multimodal prompting|analysis mode|reference image|timestamped|json schema|s3 location|amazon bedrock|invoke_model|architecture|reinforcement learning|transformer|weights|parameters?)\b/i;
  paragraphs.forEach((p, idx) => {
    if (!used.has(idx) && TECH_RE.test(p)) {
      techParas.push(p);
      used.add(idx);
    }
  });
  if (techParas.length > 0) {
    sections.push({
      title: 'How It Works & Technical Architecture',
      iconName: 'cpu',
      content: techParas.slice(0, 4),
    });
  }

  // 4. Practical Real-World Use Cases
  const useCaseParas: string[] = [];
  const USECASE_RE = /\b(use cases|designed for organizations|manage large volumes|media and entertainment|sports|surveillance|content moderation|workflow|human in the loop|developers can|real-world)\b/i;
  paragraphs.forEach((p, idx) => {
    if (!used.has(idx) && USECASE_RE.test(p)) {
      useCaseParas.push(p);
      used.add(idx);
    }
  });
  if (useCaseParas.length > 0) {
    sections.push({
      title: 'Real-World Use Cases & Applications',
      iconName: 'trending',
      content: useCaseParas.slice(0, 3),
    });
  }

  // 5. Deployment, Availability & Requirements
  const deployParas: string[] = [];
  const DEPLOY_RE = /\b(available today|aws region|pricing|support|input requirements|format|hours of video|availability|license)\b/i;
  paragraphs.forEach((p, idx) => {
    if (!used.has(idx) && DEPLOY_RE.test(p)) {
      deployParas.push(p);
      used.add(idx);
    }
  });
  if (deployParas.length > 0) {
    sections.push({
      title: 'Deployment & Availability',
      iconName: 'cpu',
      content: deployParas.slice(0, 3),
    });
  }

  // 6. Strategic Perspective & Context
  const remaining = paragraphs.filter((_, idx) => !used.has(idx) && !paragraphs[idx].startsWith('The following') && paragraphs[idx].length > 80);
  if (remaining.length > 0) {
    sections.push({
      title: 'Strategic Perspective & Ecosystem Impact',
      iconName: 'trending',
      content: remaining.slice(0, 3),
    });
  }

  return {
    stats: stats.slice(0, 4),
    bars,
    sections,
  };
}

/**
 * Extracts verified empirical benchmark scores directly from model evaluation
 * reports and announcements (e.g. MMLU, GSM8K, SWE-bench, HumanEval, GPQA, Video-MME).
 * Only returns bars when genuine benchmark scores exist in the source text.
 */
export function extractStoryBenchmarks(fullText: string): StoryMetricBar[] {
  const bars: StoryMetricBar[] = [];
  const seen = new Set<string>();

  const check = (
    name: string,
    pattern: RegExp,
    color: string,
    category: string,
    isElo = false,
  ) => {
    if (seen.has(name)) return;
    const match = fullText.match(pattern);
    if (!match) return;

    const numStr = match[1];
    const rawVal = parseFloat(numStr);
    if (isNaN(rawVal)) return;

    if (isElo) {
      if (rawVal >= 1000 && rawVal <= 1600) {
        seen.add(name);
        const normalized = Math.min(100, Math.max(10, Math.round(((rawVal - 1000) / 450) * 100)));
        bars.push({
          label: name,
          value: normalized,
          displayValue: `${rawVal.toLocaleString()} ELO`,
          color,
          category,
        });
      }
    } else {
      if (rawVal > 0 && rawVal <= 100) {
        seen.add(name);
        bars.push({
          label: name,
          value: Math.round(rawVal * 10) / 10,
          displayValue: `${Math.round(rawVal * 10) / 10}%`,
          color,
          category,
        });
      }
    }
  };

  // 1. SWE-bench (Autonomous Software Engineering / Coding)
  check('SWE-bench Verified', /\b(?:swe-bench(?:\s+verified)?)\b[^\d\n\r%]{0,25}?(\d{1,2}(?:\.\d+)?)\s*%/i, 'var(--violet)', 'Agentic Coding');
  check('SWE-bench Verified', /\b(\d{1,2}(?:\.\d+)?)\s*%\s*(?:on|in|across)\s+(?:the\s+)?swe-bench/i, 'var(--violet)', 'Agentic Coding');

  // 2. MMLU / MMLU-Pro (Multi-task Language Understanding)
  check('MMLU-Pro', /\bmmlu-pro\b[^\d\n\r%]{0,25}?(\d{1,2}(?:\.\d+)?)\s*%/i, 'var(--blue)', 'General Reasoning');
  check('MMLU', /\bmmlu\b[^\d\n\r%]{0,25}?(\d{1,2}(?:\.\d+)?)\s*%/i, 'var(--blue)', 'General Reasoning');
  check('MMLU', /\b(\d{1,2}(?:\.\d+)?)\s*%\s*(?:on|in|across)\s+(?:the\s+)?mmlu\b/i, 'var(--blue)', 'General Reasoning');

  // 3. GSM8K (Grade School Math Reasoning)
  check('GSM8K', /\b(?:gsm8k|gsm-8k)\b[^\d\n\r%]{0,25}?(\d{1,2}(?:\.\d+)?)\s*%/i, 'var(--cyan)', 'Math Reasoning');
  check('GSM8K', /\b(\d{1,2}(?:\.\d+)?)\s*%\s*(?:on|in)\s+(?:the\s+)?gsm8k\b/i, 'var(--cyan)', 'Math Reasoning');

  // 4. MATH (Competition-Level Math)
  check('MATH', /\bmath\s+(?:benchmark|score|dataset)\b[^\d\n\r%]{0,20}?(\d{1,2}(?:\.\d+)?)\s*%/i, 'var(--cyan)', 'Competition Math');

  // 5. HumanEval / EvalPlus (Python Code Synthesis)
  check('HumanEval', /\b(?:humaneval|evalplus)\b[^\d\n\r%]{0,25}?(\d{1,2}(?:\.\d+)?)\s*%/i, 'var(--violet)', 'Code Generation');
  check('HumanEval', /\b(\d{1,2}(?:\.\d+)?)\s*%\s*(?:on|in)\s+(?:the\s+)?humaneval\b/i, 'var(--violet)', 'Code Generation');

  // 6. GPQA (Google-Proof Graduate Q&A)
  check('GPQA Diamond', /\bgpqa(?:\s+diamond)?\b[^\d\n\r%]{0,25}?(\d{1,2}(?:\.\d+)?)\s*%/i, 'var(--amber)', 'Expert Reasoning');

  // 7. Video-MME (Long Video Multimodal Understanding)
  check('Video-MME', /\b(?:video-mme|videomme)\b[^\d\n\r%]{0,25}?(\d{1,2}(?:\.\d+)?)\s*%/i, 'var(--cyan)', 'Video Reasoning');

  // 8. MMMU (College-level Multimodal Understanding)
  check('MMMU', /\bmmmu\b[^\d\n\r%]{0,25}?(\d{1,2}(?:\.\d+)?)\s*%/i, 'var(--blue)', 'Multimodal Exam');

  // 9. ARC-Challenge (Abstraction & Reasoning)
  check('ARC-Challenge', /\barc(?:-challenge|-agi)\b[^\d\n\r%]{0,25}?(\d{1,2}(?:\.\d+)?)\s*%/i, 'var(--amber)', 'Abstract Logic');

  // 10. Chatbot Arena / LMSYS ELO
  check('Chatbot Arena ELO', /\b(?:chatbot\s+arena|lmsys)\b[^\d\n\r]{0,25}?(\d{4})\b/i, 'var(--amber)', 'Human Preference', true);
  check('Chatbot Arena ELO', /\belo\s*(?:of|:)?\s*(\d{4})\b/i, 'var(--amber)', 'Human Preference', true);

  return bars.slice(0, 5);
}


