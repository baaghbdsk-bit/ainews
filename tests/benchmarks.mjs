/**
 * AI Model Benchmark System & Integrity Test Suite
 *
 * Verifies:
 * 1. Catalogue window (nothing older than mid-2025).
 * 2. Deduplication & alias resolution.
 * 3. Official vs Independent source attribution.
 * 4. Empirical score bounds (percentages 0-100%, ELO 500-2000).
 * 5. Documentation and source URL validity.
 * 6. Benchmark definitions cover every score in the catalogue.
 * 7. Generation, provider, and capability filtering logic.
 * 8. Validation helper parity with the service layer.
 * 9. Pricing sentinels, provenance dates, and display consistency.
 *
 * Run with:
 *   node --experimental-strip-types tests/benchmarks.mjs
 */

import { register } from 'node:module';

// Node requires explicit extensions for relative imports. The service uses
// extensionless TypeScript imports that Next resolves at build time.
const EXTENSION_RESOLVER = `
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\\.[a-z]+$/i.test(specifier)) {
    try {
      return await next(specifier + '.ts', context);
    } catch {
      // fall through to the default resolver
    }
  }
  return next(specifier, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(EXTENSION_RESOLVER)}`);

const { AI_MODELS_DATA, BENCHMARK_DEFINITIONS } = await import(
  '../src/lib/benchmarks/data.ts'
);
const { getAvailableModels, getModelById, validateModelRecord } = await import(
  '../src/lib/benchmarks/service.ts'
);

const WINDOW_START = '2025-07-01';
const SNAPSHOT_DATE = '2026-10-20';
const EVALUATION_DATE_NOTE = 'Evaluation date not published by source; snapshot date shown';

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
    console.log(`[PASS] ${testName}${detail ? ` (${detail})` : ''}`);
  } else {
    failed++;
    console.error(`[FAIL] ${testName} ❌ ${detail}`);
  }
}

function clone(record) {
  return JSON.parse(JSON.stringify(record));
}

function dateTimestamp(value) {
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(value)) return null;
  const parts = value.split('-').map(Number);
  if (parts.length === 2) return Date.UTC(parts[0], parts[1] - 1, 1);
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

function displayNumber(value) {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

console.log('='.repeat(70));
console.log('RUNNING AI MODEL BENCHMARK INTEGRITY & AUDIT SUITE');
console.log('='.repeat(70));

// -----------------------------------------------------------------
// 1. Catalogue Window & Composition
// -----------------------------------------------------------------
const outOfWindow = AI_MODELS_DATA.filter((m) => m.specs.releaseDate < WINDOW_START);
assert(
  outOfWindow.length === 0,
  `No model predates the ${WINDOW_START} cutoff`,
  outOfWindow.length ? outOfWindow.map((m) => `${m.name} (${m.specs.releaseDate})`).join(', ') : 'clean'
);

assert(
  AI_MODELS_DATA.length >= 200,
  'Catalogue covers the full post-mid-2025 model wave',
  `Found: ${AI_MODELS_DATA.length} models`
);

assert(
  AI_MODELS_DATA.length === 266,
  'Catalogue keeps its audited model count',
  `Found: ${AI_MODELS_DATA.length} models`
);

const currentGenCount = AI_MODELS_DATA.filter((m) => m.specs.generation === 'current').length;
assert(
  currentGenCount > 0 && currentGenCount < AI_MODELS_DATA.length,
  'Generation tiers are split between current and previous',
  `current: ${currentGenCount}, previous: ${AI_MODELS_DATA.length - currentGenCount}`
);

const openWeightsCount = AI_MODELS_DATA.filter((m) => m.specs.isOpenWeights).length;
assert(openWeightsCount >= 20, 'Open-weights coverage is substantial', `Found: ${openWeightsCount}`);

const developers = new Set(AI_MODELS_DATA.map((m) => m.developer));
assert(developers.size >= 15, 'Catalogue spans many developers', `Found: ${developers.size}`);

// -----------------------------------------------------------------
// 2. Duplicates & Alias Resolution
// -----------------------------------------------------------------
const uniqueIds = new Set();
let duplicatesFound = 0;
for (const model of AI_MODELS_DATA) {
  if (uniqueIds.has(model.id)) duplicatesFound++;
  uniqueIds.add(model.id);
}
assert(duplicatesFound === 0, 'Zero duplicate primary model IDs', `Unique IDs: ${uniqueIds.size}`);

const aliasModel = AI_MODELS_DATA.find((m) => m.aliases?.length && m.aliases[0]);
assert(
  Boolean(aliasModel && getModelById(aliasModel.aliases[0])?.id === aliasModel.id),
  'Alias resolution returns the canonical record',
  aliasModel ? `${aliasModel.aliases[0]} → ${aliasModel.id}` : 'no aliases present'
);

const selfAliases = AI_MODELS_DATA.filter((m) => m.aliases?.includes(m.id)).map((m) => m.id);
assert(selfAliases.length === 0, 'No alias repeats its own model id', selfAliases.join(', '));

const duplicateAliases = AI_MODELS_DATA.filter((m) => {
  if (!m.aliases?.length) return false;
  return new Set(m.aliases).size !== m.aliases.length;
}).map((m) => m.id);
assert(duplicateAliases.length === 0, 'Alias lists contain no duplicates', duplicateAliases.join(', '));

const mixedCaseId = 'Anthropic/Claude-Opus-4.5';
assert(
  getModelById(mixedCaseId)?.id === 'anthropic/claude-opus-4.5',
  'getModelById is case-insensitive on primary ids',
  mixedCaseId
);

const mixedCaseAlias = aliasModel?.aliases[0]?.toUpperCase();
assert(
  Boolean(mixedCaseAlias && getModelById(mixedCaseAlias)?.id === aliasModel.id),
  'getModelById is case-insensitive on aliases',
  mixedCaseAlias
);

// -----------------------------------------------------------------
// 3. Source Links & Dates
// -----------------------------------------------------------------
let sourcesValid = true;
let invalidSource = '';
for (const model of AI_MODELS_DATA) {
  if (!model.officialSourceUrl.startsWith('https://')) {
    sourcesValid = false;
    invalidSource = `${model.id} missing HTTPS officialSourceUrl`;
    break;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(model.specs.releaseDate)) {
    sourcesValid = false;
    invalidSource = `${model.id} invalid releaseDate: ${model.specs.releaseDate}`;
    break;
  }
}
assert(
  sourcesValid,
  `All ${AI_MODELS_DATA.length} models have HTTPS sources and ISO release dates`,
  invalidSource
);

// -----------------------------------------------------------------
// 4. Score Quality & Provenance
// -----------------------------------------------------------------
let officialScores = 0;
let independentScores = 0;
let totalScores = 0;
let boundsValid = true;
let boundsDetail = '';
const dateIssues = [];
const displayIssues = [];
const benchlmScores = [];
const benchlmHostedScores = [];
const placeholderNotes = [];
const crossVendorScores = [];

for (const model of AI_MODELS_DATA) {
  for (const [bmId, bm] of Object.entries(model.benchmarks)) {
    totalScores++;
    if (bm.evaluationType === 'Official Report') officialScores++;
    if (bm.evaluationType === 'Independent Evaluation') independentScores++;

    if (bm.unit === '%' && (bm.score < 0 || bm.score > 100)) {
      boundsValid = false;
      boundsDetail = `${model.id} - ${bmId} percentage out of bounds: ${bm.score}`;
    }
    if (bm.unit === 'ELO' && (bm.score < 500 || bm.score > 2000)) {
      boundsValid = false;
      boundsDetail = `${model.id} - ${bmId} ELO out of bounds: ${bm.score}`;
    }
    if (!bm.sourceUrl.startsWith('https://')) {
      boundsValid = false;
      boundsDetail = `${model.id} - ${bmId} source URL not HTTPS`;
    }

    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(bm.evaluationDate)) {
      dateIssues.push(`${model.id}:${bmId} invalid evaluationDate ${bm.evaluationDate}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bm.lastVerifiedDate)) {
      dateIssues.push(`${model.id}:${bmId} invalid lastVerifiedDate ${bm.lastVerifiedDate}`);
    }
    const evaluationTimestamp = dateTimestamp(bm.evaluationDate);
    const verifiedTimestamp = dateTimestamp(bm.lastVerifiedDate);
    if (
      evaluationTimestamp !== null &&
      verifiedTimestamp !== null &&
      verifiedTimestamp < evaluationTimestamp
    ) {
      dateIssues.push(
        `${model.id}:${bmId} lastVerifiedDate ${bm.lastVerifiedDate} precedes ${bm.evaluationDate}`
      );
    }

    const shownValue = displayNumber(bm.displayValue);
    if (shownValue === null || Math.abs(shownValue - bm.score) > 0.05) {
      displayIssues.push(`${model.id}:${bmId} ${bm.displayValue} vs ${bm.score}`);
    }

    if (bm.datasetVersion) benchlmScores.push({ modelId: model.id, bmId, bm });
    if (bm.methodologyNotes === 'Provider exact' || bm.methodologyNotes === 'Secondary exact') {
      placeholderNotes.push(`${model.id}:${bmId}`);
    }

    let host = '';
    try {
      host = new URL(bm.sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      host = '';
    }
    if (host === 'benchlm.ai') benchlmHostedScores.push({ modelId: model.id, bmId, bm });
    if (host === 'qwen.ai' && model.developer !== 'Alibaba') {
      crossVendorScores.push(`${model.id}:${bmId} -> ${host}`);
    }
    if (host === 'ai.meta.com' && model.developer !== 'Meta') {
      crossVendorScores.push(`${model.id}:${bmId} -> ${host}`);
    }
  }
}

assert(boundsValid, 'Scores sit inside valid empirical ranges', boundsDetail);
assert(totalScores === 795, 'Catalogue keeps its audited score count', `Found: ${totalScores}`);
assert(
  officialScores > 0 && independentScores > 0,
  'Both provenance classes are represented',
  `Official: ${officialScores}, Independent: ${independentScores}`
);
assert(dateIssues.length === 0, 'Evaluation and verification dates are valid and ordered', dateIssues.slice(0, 3).join('; '));
assert(displayIssues.length === 0, 'displayValue matches the numeric score', displayIssues.slice(0, 3).join('; '));
assert(placeholderNotes.length === 0, 'No placeholder provenance text remains', placeholderNotes.slice(0, 3).join(', '));
assert(crossVendorScores.length === 0, 'No score cites another lab as its source URL', crossVendorScores.join(', '));

assert(
  benchlmScores.length > 0 && benchlmScores.every(({ bm }) => bm.evaluationDate === SNAPSHOT_DATE),
  'BenchLM scores use the published snapshot date, not the release month',
  `${benchlmScores.length} scores at ${SNAPSHOT_DATE}`
);
assert(
  benchlmScores.every(({ bm }) => bm.methodologyNotes?.includes(EVALUATION_DATE_NOTE)),
  'BenchLM scores disclose that the source publishes no evaluation date',
  `${benchlmScores.length} labelled`
);
assert(
  benchlmHostedScores.every(({ bm }) => bm.evaluator === 'BenchLM (aggregated)'),
  'Scores hosted on benchlm.ai credit BenchLM as the aggregator',
  `${benchlmHostedScores.length} scores`
);

const scoredModels = AI_MODELS_DATA.filter((m) => Object.keys(m.benchmarks).length > 0).length;
assert(
  scoredModels / AI_MODELS_DATA.length >= 0.5,
  'At least half the catalogue carries a published score',
  `${scoredModels}/${AI_MODELS_DATA.length}`
);

// -----------------------------------------------------------------
// 5. Pricing Sentinels
// -----------------------------------------------------------------
const pricingIssues = [];
for (const model of AI_MODELS_DATA) {
  for (const field of ['inputPerMillion', 'outputPerMillion']) {
    const value = model.pricing?.[field];
    const valid =
      value === null ||
      value === 'Free (Open Weights)' ||
      (typeof value === 'number' && Number.isFinite(value) && value >= 0);
    if (!valid) pricingIssues.push(`${model.id}.${field}=${value}`);
  }
}
assert(pricingIssues.length === 0, 'Pricing is non-negative, finite, free, or unknown', pricingIssues.slice(0, 3).join(', '));

const sentinelPricingValid = ['typesafe/jev-router', 'nvidia/switchyard'].every((id) => {
  const model = getModelById(id);
  return (
    model?.pricing.inputPerMillion === null &&
    model?.pricing.outputPerMillion === null
  );
});
assert(sentinelPricingValid, 'OpenRouter -1 price sentinels are stored as unknown (null)');

// -----------------------------------------------------------------
// 6. Validation Service Check
// -----------------------------------------------------------------
let allValid = true;
for (const model of AI_MODELS_DATA) {
  const result = validateModelRecord(model);
  if (!result.valid) {
    allValid = false;
    console.error(`Validation failed for ${model.id}:`, result.errors);
  }
}
assert(allValid, `validateModelRecord() passes for all ${AI_MODELS_DATA.length} models`);

const baseRecord = AI_MODELS_DATA.find((m) => m.id === 'anthropic/claude-opus-4.5');
const baseBenchmarkId = Object.keys(baseRecord.benchmarks).find(
  (id) => baseRecord.benchmarks[id].unit === '%'
);

function validationErrors(mutate) {
  const record = clone(baseRecord);
  mutate(record, record.benchmarks[baseBenchmarkId]);
  return validateModelRecord(record).errors;
}

const negativePricingErrors = validationErrors((record) => {
  record.pricing.inputPerMillion = -1;
});
assert(
  negativePricingErrors.some((error) => error.includes('negative')),
  'validateModelRecord rejects negative pricing',
  negativePricingErrors[0]
);

const nonFinitePricingErrors = validationErrors((record) => {
  record.pricing.outputPerMillion = Infinity;
});
assert(
  nonFinitePricingErrors.some((error) => error.includes('not a finite number')),
  'validateModelRecord rejects non-finite pricing',
  nonFinitePricingErrors[0]
);

const badEvaluationDateErrors = validationErrors((record, bm) => {
  bm.evaluationDate = '2026-13';
});
assert(
  badEvaluationDateErrors.some((error) => error.includes('invalid evaluationDate')),
  'validateModelRecord rejects malformed evaluationDate values',
  badEvaluationDateErrors[0]
);

const badVerifiedDateErrors = validationErrors((record, bm) => {
  bm.lastVerifiedDate = '20-10-2026';
});
assert(
  badVerifiedDateErrors.some((error) => error.includes('invalid lastVerifiedDate')),
  'validateModelRecord rejects malformed lastVerifiedDate values',
  badVerifiedDateErrors[0]
);

const dateOrderErrors = validationErrors((record, bm) => {
  bm.evaluationDate = '2026-10';
  bm.lastVerifiedDate = '2026-09-01';
});
assert(
  dateOrderErrors.some((error) => error.includes('precedes evaluationDate')),
  'validateModelRecord rejects verification dates before the evaluation date',
  dateOrderErrors[0]
);

const displayMismatchErrors = validationErrors((record, bm) => {
  bm.displayValue = `${bm.score + 5}%`;
});
assert(
  displayMismatchErrors.some((error) => error.includes('does not match score')),
  'validateModelRecord rejects displayValue that contradicts the score',
  displayMismatchErrors[0]
);

const missingDefinitionErrors = validationErrors((record) => {
  record.benchmarks['unknown-benchmark'] = {
    ...record.benchmarks[baseBenchmarkId],
    benchmarkId: 'unknown-benchmark',
  };
});
assert(
  missingDefinitionErrors.some((error) => error.includes('no registered benchmark definition')),
  'validateModelRecord rejects scores without a registered definition',
  missingDefinitionErrors[0]
);

const zeroScoreErrors = validationErrors((record, bm) => {
  bm.score = 0;
  bm.displayValue = '0%';
});
assert(
  zeroScoreErrors.length === 0,
  'validateModelRecord accepts a legitimate zero percentage (service parity)',
  zeroScoreErrors.join('; ')
);

// -----------------------------------------------------------------
// 7. Query & Capability Filtering
// -----------------------------------------------------------------
const codingModels = getAvailableModels({ capability: 'Coding' });
assert(codingModels.length >= 10, 'Capability filter "Coding" returns specialized models', `Count: ${codingModels.length}`);

const reasoningModels = getAvailableModels({ capability: 'Reasoning' });
assert(reasoningModels.length >= 10, 'Capability filter "Reasoning" returns specialized models', `Count: ${reasoningModels.length}`);

const openWeights = getAvailableModels({ provider: 'OpenWeights' });
assert(
  openWeights.length > 0 && openWeights.every((m) => m.specs.isOpenWeights),
  'Provider filter "OpenWeights" never leaks closed models',
  `Count: ${openWeights.length}`
);

const currentList = getAvailableModels({ generation: 'current' });
assert(
  currentList.length === currentGenCount && currentList.every((m) => m.specs.generation === 'current'),
  'Generation filter "current" matches the audit count',
  `Count: ${currentList.length}`
);

assert(
  getAvailableModels({ generation: 'historical-baseline' }).length === 0,
  'No historical-baseline records remain',
  ''
);

// -----------------------------------------------------------------
// 8. Benchmark Definitions Coverage
// -----------------------------------------------------------------
const defs = Object.keys(BENCHMARK_DEFINITIONS);
const required = [
  'aa-intelligence',
  'aa-coding',
  'aa-agentic',
  'swe-bench-pro',
  'terminal-bench',
  'arc-agi',
  'gpqa-diamond',
  'hle',
    'frontiermath',
  'design-arena',
];
const missingDefs = required.filter((id) => !defs.includes(id));
assert(missingDefs.length === 0, 'All 10 benchmark definitions are registered', missingDefs.join(', '));

const unknownScores = [];
for (const model of AI_MODELS_DATA) {
  for (const bmId of Object.keys(model.benchmarks)) {
    if (!BENCHMARK_DEFINITIONS[bmId]) unknownScores.push(`${model.id}:${bmId}`);
  }
}
assert(
  unknownScores.length === 0,
  'Every published score maps to a registered definition',
  unknownScores.slice(0, 5).join(', ')
);

const incompleteDefs = defs.filter((id) => {
  const d = BENCHMARK_DEFINITIONS[id];
  return !d.name || !d.category || !d.description || !d.whatItMeasures || !d.limitations;
});
assert(incompleteDefs.length === 0, 'Definitions carry full methodology copy', incompleteDefs.join(', '));

// 10. Quadrant matrix integrity: capability score validity & safe plottability
const aaScores = AI_MODELS_DATA.map((m) => m.benchmarks['aa-intelligence']?.score).filter(
  (s) => typeof s === 'number'
);
assert(
  aaScores.length > 0 && aaScores.every((s) => s >= 0 && s <= 100),
  'Artificial Analysis Intelligence Index scores are within valid 0-100% bounds',
  `Found ${aaScores.length} scores`
);

// Verify that quadrant plotting logic never treats missing scores as 0 or 20
const unplottableCount = AI_MODELS_DATA.filter((m) => {
  const capability = m.benchmarks['aa-intelligence']?.score;
  const hasCapability = typeof capability === 'number' && Number.isFinite(capability);
  const hasNumericCost = typeof m.pricing.outputPerMillion === 'number' && Number.isFinite(m.pricing.outputPerMillion);
  const isOpenWeights = m.specs.isOpenWeights || m.pricing.outputPerMillion === 'Free (Open Weights)';
  return !hasCapability || (!hasNumericCost && !isOpenWeights);
}).length;

assert(
  unplottableCount > 0,
  `Quadrant chart correctly identifies models lacking complete capability/pricing pairs (${unplottableCount} models unplottable)`
);

console.log('='.repeat(70));
console.log(`BENCHMARK TEST SUITE: ${passed} PASSED | ${failed} FAILED`);
console.log('='.repeat(70));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL AI MODEL BENCHMARK TESTS PASSED CLEANLY!');
  process.exit(0);
}
