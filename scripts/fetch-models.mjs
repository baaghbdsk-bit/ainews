/**
 * Regenerates the benchmark catalogue from live sources.
 *
 * Sources:
 *  - OpenRouter public model catalogue (no API key): identity, release date,
 *    context window, pricing, modalities, Artificial Analysis indices,
 *    Design Arena ELO.
 *  - BenchLM benchmark leaderboards (published vendor + benchmark-owner
 *    results): SWE-bench Verified, SWE-bench Pro, Terminal-Bench 4.0,
 *    FrontierMath v2, ARC-AGI-2, GPQA Diamond, HLE.
 *
 * The catalogue is a rolling 6-month window: a model drops out once it is
 * older than six months, so the file never accumulates years of history.
 *
 * Usage: node scripts/fetch-models.mjs [--since YYYY-MM-DD] [--refresh]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'scratch', 'models.json');
const BENCH_CACHE = path.join(ROOT, 'scratch', 'benchlm.json');
const OUT = path.join(ROOT, 'src', 'lib', 'benchmarks', 'data.ts');
const TODAY = new Date().toISOString().slice(0, 10);

/** The catalogue is a rolling window: old models drop out as they age. */
const WINDOW_MONTHS = 6;

function monthsAgo(date, months) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

const SINCE = process.argv.includes('--since')
  ? process.argv[process.argv.indexOf('--since') + 1]
  : monthsAgo(TODAY, WINDOW_MONTHS);
const REFRESH = process.argv.includes('--refresh');

const BENCHLM_BENCHMARKS = [
  { id: 'swe-bench-pro', slug: 'swe-bench-pro', name: 'SWE-bench Pro', category: 'Coding' },
  { id: 'terminal-bench', slug: 'terminal-bench-4', name: 'Terminal-Bench 4.0', category: 'Agentic' },
  { id: 'frontiermath', slug: 'frontiermathv2tiers13', name: 'FrontierMath v2 (Tiers 1-3)', category: 'Mathematics' },
  { id: 'arc-agi', slug: 'arc-agi-2', name: 'ARC-AGI-2', category: 'Reasoning' },
  { id: 'gpqa-diamond', slug: 'gpqa-diamond', name: 'GPQA Diamond', category: 'Reasoning' },
  { id: 'hle', slug: 'hle', name: "Humanity's Last Exam", category: 'Reasoning' },
  { id: 'aa-coding-agent', slug: 'aacodingagents', name: 'AA Coding Agent Index v2.0', category: 'Coding' },
];

const VENDORS = {
  anthropic: ['Anthropic', 'violet'],
  openai: ['OpenAI', 'emerald'],
  google: ['Google DeepMind', 'blue'],
  meta: ['Meta', 'cyan'],
  'meta-llama': ['Meta', 'cyan'],
  deepseek: ['DeepSeek', 'indigo'],
  qwen: ['Alibaba', 'amber'],
  alibaba: ['Alibaba', 'amber'],
  mistralai: ['Mistral AI', 'orange'],
  'x-ai': ['xAI', 'rose'],
  moonshotai: ['Moonshot AI', 'teal'],
  'z-ai': ['Zhipu AI', 'sky'],
  nvidia: ['NVIDIA', 'lime'],
  minimax: ['MiniMax', 'pink'],
  xiaomi: ['Xiaomi', 'red'],
  bytedance: ['ByteDance', 'blue'],
  'bytedance-seed': ['ByteDance', 'blue'],
  tencent: ['Tencent', 'cyan'],
  amazon: ['Amazon', 'amber'],
  cohere: ['Cohere', 'rose'],
  ai21: ['AI21 Labs', 'emerald'],
  liquid: ['Liquid AI', 'teal'],
  'ibm-granite': ['IBM', 'blue'],
  inception: ['Inception', 'violet'],
  upstage: ['Upstage', 'purple'],
  stepfun: ['StepFun', 'indigo'],
  inclusionai: ['InclusionAI', 'sky'],
  reflection: ['Reflection AI', 'slate'],
  sakana: ['Sakana AI', 'pink'],
  poolside: ['Poolside', 'teal'],
  writer: ['Writer', 'emerald'],
  perplexity: ['Perplexity', 'cyan'],
  rekaai: ['Reka', 'orange'],
  'arcee-ai': ['Arcee AI', 'rose'],
  nousresearch: ['Nous Research', 'amber'],
  morph: ['Morph', 'slate'],
  'aion-labs': ['Aion Labs', 'blue'],
  thinkingmachines: ['Thinking Machines', 'violet'],
  'nex-agi': ['Nex AGI', 'indigo'],
  scaledown: ['ScaleDown', 'slate'],
  perceptron: ['Perceptron', 'sky'],
  'inference-net': ['Inference.net', 'teal'],
  relace: ['Relace', 'cyan'],
  meituan: ['Meituan', 'amber'],
  'prism-ml': ['Prism ML', 'purple'],
  unbiased: ['Unbiased', 'emerald'],
  elorian: ['Elorian', 'rose'],
  moondream: ['Moondream', 'sky'],
  fireworks: ['Fireworks', 'orange'],
  typesafe: ['Typesafe', 'slate'],
  thedrummer: ['TheDrummer', 'rose'],
  cognitivecomputations: ['Cognitive Computations', 'amber'],
  microsoft: ['Microsoft', 'blue'],
};

const EFFORT = /\b(high|xhigh|max|medium|low|none|minimal|unknown|thinking|non-?thinking|reasoning|preview|experimental)\b/g;

function normKey(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/^https?:\/\/\S+$/, '')
    .replace(/\d{4}-\d{2}-\d{2}/g, '')
    .replace(/\d{8}/g, '')
    .replace(/_\d+k\b/g, '')
    .replace(/[-_]\d+b(?:-a\d+b)?\b/g, '')
    .replace(EFFORT, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join('');
}

function firstSentence(text, max = 132) {
  const clean = String(text || '').replace(/\s+/g, ' ').replace(/[*_`#]/g, '').trim();
  if (!clean) return '';
  const sentence = clean.split(/(?<=[.!?])\s/)[0] || clean;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trim()}…` : sentence;
}

function displayContext(n) {
  if (!n) return 'Unknown';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M tokens`;
  return `${Math.round(n / 1000)}K tokens`;
}

function perMillion(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return +(n * 1_000_000).toFixed(4);
}

function capabilitiesOf(m) {
  const blob = `${m.id} ${m.name} ${m.description || ''}`.toLowerCase();
  const caps = new Set(['General']);
  const input = m.architecture?.input_modalities || [];
  if (m.reasoning || /\b(reason|thinking|o[134]\b|r1\b|qwq|glm-?z)/.test(blob)) caps.add('Reasoning');
  if (/\b(cod(e|ing)|swe|dev|agent|terminal|program)\b/.test(blob) || m.supported_parameters?.includes('tools')) caps.add('Coding');
  if (/\b(math|aime|olympiad|geometry|frontiermath)\b/.test(blob)) caps.add('Mathematics');
  if (input.some((x) => x !== 'text')) caps.add('Multimodal');
  const prompt = perMillion(m.pricing?.prompt);
  const completion = perMillion(m.pricing?.completion);
  if (typeof prompt === 'number' && typeof completion === 'number' && prompt <= 0.6 && completion <= 3) {
    caps.add('Efficient');
  }
  return [...caps];
}

const VENDOR_SOURCE_HOSTS = {
  anthropic: ['anthropic.com', 'www-cdn.anthropic.com', 'cdn.sanity.io'],
  openai: ['openai.com', 'cdn.openai.com'],
  google: ['deepmind.google', 'blog.google', 'ai.google', 'googleblog.com'],
  meta: ['meta.com', 'ai.meta.com', 'research.meta.ai'],
  alibaba: ['qwen.ai', 'alibabacloud.com'],
  'x-ai': ['x.ai'],
  'z-ai': ['z.ai', 'docs.z.ai'],
  moonshotai: ['moonshot.ai', 'kimi.com'],
  deepseek: ['deepseek.com'],
  mistralai: ['mistral.ai'],
  minimax: ['minimax.io'],
  nvidia: ['nvidia.com'],
  xiaomi: ['xiaomi.com', 'mimo.xiaomi.com'],
  stepfun: ['stepfun.com'],
  upstage: ['upstage.ai'],
  inception: ['inceptionlabs.ai'],
  tencent: ['tencent.com'],
  poolside: ['poolside.ai'],
  'arcee-ai': ['arcee.ai'],
  liquid: ['liquid.ai'],
  'ibm-granite': ['ibm.com'],
  unbiased: ['unbiased.ai'],
  'thinkingmachines': ['thinkingmachines.ai'],
};

const VENDOR_ALIAS = { qwen: 'alibaba', 'meta-llama': 'meta', 'bytedance-seed': 'bytedance' };

function canonicalVendor(slug) {
  return VENDOR_ALIAS[slug] || slug;
}

const HOST_OWNER = {};
for (const [vendor, hosts] of Object.entries(VENDOR_SOURCE_HOSTS)) {
  for (const host of hosts) HOST_OWNER[host] = vendor;
}

/**
 * A score may be reported by a different lab's comparison table. Keep the
 * BenchLM model page as the fallback instead of citing an unrelated vendor.
 */
function guardSourceUrl(sourceUrl, vendorSlug, fallback) {
  if (!sourceUrl) return fallback;
  let host;
  try {
    host = new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return fallback;
  }
  const owner = HOST_OWNER[host];
  if (owner && owner !== canonicalVendor(vendorSlug)) {
    console.warn(`  cross-vendor source ignored for ${vendorSlug}: ${sourceUrl}`);
    return fallback;
  }
  return sourceUrl;
}

function evaluatorFor(sourceUrl, fallback) {
  try {
    if (new URL(sourceUrl).hostname.replace(/^www\./, '') === 'benchlm.ai') return 'BenchLM (aggregated)';
  } catch {
    // keep the fallback
  }
  return fallback;
}

/**
 * A provider can move or remove a PDF without changing the underlying model
 * card. Keep the citation on a stable first-party page when a known mirror URL
 * is retired; the source audit in CI catches any new dead links.
 */
function repairSourceUrl(sourceUrl) {
  if (sourceUrl?.includes('huggingface.co/deepseek-ai/DeepSeek-V4-Pro/resolve/main/DeepSeek_V4.pdf')) {
    return 'https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro';
  }
  return sourceUrl;
}

function benchlmMethodology(provenance, sourceLabel) {
  const dateNote = 'Evaluation date not published by source; snapshot date shown.';
  let note = provenance;
  if (!note || /^(Provider|Secondary) exact$/i.test(note)) {
    note = sourceLabel ? `Source: ${sourceLabel}.` : '';
  }
  if (note.includes('Evaluation date not published')) return note;
  return note ? `${note.replace(/\s+$/, '')} ${dateNote}` : dateNote;
}

async function fetchOpenRouter() {
  if (fs.existsSync(CACHE) && !REFRESH) {
    const cached = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    if (Date.now() - cached.fetchedAt < 6 * 3600 * 1000) {
      console.log('  using cached OpenRouter catalogue');
      return cached.data;
    }
  }
  const res = await fetch('https://openrouter.ai/api/v1/models?limit=1000');
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = (await res.json()).data;
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({ fetchedAt: Date.now(), data }));
  return data;
}

function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/**
 * Each leaderboard may list the same base model several times (effort variants,
 * scaffolds). Keep the highest score per normalised model key.
 */
async function loadBenchlmScores() {
  const cache = fs.existsSync(BENCH_CACHE) ? JSON.parse(fs.readFileSync(BENCH_CACHE, 'utf8')) : {};
  const fresh = cache.fetchedAt && Date.now() - cache.fetchedAt < 12 * 3600 * 1000 && !REFRESH;
  const out = {};

  for (const bench of BENCHLM_BENCHMARKS) {
    if (fresh && cache.data?.[bench.id]) {
      out[bench.id] = new Map(Object.entries(cache.data[bench.id]));
      console.log(`  ${bench.id}: ${out[bench.id].size} models (cached)`);
      continue;
    }
    try {
      const res = await fetch(`https://benchlm.ai/benchmarks/${bench.slug}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = extractNextData(await res.text());
      const rows = next?.props?.pageProps?.leaderboard || [];
      const map = new Map();
      for (const row of rows) {
        const score = Number(row.score);
        if (!Number.isFinite(score) || score < 0 || score > 100) continue;
        const key = normKey(row.slug || row.model);
        if (!key) continue;
        const prev = map.get(key);
        if (prev && prev.score >= score) continue;
        map.set(key, { score, model: row.model, slug: row.slug, creator: row.creator });
      }
      out[bench.id] = map;
      cache.data = cache.data || {};
      cache.data[bench.id] = Object.fromEntries(map);
      console.log(`  ${bench.id}: ${map.size} models`);
    } catch (err) {
      console.warn(`  ${bench.id}: failed (${err.message})`);
      out[bench.id] = new Map();
    }
  }

  fs.mkdirSync(path.dirname(BENCH_CACHE), { recursive: true });
  fs.writeFileSync(BENCH_CACHE, JSON.stringify({ fetchedAt: Date.now(), data: cache.data }, null, 0));
  return out;
}

function lookupBench(map, candidates) {
  if (!map) return null;
  const keys = candidates.map(normKey).filter(Boolean);
  for (const k of keys) {
    const hit = map.get(k);
    if (hit) return hit;
  }
  return null;
}

const MODEL_CACHE = path.join(ROOT, 'scratch', 'benchlm-models.json');

const PAGE_ENTRY_IDS = {
  swePro: 'swe-bench-pro',
  terminalBench4: 'terminal-bench',
  frontierMathV2Tiers13: 'frontiermath',
  arcAgi2: 'arc-agi',
  gpqaDiamond: 'gpqa-diamond',
  gpqa: 'gpqa-diamond',
  hleNoTools: 'hle',
};

function benchlmModelSlug(shortSlug) {
  return String(shortSlug || '')
    .toLowerCase()
    .replace(/[._]/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Per-model pages carry the vendor's own per-benchmark numbers with source
 * links, which is more precise than the aggregated leaderboard rows.
 */
async function loadBenchlmModels(slugs) {
  const cache = fs.existsSync(MODEL_CACHE) ? JSON.parse(fs.readFileSync(MODEL_CACHE, 'utf8')) : {};
  const fresh = cache.fetchedAt && Date.now() - cache.fetchedAt < 24 * 3600 * 1000 && !REFRESH;
  const result = {};
  const todo = [];

  for (const slug of slugs) {
    if (!slug) continue;
    const hit = cache.data?.[slug];
    if (fresh && hit) result[slug] = hit;
    else todo.push(slug);
  }

  const queue = [...new Set(todo)];
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const slug = queue.shift();
      try {
        const res = await fetch(`https://benchlm.ai/models/${slug}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (res.ok) {
          const page = extractNextData(await res.text())?.props?.pageProps?.pageData;
          if (page?.benchmarkDetails) {
            const scores = {};
            for (const group of page.benchmarkDetails) {
              for (const entry of group.entries || []) {
                const id = PAGE_ENTRY_IDS[entry.key];
                if (!id || !Number.isFinite(Number(entry.rawScore))) continue;
                if (scores[id] && scores[id].score >= entry.rawScore) continue;
                scores[id] = {
                  score: Number(entry.rawScore),
                  statusLabel: entry.statusLabel,
                  sourceUrl: entry.sourceUrl,
                  provenance: entry.provenance,
                  sourceLabel: entry.sourceLabel,
                  name: entry.name,
                };
              }
            }
            result[slug] = {
              scores,
              modelCardUrl: page.modelCardUrl,
              benchmarkNote: page.benchmarkNote,
            };
          } else {
            result[slug] = { scores: {} };
          }
        }
      } catch {
        result[slug] = { scores: {} };
      }
      done += 1;
      if (done % 40 === 0) console.log(`  model pages ${done}/${done + queue.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  fs.mkdirSync(path.dirname(MODEL_CACHE), { recursive: true });
  fs.writeFileSync(
    MODEL_CACHE,
    JSON.stringify({ fetchedAt: Date.now(), data: { ...(cache.data || {}), ...result } }, null, 0)
  );
  return result;
}

const SUFFIX = /:(free|batch|extended|thinking|online|nitro|floor|exacto)$/;

function buildRecords(models, benchlm, benchlmModels) {
  const since = Date.parse(`${SINCE}T00:00:00Z`);
  const seen = new Set();
  const out = [];

  for (const m of models) {
    if (Date.parse(new Date(m.created * 1000).toISOString()) < since) continue;
    if (SUFFIX.test(m.id) || m.id.startsWith('~') || m.id.startsWith('openrouter/')) continue;
    const dedupeKey = m.canonical_slug || m.id;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const releaseDate = new Date(m.created * 1000).toISOString().slice(0, 10);
    const vendorSlug = m.id.split('/')[0];
    const [developer, developerColor] = VENDORS[vendorSlug] || [
      vendorSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      'slate',
    ];
    const isOpenWeights = Boolean(m.hugging_face_id);
    const promptPrice = perMillion(m.pricing?.prompt);
    const completionPrice = perMillion(m.pricing?.completion);
    const name = m.name.replace(/^[^:]+:\s*/, '').trim();
    const shortSlug = m.id.split('/')[1] || m.id;
    const candidates = [shortSlug, m.canonical_slug?.split('/')[1], name];

    const benchmarks = {};
    const page = benchlmModels[benchlmModelSlug(shortSlug)] || null;

    for (const bench of BENCHLM_BENCHMARKS) {
      const own = page?.scores?.[bench.id];
      const hit = lookupBench(benchlm[bench.id], candidates);
      if (own) {
        const official = /provider/i.test(own.statusLabel || '');
        const fallbackUrl = `https://benchlm.ai/models/${benchlmModelSlug(shortSlug)}`;
        const sourceUrl = guardSourceUrl(repairSourceUrl(own.sourceUrl), vendorSlug, fallbackUrl);
        benchmarks[bench.id] = {
          benchmarkId: bench.id,
          name: bench.name,
          category: bench.category,
          score: +own.score.toFixed(1),
          displayValue: `${own.score.toFixed(1)}%`,
          unit: '%',
          evaluationType: official ? 'Official Report' : 'Independent Evaluation',
          evaluator: evaluatorFor(
            sourceUrl,
            official ? `${developer} (vendor-reported)` : 'BenchLM verified result'
          ),
          evaluationDate: TODAY,
          sourceUrl,
          methodologyNotes: benchlmMethodology(own.provenance, own.sourceLabel),
          datasetVersion: `${own.name || bench.name} (BenchLM snapshot ${TODAY})`,
          lastVerifiedDate: TODAY,
        };
      } else if (hit) {
        const sourceUrl = `https://benchlm.ai/benchmarks/${bench.slug}`;
        benchmarks[bench.id] = {
          benchmarkId: bench.id,
          name: bench.name,
          category: bench.category,
          score: +hit.score.toFixed(1),
          displayValue: `${hit.score.toFixed(1)}%`,
          unit: '%',
          evaluationType: 'Official Report',
          evaluator: evaluatorFor(sourceUrl, `${developer} (published results)`),
          evaluationDate: TODAY,
          sourceUrl,
          methodologyNotes: benchlmMethodology(
            `Aggregated by BenchLM from published vendor and benchmark-owner results; best reported configuration for ${hit.model}.`,
            null
          ),
          datasetVersion: `${bench.name} (BenchLM snapshot ${TODAY})`,
          lastVerifiedDate: TODAY,
        };
}
    }

    const aa = m.benchmarks?.artificial_analysis;
    if (aa) {
      const indices = [
        ['aa-intelligence', 'Artificial Analysis Intelligence Index', 'General Knowledge', aa.intelligence_index],
        ['aa-coding', 'Artificial Analysis Coding Index', 'Coding', aa.coding_index],
        ['aa-agentic', 'Artificial Analysis Agentic Index', 'Agentic', aa.agentic_index],
      ];
      for (const [id, benchName, category, value] of indices) {
        if (typeof value !== 'number') continue;
        benchmarks[id] = {
          benchmarkId: id,
          name: benchName,
          category,
          score: +value.toFixed(1),
          displayValue: `${value.toFixed(1)}%`,
          unit: '%',
          evaluationType: 'Independent Evaluation',
          evaluator: 'Artificial Analysis',
          evaluationDate: TODAY.slice(0, 7),
          sourceUrl: 'https://artificialanalysis.ai/leaderboards/models',
          lastVerifiedDate: TODAY,
        };
      }
    }

    const arena = m.benchmarks?.design_arena;
    if (Array.isArray(arena) && arena.length) {
      const best = arena.reduce((a, b) => (b.elo > a.elo ? b : a));
      benchmarks['design-arena'] = {
        benchmarkId: 'design-arena',
        name: 'Design Arena ELO',
        category: 'Human Preference',
        score: best.elo,
        displayValue: `${Math.round(best.elo)}`,
        unit: 'ELO',
        evaluationType: 'Independent Evaluation',
        evaluator: 'Design Arena',
        evaluationDate: TODAY.slice(0, 7),
        sourceUrl: 'https://www.designarena.ai/leaderboard',
        methodologyNotes: `Best arena category: ${best.category} (rank #${best.rank}, win rate ${best.win_rate}%).`,
        lastVerifiedDate: TODAY,
      };
    }

    // Snapshot-time label. The service layer derives the effective generation
    // from releaseDate at read time (generationFor in service.ts), so this
    // value is only a hint for readers of the generated file.
    const generation =
      Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(releaseDate) <= 180 * 86_400_000
        ? 'current'
        : 'previous';

    out.push({
      id: m.id,
      name,
      developer,
      developerColor,
      tagline: firstSentence(m.description) || `${name} by ${developer}.`,
      specs: {
        contextWindowTokens: m.context_length || 0,
        displayContext: displayContext(m.context_length),
        license: isOpenWeights ? 'Open Weights (Apache 2.0 / MIT / Community)' : 'Proprietary Cloud API',
        isOpenWeights,
        releaseDate,
        versionIdentifier: m.id,
        generation,
        availability: 'Generally Available',
        capabilities: capabilitiesOf(m),
        architecture: m.architecture?.modality,
      },
      pricing: {
        inputPerMillion: isOpenWeights ? 'Free (Open Weights)' : promptPrice,
        outputPerMillion: isOpenWeights ? 'Free (Open Weights)' : completionPrice,
        unit: isOpenWeights ? 'Open weights — self-host or third-party hosting' : 'USD per 1M tokens',
      },
      benchmarks,
      officialSourceUrl: `https://openrouter.ai/${m.id}`,
      officialDocumentationUrl: m.hugging_face_id
        ? `https://huggingface.co/${m.hugging_face_id}`
        : undefined,
      lastAuditedDate: TODAY,
      aliases: [...new Set([shortSlug, m.canonical_slug].filter((a) => a && a !== m.id))],
    });
  }

  out.sort((a, b) => b.specs.releaseDate.localeCompare(a.specs.releaseDate));

  // AA Coding Agent Index (system-level: model + harness)
  // Map system entries like "Claude Code - Opus 5.5 (max)" to base models
  const aaCodingAgentMap = benchlm['aa-coding-agent'];
  if (aaCodingAgentMap?.size) {
    const modelBest = new Map();
    for (const [, entry] of aaCodingAgentMap) {
      const systemName = entry.model || '';
      const match = systemName.match(/[-–]\s*([^\(]+)\s*(?:\([^)]+\))?$/);
      const baseName = match ? match[1].trim() : systemName;
      const norm = normKey(baseName);
      if (!norm) continue;
      const score = entry.score;
      if (typeof score !== 'number' || !Number.isFinite(score)) continue;
      const prev = modelBest.get(norm);
      if (!prev || score > prev.score) {
        modelBest.set(norm, { score, system: systemName, harness: entry.creator });
      }
    }
    for (const rec of out) {
      const idPart = rec.id.split('/')[1] || '';
      const baseId = idPart.replace(/^[a-z]+-/, ''); // remove vendor prefix
      const candidates = [
        normKey(rec.name),
        normKey(idPart),
        normKey(rec.specs.versionIdentifier),
        normKey(baseId), // vendor-less: "opus-5.5" -> "55opsu"
      ].filter(Boolean);
      for (const cand of candidates) {
        const hit = modelBest.get(cand);
        if (hit) {
          rec.benchmarks['aa-coding-agent'] = {
            benchmarkId: 'aa-coding-agent',
            name: 'AA Coding Agent Index v2.0',
            category: 'Coding',
            score: +hit.score.toFixed(1),
            displayValue: `${hit.score.toFixed(1)}%`,
            unit: '%',
            evaluationType: 'Independent Evaluation',
            evaluator: `Artificial Analysis (${hit.harness || 'agent system'})`,
            evaluationDate: TODAY.slice(0, 7),
            sourceUrl: 'https://artificialanalysis.ai/agents/coding-agents',
            methodologyNotes: `System: ${hit.system}. ${benchlmMethodology('display-only mirror', 'AA Coding Agents')}`,
            lastVerifiedDate: TODAY,
          };
          break;
        }
        // Fallback: substring match for cases like "opus55" in "claudeopus55"
        for (const [key, val] of modelBest) {
          if (cand.includes(key) || key.includes(cand)) {
            rec.benchmarks['aa-coding-agent'] = {
              benchmarkId: 'aa-coding-agent',
              name: 'AA Coding Agent Index v2.0',
              category: 'Coding',
              score: +val.score.toFixed(1),
              displayValue: `${val.score.toFixed(1)}%`,
              unit: '%',
              evaluationType: 'Independent Evaluation',
              evaluator: `Artificial Analysis (${val.harness || 'agent system'})`,
              evaluationDate: TODAY.slice(0, 7),
              sourceUrl: 'https://artificialanalysis.ai/agents/coding-agents',
              methodologyNotes: `System: ${val.system}. ${benchlmMethodology('display-only mirror', 'AA Coding Agents')}`,
              lastVerifiedDate: TODAY,
            };
            break;
          }
        }
      }
    }
  }

  return out;
}

const DEFINITIONS = [
  { id: 'aa-intelligence', name: 'Artificial Analysis Intelligence Index', shortName: 'AA Intelligence', category: 'General Knowledge', unit: '%', description: 'Composite index aggregating 10+ evaluations of general reasoning and knowledge.', whatItMeasures: 'Broad capability across reasoning, science, coding, and instruction following.', realWorldSignificance: 'Best single proxy for general-purpose model quality.', limitations: 'Composite weighting is proprietary; not directly comparable to vendor-reported scores.' },
  { id: 'aa-coding', name: 'Artificial Analysis Coding Index', shortName: 'AA Coding', category: 'Coding', unit: '%', description: 'Composite index of coding and software-engineering evaluations.', whatItMeasures: 'Code generation, debugging, and repository-level task performance.', realWorldSignificance: 'Indicates suitability for development tooling and agentic coding.', limitations: 'Scaffold and language coverage vary between underlying evaluations.' },
  { id: 'aa-agentic', name: 'Artificial Analysis Agentic Index', shortName: 'AA Agentic', category: 'Agentic', unit: '%', description: 'Composite index of tool-use and long-horizon agentic tasks.', whatItMeasures: 'Multi-step planning, tool invocation, and task completion.', realWorldSignificance: 'Predicts reliability in autonomous workflows.', limitations: 'Agent harnesses differ; results are not directly comparable across scaffolds.' },
  { id: 'aa-coding-agent', name: 'Artificial Analysis Coding Agent Index v2.0', shortName: 'AA Coding Agent', category: 'Coding', unit: '%', description: 'Composite index of coding-agent systems (model + harness) across FrontierCode v1.1, SWE-Atlas-QnA, and Terminal-Bench v4.', whatItMeasures: 'Real-world software engineering capability of model+harness combinations.', realWorldSignificance: 'Indicates suitability for agentic coding workflows; scores are for systems, not base models alone.', limitations: 'Scores combine model and agent harness; not directly comparable to base-model coding benchmarks. Source is display-only mirror from Artificial Analysis.' },
  { id: 'swe-bench-pro', name: 'SWE-bench Pro', shortName: 'SWE Pro', category: 'Coding', unit: '%', description: 'Harder, contamination-resistant successor to SWE-bench spanning multiple languages.', whatItMeasures: 'Long-horizon repository repair on professional tasks.', realWorldSignificance: 'Current frontier coding signal now that Verified is saturating.', limitations: 'Newer benchmark with fewer independent replications.' },
  { id: 'terminal-bench', name: 'Terminal-Bench 4.0', shortName: 'Terminal 4.0', category: 'Agentic', unit: '%', description: 'Sandboxed command-line tasks requiring shell and file-system operation.', whatItMeasures: 'Autonomous terminal operation and environment debugging.', realWorldSignificance: 'Measures readiness for DevOps and coding-agent deployments.', limitations: 'Agent harness strongly affects results; version 4.0 differs from earlier releases.' },
  { id: 'arc-agi', name: 'ARC-AGI-2', shortName: 'ARC-AGI-2', category: 'Reasoning', unit: '%', description: 'Novel visual grid puzzles requiring abstract rule induction.', whatItMeasures: 'Few-shot abstraction without memorized knowledge.', realWorldSignificance: 'Evidence of genuine generalization rather than recall.', limitations: 'Narrow puzzle format; expensive to run; scores depend on effort setting.' },
  { id: 'gpqa-diamond', name: 'GPQA Diamond', shortName: 'GPQA', category: 'Reasoning', unit: '%', description: 'Graduate-level physics, chemistry, and biology questions written by domain experts.', whatItMeasures: 'Expert scientific reasoning resistant to search.', realWorldSignificance: 'Hard knowledge benchmark still not saturated.', limitations: 'Multiple-choice format; contamination risk rises over time.' },
  { id: 'hle', name: "Humanity's Last Exam", shortName: 'HLE', category: 'Reasoning', unit: '%', description: 'Expert-written questions across hundreds of disciplines designed to resist saturation.', whatItMeasures: 'Deep expert reasoning at the edge of model capability.', realWorldSignificance: 'One of the few unsolved general benchmarks.', limitations: 'Sparse coverage; small absolute differences are noisy.' },
  { id: 'frontiermath', name: 'FrontierMath v2 (Tiers 1-3)', shortName: 'FrontierMath', category: 'Mathematics', unit: '%', description: 'Unpublished, research-level mathematics problems across Tiers 1-3.', whatItMeasures: 'Original mathematical problem solving.', realWorldSignificance: 'Tracks progress on genuinely hard research tasks.', limitations: 'Low absolute scores; Tier 4 is reported separately and is harder still.' },
  { id: 'design-arena', name: 'Design Arena ELO', shortName: 'Design ELO', category: 'Human Preference', unit: 'ELO', description: 'Human-preference ELO across UI, 3D, data-visualization, and game-dev generations.', whatItMeasures: 'Practical front-end output quality as judged by humans.', realWorldSignificance: 'Reflects usability of generated interfaces.', limitations: 'Preference-based; category coverage differs per model.' },
];

function render(records, definitions) {
  const q = (v) => JSON.stringify(String(v));
  // null means "price unknown" and must stay a real null, not the string
  // "null" - the validator and the UI both treat those differently.
  const priceLiteral = (v) =>
    typeof v === 'number' ? String(v) : v === null ? 'null' : q(v);

  const defs = definitions
    .map(
      (d) => `  ${q(d.id)}: {
    id: ${q(d.id)},
    name: ${q(d.name)},
    shortName: ${q(d.shortName)},
    category: ${q(d.category)},
    unit: ${q(d.unit)},
    description: ${q(d.description)},
    whatItMeasures: ${q(d.whatItMeasures)},
    realWorldSignificance: ${q(d.realWorldSignificance)},
    limitations: ${q(d.limitations)},
    higherIsBetter: true,
  },`
    )
    .join('\n');

  const scoreBlocks = (benchmarks) =>
    Object.values(benchmarks)
      .map(
        (b) => `      ${q(b.benchmarkId)}: {
        benchmarkId: ${q(b.benchmarkId)},
        name: ${q(b.name)},
        category: ${q(b.category)},
        score: ${b.score},
        displayValue: ${q(b.displayValue)},
        unit: ${q(b.unit)},
        evaluationType: ${q(b.evaluationType)},
        evaluator: ${q(b.evaluator)},
        evaluationDate: ${q(b.evaluationDate)},
        sourceUrl: ${q(b.sourceUrl)},
${b.methodologyNotes ? `        methodologyNotes: ${q(b.methodologyNotes)},\n` : ''}${b.datasetVersion ? `        datasetVersion: ${q(b.datasetVersion)},\n` : ''}        lastVerifiedDate: ${q(b.lastVerifiedDate)},
      },`
      )
      .join('\n');

  const body = records
    .map(
      (r) => `  {
    id: ${q(r.id)},
    name: ${q(r.name)},
    developer: ${q(r.developer)},
    developerColor: ${q(r.developerColor)},
    tagline: ${q(r.tagline)},
    specs: {
      contextWindowTokens: ${r.specs.contextWindowTokens},
      displayContext: ${q(r.specs.displayContext)},
      license: ${q(r.specs.license)},
      isOpenWeights: ${r.specs.isOpenWeights},
      releaseDate: ${q(r.specs.releaseDate)},
      versionIdentifier: ${q(r.specs.versionIdentifier)},
      generation: ${q(r.specs.generation)},
      availability: ${q(r.specs.availability)},
      capabilities: [${r.specs.capabilities.map((c) => q(c)).join(', ')}],
      architecture: ${r.specs.architecture ? q(r.specs.architecture) : 'undefined'},
    },
    pricing: {
      inputPerMillion: ${priceLiteral(r.pricing.inputPerMillion)},
      outputPerMillion: ${priceLiteral(r.pricing.outputPerMillion)},
      unit: ${q(r.pricing.unit)},
    },
    benchmarks: {
${scoreBlocks(r.benchmarks)}
    },
    officialSourceUrl: ${q(r.officialSourceUrl)},
${r.officialDocumentationUrl ? `    officialDocumentationUrl: ${q(r.officialDocumentationUrl)},\n` : ''}    lastAuditedDate: ${q(TODAY)},
    aliases: [${r.aliases.filter(Boolean).map((a) => q(a)).join(', ')}],
  },`
    )
    .join('\n');

  return `import type { AIModelRecord, BenchmarkDefinition } from './types';

/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/fetch-models.mjs
 *
 * Sources: OpenRouter public catalogue + BenchLM published benchmark boards.
 * Window: models released on or after ${SINCE}. Snapshot: ${TODAY}.
 * Models: ${records.length}
 */

export const BENCHMARK_DEFINITIONS: Record<string, BenchmarkDefinition> = {
${defs}
};

export const AI_MODELS_DATA: AIModelRecord[] = [
${body}
];
`;
}

console.log('Fetching model catalogue...');
const models = await fetchOpenRouter();
console.log(`  OpenRouter: ${models.length} models`);

console.log('Loading published benchmark boards...');
const benchlm = await loadBenchlmScores();

console.log('Loading per-model vendor result pages...');
const slugs = models
  .filter((m) => Date.parse(new Date(m.created * 1000).toISOString()) >= Date.parse(`${SINCE}T00:00:00Z`))
  .filter((m) => !SUFFIX.test(m.id) && !m.id.startsWith('~') && !m.id.startsWith('openrouter/'))
  .map((m) => benchlmModelSlug(m.id.split('/')[1] || m.id));
const benchlmModels = await loadBenchlmModels(slugs);
console.log(`  model pages: ${Object.keys(benchlmModels).length}`);

const records = buildRecords(models, benchlm, benchlmModels);
const withScores = records.filter((r) => Object.keys(r.benchmarks).length > 0).length;
console.log(`Built ${records.length} records (${withScores} with at least one score)`);
console.log(`  current: ${records.filter((r) => r.specs.generation === 'current').length}`);
console.log(`  open weights: ${records.filter((r) => r.specs.isOpenWeights).length}`);
console.log(`  developers: ${new Set(records.map((r) => r.developer)).size}`);

fs.writeFileSync(OUT, render(records, DEFINITIONS));
console.log(`Wrote ${path.relative(ROOT, OUT)}`);
