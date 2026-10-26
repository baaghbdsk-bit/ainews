/**
 * Category Classification Regression Test Suite
 *
 * Verifies that AI news stories are accurately categorized into:
 *   - Models: Only genuine foundation model checkpoints, weights, and architecture releases.
 *   - Products: Consumer-facing applications, desktop/mobile apps, workspace features, pricing.
 *   - Business: Funding, M&A, executive hires, partnerships, revenue, layoffs.
 *   - Research: Scientific papers, mechanistic interpretability, training algorithms, loss functions.
 *   - Policy: Legal lawsuits, FTC/antitrust, EU AI Act, export controls, copyright claims, AI safety.
 *   - Dev Tools & Infra: SDKs, APIs, frameworks, IDEs, cloud/ML platforms, hardware, GPU clusters.
 *
 * Run with:
 *   node --experimental-strip-types tests/category-classification.mjs
 */

import { classifyStoryTopic } from '../src/lib/feeds/classify-topic.ts';

const testCases = [
  // ==========================================
  // 1. INCIDENTAL MENTIONS (MUST NOT BE 'Models')
  //    → Products, Business, or Dev Tools & Infra
  // ==========================================
  {
    title: 'OpenAI launches ChatGPT desktop app for Windows',
    summary: 'The application is now available for all Windows 10 and 11 users with hotkey support.',
    expected: 'Products',
    reason: 'Desktop application launch, not a new foundation model',
  },
  {
    title: 'Apple and OpenAI partner to integrate ChatGPT into iOS 18',
    summary: 'Siri will be able to tap into ChatGPT for complex queries with user permission.',
    expected: 'Products',
    reason: 'Corporate partnership and OS integration',
  },
  {
    title: 'Google brings Gemini into Google Docs, Gmail, and Slides',
    summary: 'Workspace users can now use generative assistance directly in their documents.',
    expected: 'Products',
    reason: 'Product workspace integration',
  },
  {
    title: 'OpenAI acquires Rockset to power search and retrieval infrastructure',
    summary: 'The database acquisition will strengthen enterprise retrieval capabilities.',
    expected: 'Business',
    reason: 'Corporate acquisition',
  },
  {
    title: 'OpenAI lowers GPT-4o API pricing by 50% for all developers',
    summary: 'New token costs reduce developer input and output pricing significantly.',
    expected: 'Dev Tools & Infra',
    reason: 'API/token pricing for developers',
  },
  {
    title: 'Anthropic hires former Instagram co-founder Mike Krieger as Chief Product Officer',
    summary: 'Krieger will oversee product engineering and enterprise applications for Claude.',
    expected: 'Business',
    reason: 'Executive hiring announcement',
  },
  {
    title: 'GitHub Copilot Workspace enters public preview for all developers',
    summary: 'The agentic environment assists developers from specification to code pull request.',
    expected: 'Products',
    reason: 'Developer tool and IDE extension feature',
  },
  {
    title: 'TwelveLabs Pegasus 1.5 is now available in Amazon Bedrock',
    summary: 'AWS customers can now deploy the multimodal video understanding model through Bedrock API console.',
    expected: 'Dev Tools & Infra',
    reason: 'Cloud platform deployment/integration (Bedrock, API)',
  },
  {
    title: 'Cursor AI raises $60 million to expand AI code editor',
    summary: 'The funding round values the developer tooling startup at over $400 million.',
    expected: 'Business',
    reason: 'Venture funding round',
  },
  {
    title: 'Nvidia unveils Blackwell B200 GPU supercomputer cluster for datacenters',
    summary: 'New hardware architecture delivers 20 petaflops of compute for enterprise clusters.',
    expected: 'Dev Tools & Infra',
    reason: 'Hardware datacenter platform',
  },

  // ==========================================
  // 2. GENUINE FOUNDATION MODEL RELEASES (MUST BE 'Models')
  // ==========================================
  {
    title: 'Anthropic releases Claude 3.7 Sonnet with hybrid reasoning capabilities',
    summary: 'The new frontier model combines instant response generation with extended thinking mode.',
    expected: 'Models',
    reason: 'Frontier foundation model release',
  },
  {
    title: 'Meta releases Llama 3.3 70B with open weights',
    summary: 'The 70B parameter open-weight model matches capabilities of previous 405B flagships.',
    expected: 'Models',
    reason: 'Open-weight parameter checkpoint release',
  },
  {
    title: 'DeepSeek-R1 reasoning model weights released on Hugging Face',
    summary: 'Open-weights reasoning model trained via large-scale reinforcement learning without supervised warm-up.',
    expected: 'Models',
    reason: 'Reasoning model weights on Hugging Face',
  },
  {
    title: 'Google releases Gemini 2.0 Flash foundation model',
    summary: 'The new multimodal foundation model introduces sub-second latency and native multimodal streaming.',
    expected: 'Models',
    reason: 'Multimodal foundation model release',
  },
  {
    title: 'Mistral announces Mistral Large 2 with 123B parameters',
    summary: 'The new frontier model features a 128k context window and enhanced code generation.',
    expected: 'Models',
    reason: 'New frontier parameter model release',
  },
  {
    title: 'Qwen 2.5 72B dense and MoE model checkpoints released',
    summary: 'Alibaba releases new open-weights checkpoints across dense and mixture-of-experts architectures.',
    expected: 'Models',
    reason: 'MoE architecture and open-weights checkpoint release',
  },
  {
    title: 'Introducing GPT-6.1 Terra',
    summary: 'OpenAI introduces GPT-6.1 Terra, a new model in the GPT-6 family.',
    fallbackTopic: 'Products',
    expected: 'Models',
    reason: 'Versioned model name in a direct release announcement',
  },
  {
    title: 'OpenAI launches GPT-6.1 Terra at half the price of GPT-6.1 Sol',
    summary: 'The new model delivers frontier capability at a lower token cost.',
    fallbackTopic: 'Products',
    expected: 'Models',
    reason: 'Model launch should outrank a pricing mention',
  },
  {
    title: 'Introducing Agent Skills',
    summary: 'A developer tool for reusable capabilities in AI agent workflows.',
    fallbackTopic: 'Models',
    expected: 'Dev Tools & Infra',
    reason: 'Agent tooling should not remain in the legacy Models bucket',
  },
  {
    title: 'Petri: An open-source auditing tool to accelerate AI safety research',
    summary: 'An open-source auditing tool for evaluating language-model behavior.',
    fallbackTopic: 'Models',
    expected: 'Dev Tools & Infra',
    reason: 'A safety auditing tool is infrastructure, not a model release',
  },

  // ==========================================
  // 3. POLICY, LEGAL & REGULATORY (MUST BE 'Policy')
  // ==========================================
  {
    title: 'FTC opens antitrust inquiry into Big Tech AI partnerships',
    summary: 'Regulators issue subpoenas regarding cloud investments and exclusivity contracts.',
    expected: 'Policy',
    reason: 'Antitrust regulation and FTC investigation',
  },
  {
    title: 'Book authors file class-action copyright infringement lawsuit against AI developers',
    summary: 'The lawsuit alleges unauthorized scraping of copyrighted manuscripts for training datasets.',
    expected: 'Policy',
    reason: 'Copyright infringement lawsuit',
  },
  {
    title: 'European Union approves final text of the EU AI Act compliance rules',
    summary: 'The comprehensive legislation establishes risk categories and strict governance requirements.',
    expected: 'Policy',
    reason: 'EU AI Act regulation and compliance statute',
  },
  {
    title: 'US Commerce Department imposes new export controls on advanced AI semiconductor equipment',
    summary: 'The Bureau of Industry and Security updates trade restrictions on sovereign chip exports.',
    expected: 'Policy',
    reason: 'Export controls and sanctions',
  },

  // ==========================================
  // 4. SCIENTIFIC RESEARCH & PAPERS (MUST BE 'Research')
  // ==========================================
  {
    title: 'Researchers publish paper on mechanistic interpretability in transformer latent space',
    summary: 'The empirical study uses sparse autoencoders to isolate monosemantic features in neural activations.',
    expected: 'Research',
    reason: 'Scientific research paper on mechanistic interpretability',
  },
  {
    title: 'Google DeepMind introduces new loss function for molecular protein folding',
    summary: 'The arXiv preprint details a novel gradient descent formulation for structural biology prediction.',
    expected: 'Research',
    reason: 'ArXiv preprint and loss function algorithmic research',
  },
  {
    title: 'New ablation study analyzes scaling laws in direct preference optimization (DPO)',
    summary: 'The empirical benchmark evaluation examines RLHF versus DPO performance degradation at scale.',
    expected: 'Research',
    reason: 'Ablation study, scaling laws, and DPO evaluation',
  },
  {
    title: 'Investigating models for misalignment',
    summary: 'Insights from alignment evaluations of frontier models.',
    fallbackTopic: 'Products',
    expected: 'Research',
    reason: 'Alignment evaluation is research rather than a policy announcement',
  },
  {
    title: 'How can safety cases be used to help with frontier AI safety?',
    summary: 'New papers show how safety cases can help AI developers turn safety frameworks into action.',
    fallbackTopic: 'Products',
    expected: 'Research',
    reason: 'Safety-case papers are research evidence',
  },
  {
    title: 'Managing risks from increasingly capable open-weight AI systems',
    summary: 'Current methods and open problems in open-weight model risk management.',
    fallbackTopic: 'Products',
    expected: 'Research',
    reason: 'Risk-management methods should not be classified as a model release',
  },
  {
    title: 'Evaluating RAG with LLM as a Judge',
    summary: 'An evaluation study of retrieval-augmented generation systems.',
    fallbackTopic: 'Products',
    expected: 'Research',
    reason: 'LLM-as-a-judge evaluation is research',
  },

  // ==========================================
  // 5. AMBIGUOUS / FALLBACK HANDLING
  // ==========================================
  {
    title: 'Weekly Community Newsletter #42',
    summary: 'A general roundup of community discussions and event announcements this week.',
    fallbackTopic: 'Products',
    expected: 'Products',
    reason: 'Ambiguous general text safely defaults to fallback topic',
  },
  {
    title: 'Anthropic appoints Hidetoshi Tojo as Head of Japan and announces hiring plans',
    summary: 'Anthropic appoints a regional leader and announces hiring plans.',
    fallbackTopic: 'Models',
    expected: 'Business',
    reason: 'Executive appointment and hiring are business activity',
  },
  {
    title: 'Anthropic partners with Google Cloud',
    summary: 'Anthropic announces a strategic cloud partnership.',
    fallbackTopic: 'Models',
    expected: 'Business',
    reason: 'Partnership news belongs to Business',
  },
  {
    title: 'The all new le Chat: Your AI assistant for life and work',
    summary: 'Mistral introduces a consumer-facing AI assistant product.',
    fallbackTopic: 'Models',
    expected: 'Products',
    reason: 'An assistant application is a product, not a foundation-model release',
  },
];

console.log('='.repeat(70));
console.log('RUNNING AI NEWS CATEGORY CLASSIFICATION REGRESSION TESTS');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

for (const [idx, tc] of testCases.entries()) {
  const result = classifyStoryTopic({
    title: tc.title,
    summary: tc.summary,
    fallbackTopic: tc.fallbackTopic,
  });

  const isOk = result === tc.expected;
  const status = isOk ? 'PASS' : 'FAIL';
  const prefix = `[${status}] #${String(idx + 1).padStart(2, '0')}`;

  if (isOk) {
    passed++;
    console.log(`${prefix} [${tc.expected}] "${tc.title.slice(0, 52)}..."`);
  } else {
    failed++;
    console.error(
      `${prefix} EXPECTED: [${tc.expected}] BUT GOT: [${result}]\n` +
      `     Title: "${tc.title}"\n` +
      `     Reason: ${tc.reason}`
    );
  }
}

console.log('='.repeat(70));
console.log(`TOTAL: ${testCases.length} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('='.repeat(70));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL CATEGORY CLASSIFICATION TESTS PASSED CLEANLY!');
  process.exit(0);
}

