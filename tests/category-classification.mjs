/**
 * Category Classification Regression Test Suite
 *
 * Verifies that AI news stories are accurately categorized into:
 *   - Models: Only genuine foundation model checkpoints, weights, and architecture releases.
 *   - Products: Applications, desktop/mobile apps, IDE tools, cloud integrations, corporate partnerships, pricing, executive hires.
 *   - Research: Scientific papers, mechanistic interpretability, training algorithms, loss functions.
 *   - Policy: Legal lawsuits, FTC/antitrust, EU AI Act, export controls, copyright claims.
 *
 * Run with:
 *   node --experimental-strip-types tests/category-classification.mjs
 */

import { classifyStoryTopic } from '../src/lib/feeds/classify-topic.ts';

const testCases = [
  // ==========================================
  // 1. INCIDENTAL MENTIONS (MUST NOT BE 'Models' -> MUST BE 'Products')
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
    expected: 'Products',
    reason: 'Corporate acquisition',
  },
  {
    title: 'OpenAI lowers GPT-4o API pricing by 50% for all developers',
    summary: 'New token costs reduce developer input and output pricing significantly.',
    expected: 'Products',
    reason: 'Pricing reduction and API commercial tiers',
  },
  {
    title: 'Anthropic hires former Instagram co-founder Mike Krieger as Chief Product Officer',
    summary: 'Krieger will oversee product engineering and enterprise applications for Claude.',
    expected: 'Products',
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
    expected: 'Products',
    reason: 'Cloud platform deployment/integration override',
  },
  {
    title: 'Cursor AI raises $60 million to expand AI code editor',
    summary: 'The funding round values the developer tooling startup at over $400 million.',
    expected: 'Products',
    reason: 'Venture funding round',
  },
  {
    title: 'Nvidia unveils Blackwell B200 GPU supercomputer cluster for datacenters',
    summary: 'New hardware architecture delivers 20 petaflops of compute for enterprise clusters.',
    expected: 'Products',
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

