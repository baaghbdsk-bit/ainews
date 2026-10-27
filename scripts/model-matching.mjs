/**
 * Safe Model Matching and Normalization System
 *
 * Implements safe, multi-tiered model matching for benchmark ingestion:
 * Tier 1: Exact source-specific model ID or known canonical ID match
 * Tier 2: Explicitly verified alias match (via KNOWN_ALIASES)
 * Tier 3: Normalized exact-name match with identity safety validation
 * Tier 4: Rejection and logging of ambiguous or incompatible candidates
 *
 * Enforces safety:
 * - Never merges models with different parameter sizes (e.g. 27B vs 72B)
 * - Never merges models with different version numbers (e.g. v1 vs v2, 3.5 vs 3.6)
 * - Never merges models with different quantizations (e.g. FP8 vs NVFP4)
 * - Never merges models with conflicting variants (e.g. Pro vs base, Flash-Next vs Flash, Image vs Text)
 * - Never uses generic substring fallback to attach unverified scores
 */

export const KNOWN_ALIASES = {
  // Moonshot AI / Kimi verified equivalent names
  'moonshotai/kimi-k3.1-pro': [
    'kimi-3-1-pro',
    'kimi-k3-1-pro',
    'kimi-k3.1-pro',
    'kimi-3.1-pro',
    'Kimi K3.1 Pro',
    'kimi k3.1 pro',
    '13kimipro',
    '1k3kimipro',
  ],
  'moonshotai/kimi-k3': [
    'kimi-k3',
    'kimi-3',
    'Kimi K3',
    'Kimi K3 (Max)',
    'k3kimi',
  ],
  'moonshotai/kimi-k2.7-code': [
    'kimi-k2-7-code',
    'kimi-2-7-code',
    'kimi-k2.7-code',
    'kimi-2.7-code',
    'Kimi K2.7 Code',
    '7codek2kimi',
  ],
  'moonshotai/kimi-k2.6': [
    'kimi-2-6',
    'kimi-k2-6',
    'kimi-k2.6',
    'kimi-2.6',
    'Kimi K2.6',
    '26kimi',
  ],
  'moonshotai/kimi-k2.5': [
    'kimi-k2-5',
    'kimi-2-5',
    'kimi-k2.5',
    'kimi-2.5',
    'Kimi K2.5',
    '5k2kimi',
  ],

  // Sakana AI verified equivalent names
  'sakana/fugu-ultra': [
    'sakana-fugu-ultra',
    'fugu-ultra',
    'Sakana Fugu-Ultra',
    'Sakana AI: Fugu Ultra',
    'Fugu Ultra',
    'fugusakanaultra',
    'fuguultra',
  ],
  'sakana/fugu-ultra-v2': [
    'sakana-fugu-ultra-v2',
    'fugu-ultra-v2',
    'Sakana Fugu-Ultra v2',
  ],

  // Anthropic verified equivalent names
  'anthropic/claude-fable-5': [
    'claude-fable',
    'claude-fable-5',
    'Claude Fable 5',
    'Claude Fable',
    'claudefable',
  ],
  'anthropic/claude-fable-5.1': [
    'claude-fable-5-1',
    'claude-fable-5.1',
    'Claude Fable 5.1',
  ],
  'anthropic/claude-opus-5.5': [
    'claude-opus-5-5',
    'claude-opus-5.5',
    'Claude Opus 5.5',
  ],
  'anthropic/claude-sonnet-5.5': [
    'claude-sonnet-5-5',
    'claude-sonnet-5.5',
    'Claude Sonnet 5.5',
  ],
  'anthropic/claude-opus-5': [
    'claude-opus-5',
    'Claude Opus 5',
  ],
  'anthropic/claude-sonnet-5': [
    'claude-sonnet-5',
    'Claude Sonnet 5',
  ],
  'anthropic/claude-haiku-5.5': [
    'claude-haiku-5-5',
    'claude-haiku-5.5',
    'Claude Haiku 5.5',
  ],
  'anthropic/claude-opus-4.8': [
    'claude-opus-4-8',
    'claude-opus-4.8',
    'Claude Opus 4.8',
  ],
  'anthropic/claude-mythos-5': [
    'claude-mythos-5',
    'Claude Mythos 5',
  ],

  // Google DeepMind verified equivalent names
  'google/gemini-4-argon': [
    'gemini-4-argon',
    'Gemini 4 Argon',
  ],
  'google/gemini-3.8-flash': [
    'gemini-3-8-flash',
    'gemini-3.8-flash',
    'Gemini 3.8 Flash',
  ],
  'google/gemini-3.7-flash': [
    'gemini-3-7-flash',
    'gemini-3.7-flash',
    'Gemini 3.7 Flash',
  ],
  'google/gemini-3.6-flash': [
    'gemini-3-6-flash',
    'gemini-3.6-flash',
    'Gemini 3.6 Flash',
  ],
  'google/gemini-3.5-flash': [
    'gemini-3-5-flash',
    'gemini-3.5-flash',
    'Gemini 3.5 Flash',
  ],
  'google/gemini-3.5-flash-lite': [
    'gemini-3-5-flash-lite',
    'gemini-3.5-flash-lite',
    'Gemini 3.5 Flash Lite',
    'Gemini 3.5 Flash-Lite',
  ],

  // OpenAI verified equivalent names
  'openai/gpt-6.1-sol': [
    'gpt-6-1-sol',
    'gpt-6.1-sol',
    'GPT-6.1 Sol',
  ],
  'openai/gpt-6.1-terra': [
    'gpt-6-1-terra',
    'gpt-6.1-terra',
    'GPT-6.1 Terra',
  ],
  'openai/gpt-6-sol': [
    'gpt-6-sol',
    'GPT-6 Sol',
  ],
  'openai/gpt-6-luna': [
    'gpt-6-luna',
    'GPT-6 Luna',
  ],
  'openai/gpt-6-astra': [
    'gpt-6-astra',
    'GPT-6 Astra',
  ],
  'openai/gpt-5.6-sol': [
    'gpt-5-6-sol',
    'gpt-5.6-sol',
    'GPT-5.6 Sol',
  ],
  'openai/gpt-5.6-terra': [
    'gpt-5-6-terra',
    'gpt-5.6-terra',
    'GPT-5.6 Terra',
  ],
  'openai/gpt-5.6-luna': [
    'gpt-5-6-luna',
    'gpt-5.6-luna',
    'GPT-5.6 Luna',
  ],

  // DeepSeek verified equivalent names
  'deepseek/deepseek-v4-flash': [
    'deepseek-v4-flash',
    'deepseek-v4-flash-0731',
    'DeepSeek V4 Flash 0731',
    'DeepSeek V4 Flash',
  ],
  'deepseek/deepseek-v4-pro': [
    'deepseek-v4-pro',
    'deepseek-v4-pro-0813',
    'DeepSeek V4 Pro 0813',
    'DeepSeek V4 Pro',
  ],

  // Reflection AI verified equivalent names
  'reflection/reflection-beam': [
    'reflection-beam',
    'beam-1-0',
    'Reflection Beam',
  ],
};

// Build fast reverse lookup map
export const ALIAS_TO_CANONICAL = new Map();
for (const [canonId, aliases] of Object.entries(KNOWN_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL.set(alias.toLowerCase().trim(), canonId);
  }
}

/** Strip parenthesized effort annotations like (High), (Max), (XHigh), (Thinking 16K), (Adaptive), (Refine) */
export function stripEffortAnnotation(str) {
  return String(str || '')
    .replace(/\s*\([^)]*\b(high|xhigh|max|medium|low|none|minimal|unknown|thinking|non-?thinking|reasoning|preview|experimental|adaptive|refine)\b[^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*\b(high|xhigh|max|medium|low|none|minimal|unknown|thinking|non-?thinking|reasoning|preview|experimental|adaptive|refine)\b[^\]]*\]/gi, '');
}

/** Normalize version number formatting: collapses 'k' prefix in Kimi versions and hyphens in decimal numbers */
export function normalizeVersionString(str) {
  let s = String(str || '').toLowerCase();
  s = s.replace(/\bk(?=\d)/gi, '');
  s = s.replace(/(\b\d+)[-_](\d+\b)/g, '$1.$2');
  return s;
}

/**
 * Normalizes model names for exact token matching.
 * Preserves parameter sizes (e.g. 27B) and variants (Pro, Flash, Max).
 */
export function normalizeModelName(input) {
  let s = String(input || '').toLowerCase().trim();
  s = s.replace(/^https?:\/\/\S+$/, '');
  s = s.replace(/\d{4}-\d{2}-\d{2}/g, '');
  s = s.replace(/\d{8}/g, '');
  s = s.replace(/\b\d+k\b/gi, '');
  s = stripEffortAnnotation(s);
  s = s.replace(/\b(with fallback|tools|semi-private|scaffold|system)\b/gi, '');

  // Normalize Kimi version prefix (kimi-k3.1 -> kimi 3.1)
  s = s.replace(/\bkimi[-_\s]*k(?=\d)/g, 'kimi ');

  // Normalize version hyphens: e.g. 3-1 -> 3.1, 5-5 -> 5.5, 2-6 -> 2.6
  s = s.replace(/(?<=\b[a-z]+[-_\s]+\d+)[-_](\d+)/g, '.$1');

  // Replace punctuation/hyphens with single space
  s = s.replace(/[^a-z0-9.]+/g, ' ').trim();
  return s;
}

/** Key for sorted-token matching */
export function normKey(input) {
  const norm = normalizeModelName(input);
  return norm.split(/\s+/).filter(Boolean).sort().join('');
}

export function extractParams(str) {
  const match = String(str || '').toLowerCase().match(/\b(\d+b(?:-a\d+b)?)\b/);
  return match ? match[1] : null;
}

export function extractVersion(str) {
  const s = normalizeVersionString(str);
  const match = s.match(/\bv?(\d+(?:\.\d+)?)\b/) || s.match(/\b(\d+\.\d+)\b/);
  return match ? match[1] : null;
}

export function extractQuant(str) {
  const match = String(str || '').toLowerCase().match(/\b(fp8|nvfp4|int4|int8|awq|gptq)\b/);
  return match ? match[1] : null;
}

export function extractVariants(str) {
  const s = stripEffortAnnotation(str).toLowerCase();
  const variants = ['pro', 'max', 'flash', 'mini', 'nano', 'lite', 'plus', 'ultra', 'turbo', 'prime', 'next', 'image', 'code'];
  const found = new Set();
  for (const v of variants) {
    if (new RegExp(`\\b${v}\\b|[-_]${v}\\b|\\b${v}[-_]`).test(s)) {
      found.add(v);
    }
  }
  return found;
}

/**
 * Strict identity safety checks to prevent incorrect model merges.
 * Returns { ok: true } if equivalent, or { ok: false, reason } with rejection detail.
 */
export function passesIdentitySafetyCheck(candStr, targetStr) {
  // 1. Parameter size check: prevents merging 27B with 72B or with unspecified/flagship models
  const pCand = extractParams(candStr);
  const pTarget = extractParams(targetStr);
  if (pCand && pTarget && pCand !== pTarget) {
    return { ok: false, reason: `Parameter size mismatch: ${pCand} vs ${pTarget}` };
  }
  if ((pCand && !pTarget) || (!pCand && pTarget)) {
    return { ok: false, reason: `Parameter presence mismatch: ${pCand || 'none'} vs ${pTarget || 'none'}` };
  }

  // 2. Version check: prevents merging v1 with v2, or 3.5 with 3.6
  const vCand = extractVersion(candStr);
  const vTarget = extractVersion(targetStr);
  if (vCand && vTarget && vCand !== vTarget) {
    return { ok: false, reason: `Version mismatch: ${vCand} vs ${vTarget}` };
  }
  if ((vCand && !vTarget) || (!vCand && vTarget)) {
    return { ok: false, reason: `Version presence mismatch: ${vCand || 'none'} vs ${vTarget || 'none'}` };
  }

  // 3. Quantization check: prevents merging FP8 with NVFP4
  const qCand = extractQuant(candStr);
  const qTarget = extractQuant(targetStr);
  if (qCand && qTarget && qCand !== qTarget) {
    return { ok: false, reason: `Quantization mismatch: ${qCand} vs ${qTarget}` };
  }

  // 4. Variant/modality check: prevents merging Pro vs non-Pro, Flash-Next vs Flash, Image vs Text
  const varCand = extractVariants(candStr);
  const varTarget = extractVariants(targetStr);
  for (const v of varCand) {
    if (!varTarget.has(v)) {
      return { ok: false, reason: `Variant conflict: candidate has "${v}" which target lacks` };
    }
  }
  for (const v of varTarget) {
    if (!varCand.has(v)) {
      return { ok: false, reason: `Variant conflict: target has "${v}" which candidate lacks` };
    }
  }

  return { ok: true };
}

/**
 * Looks up a model in a benchmark board map using multi-tier safe matching.
 * Logs ambiguous and rejected candidates to the provided audit collector.
 */
export function lookupBenchSafe(benchMap, model, candidates, benchId, auditLog = { ambiguous: [], rejected: [] }) {
  if (!benchMap) return null;
  const rows = benchMap instanceof Map ? [...benchMap.values()] : Object.values(benchMap);

  // Tier 1: Exact ID match (source-specific slug or canonical model ID)
  for (const row of rows) {
    const rSlug = (row.slug || '').toLowerCase();
    const rModel = (row.model || '').toLowerCase();
    for (const cand of candidates) {
      const c = cand.toLowerCase();
      if ((rSlug && rSlug === c) || rModel === c) {
        return row;
      }
    }
  }

  // Tier 2: Explicitly verified alias match
  for (const row of rows) {
    const rSlug = (row.slug || '').toLowerCase().trim();
    const rModel = (row.model || '').toLowerCase().trim();
    const canonSlug = ALIAS_TO_CANONICAL.get(rSlug);
    const canonModel = ALIAS_TO_CANONICAL.get(rModel);
    if ((canonSlug && canonSlug === model.id) || (canonModel && canonModel === model.id)) {
      return row;
    }
  }

  // Tier 3: Normalized exact-name match with strict identity validation
  const candNorms = candidates.map(normKey).filter(Boolean);
  const matchingCandidates = [];
  const rejectedCandidates = [];

  for (const row of rows) {
    const rKey = normKey(row.slug || row.model);
    if (!rKey) continue;
    if (candNorms.includes(rKey)) {
      const safety = passesIdentitySafetyCheck(row.slug || row.model, model.id.split('/')[1] || model.id);
      if (safety.ok) {
        matchingCandidates.push(row);
      } else {
        rejectedCandidates.push({ row, reason: safety.reason });
      }
    }
  }

  // Tier 4: Disambiguation and safe assignment
  if (matchingCandidates.length === 1) {
    return matchingCandidates[0];
  } else if (matchingCandidates.length > 1) {
    auditLog.ambiguous.push({
      modelId: model.id,
      benchId,
      candidates: matchingCandidates.map((c) => `${c.model} (slug: ${c.slug})`),
      reason: 'Multiple valid candidate matches on board (ambiguous)',
    });
    return null;
  }

  // Log rejected candidates with reason for audit transparency
  if (rejectedCandidates.length > 0) {
    for (const rej of rejectedCandidates) {
      auditLog.rejected.push({
        modelId: model.id,
        benchId,
        candidate: `${rej.row.model} (slug: ${rej.row.slug})`,
        reason: rej.reason,
      });
    }
  }

  return null;
}

