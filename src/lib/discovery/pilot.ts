/**
 * Controlled Google News discovery pilot.
 *
 * This module is intentionally separate from the production RSS ingestion path.
 * It runs the existing read-only discovery prototype, groups duplicate coverage,
 * and can persist a bounded batch of candidates into news_review_candidates
 * for human review. It never publishes, never modifies stories, and is disabled
 * for writes unless explicitly enabled by environment configuration.
 */

import { createClient } from '@supabase/supabase-js';
import { hasSupabaseServiceRole, supabaseServiceRoleKey, supabaseUrl } from '../env.ts';
import type { Database, Json } from '../supabase/types.ts';
import {
  runDiscovery,
  groupDiscoveryEvents,
  defaultUtcWindow,
  DISCOVERY_QUERIES,
  normalizeTitle,
  isHeldReason,
  type DiscoveryCandidate,
  type DiscoveryResult,
  type DiscoveryQuery,
  type UtcWindow,
} from './google-news.ts';
import { canonicalizeUrl } from '../slug.ts';
function isUniqueViolation(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === '23505' || /duplicate key value/i.test(error.message ?? '');
}

function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const code = error.code ?? '';
  if (['42P01','42883','PGRST202','PGRST205'].includes(code)) return true;
  return /(relation|table|function).*(does not exist|not found)|could not find the (table|function)/i.test(error.message ?? '');
}


type SupabaseClient = ReturnType<typeof createClient<Database>>;
type ReviewInsert = Database['public']['Tables']['news_review_candidates']['Insert'];

export interface PilotCandidateSummary {
  dedupeKey: string;
  headline: string;
  publisher: string | null;
  originalUrl: string | null;
  canonicalUrl: string | null;
  googleNewsUrl: string;
  publishedAt: string | null;
  discoveredAt: string;
  discoveryStatus: 'accepted' | 'held';
  validationStatus: 'validated' | 'held' | 'unknown';
  holdReason: string | null;
  reasons: string[];
  company: string | null;
  topic: string;
  relevance: 'relevant' | 'low';
  eventGroupId: string | null;
  eventGroupSize: number;
  duplicateOfSlug: string | null;
  publisherValidation: DiscoveryCandidate['publisherValidation'];
}

export interface PilotOptions {
  dryRun?: boolean;
  limit?: number;
  maxLimit?: number;
  hours?: number;
  window?: UtcWindow;
  windowStart?: string;
  windowEnd?: string;
  queries?: DiscoveryQuery[];
  queryIds?: string[];
  validatePublishers?: boolean;
  includeHeld?: boolean;
  includeAccepted?: boolean;
  maxConcurrency?: number;
  fetchImpl?: typeof fetch;
  client?: SupabaseClient | null;
  existingQueueKeys?: string[];
  existingStories?: Array<{
    slug: string;
    source_url: string | null;
    title: string;
    event_date: string | null;
  }>;
  discoveredAt?: string;
  runId?: string;
}

export interface PilotResult {
  ok: boolean;
  runId: string;
  dryRun: boolean;
  error?: string;
  metrics: {
    runId: string;
    dryRun: boolean;
    window: UtcWindow;
    queriesTotal: number;
    queriesSucceeded: number;
    queriesFailed: number;
    rawItems: number;
    inWindow: number;
    accepted: number;
    held: number;
    rejected: number;
    duplicatesInDiscovery: number;
    selected: number;
    skippedDuplicatesQueue: number;
    skippedDuplicatesTimeline: number;
    inserted: number;
    insertErrors: number;
    companyExtractionAcceptedCoverage: number;
    decoderSucceeded: number;
    decoderAttempted: number;
  } | null;
  candidates: PilotCandidateSummary[];
  insertedIds: string[];
  skippedQueue: string[];
  skippedTimeline: { dedupeKey: string; slug: string }[];
  errors: string[];
}

export function isPilotEnabled(): boolean {
  return (
    process.env.GOOGLE_NEWS_PILOT_ENABLED === 'true' ||
    process.env.NEWS_REVIEW_PILOT_ENABLED === 'true'
  );
}

export function clampPilotLimit(value: number, max = 100): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 25;
  const cap = Math.max(1, Math.floor(Number(max) || 100));
  return Math.min(Math.max(1, Math.floor(parsed)), cap);
}

export function dedupeKeyForCandidate(candidate: DiscoveryCandidate): string {
  const canonical =
    candidate.canonicalUrl && candidate.canonicalUrl.trim()
      ? canonicalizeUrl(candidate.canonicalUrl)
      : null;
  const publisher =
    candidate.publisherUrl &&
    !candidate.publisherUrl.includes('news.google.com') &&
    candidate.publisherUrl.trim()
      ? canonicalizeUrl(candidate.publisherUrl)
      : null;
  const url = canonical || publisher;
  if (url) return 'gn:url:' + url;
  return 'gn:title:' + normalizeTitle(candidate.title) + '|' + (candidate.publishedAtUtc ?? candidate.eventDate ?? '');
}

export function validationStatusFor(candidate: DiscoveryCandidate): 'validated' | 'held' | 'unknown' {
  if (candidate.status === 'held') return 'held';
  if (candidate.publisherValidation.attempted) {
    return candidate.publisherValidation.valid ? 'validated' : 'held';
  }
  return 'unknown';
}

export function holdReasonFor(candidate: DiscoveryCandidate): string | null {
  if (candidate.status !== 'held') return null;
  return (
    candidate.rejectionReasons.find((reason) => isHeldReason(reason)) ??
    candidate.rejectionReasons[0] ??
    null
  );
}

function candidatePriority(candidate: DiscoveryCandidate): number {
  let score = 0;
  if (candidate.status === 'accepted') score += 100;
  if (candidate.relevance === 'relevant') score += 10;
  if (candidate.publisherValidation.valid) score += 5;
  if (candidate.publisherValidation.decoderSucceeded) score += 2;
  if (candidate.company) score += 1;
  return score;
}

function chooseRepresentative(members: DiscoveryCandidate[]): DiscoveryCandidate {
  return [...members].sort((left, right) => {
    const priorityDiff = candidatePriority(right) - candidatePriority(left);
    if (priorityDiff !== 0) return priorityDiff;
    const leftTime = left.publishedAtUtc ? Date.parse(left.publishedAtUtc) : 0;
    const rightTime = right.publishedAtUtc ? Date.parse(right.publishedAtUtc) : 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return left.title.localeCompare(right.title);
  })[0];
}

export function selectPilotCandidates(
  result: DiscoveryResult,
  options: {
    limit?: number;
    maxLimit?: number;
    includeHeld?: boolean;
    includeAccepted?: boolean;
    discoveredAt?: string;
  } = {},
): {
  inserts: ReviewInsert[];
  summaries: PilotCandidateSummary[];
  selectedGroups: number;
} {
  const includeHeld = options.includeHeld ?? true;
  const includeAccepted = options.includeAccepted ?? true;
  const limit = clampPilotLimit(options.limit ?? 25, options.maxLimit ?? 100);
  const discoveredAt = options.discoveredAt ?? new Date().toISOString();

  groupDiscoveryEvents(result.candidates);

  const eligible = result.candidates.filter((candidate) => {
    if (candidate.status === 'accepted') return includeAccepted;
    if (candidate.status === 'held') return includeHeld;
    return false;
  });

  const fullGroups = new Map<string, DiscoveryCandidate[]>();
  for (const candidate of result.candidates) {
    const groupId = candidate.eventGroupId ?? 'candidate:' + candidate.id;
    const members = fullGroups.get(groupId) ?? [];
    members.push(candidate);
    fullGroups.set(groupId, members);
  }

  const eligibleGroups = new Map<string, DiscoveryCandidate[]>();
  for (const candidate of eligible) {
    const groupId = candidate.eventGroupId ?? 'candidate:' + candidate.id;
    const members = eligibleGroups.get(groupId) ?? [];
    members.push(candidate);
    eligibleGroups.set(groupId, members);
  }

  const groupRows = Array.from(eligibleGroups.entries()).map(([groupId, members]) => {
    const representative = chooseRepresentative(members);
    const allMembers = fullGroups.get(groupId) ?? members;
    return {
      groupId,
      representative,
      members: allMembers,
      eligibleMembers: members,
      dedupeKey: dedupeKeyForCandidate(representative),
      priority: candidatePriority(representative),
    };
  });

  const seenKeys = new Set<string>();
  const uniqueRows = groupRows
    .sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority;
      const leftTime = left.representative.publishedAtUtc
        ? Date.parse(left.representative.publishedAtUtc)
        : 0;
      const rightTime = right.representative.publishedAtUtc
        ? Date.parse(right.representative.publishedAtUtc)
        : 0;
      return rightTime - leftTime;
    })
    .filter((row) => {
      if (seenKeys.has(row.dedupeKey)) return false;
      seenKeys.add(row.dedupeKey);
      return true;
    });

  const limitedRows = uniqueRows.slice(0, limit);

  const inserts: ReviewInsert[] = [];
  const summaries: PilotCandidateSummary[] = [];

  for (const row of limitedRows) {
    const representative = row.representative;
    const groupMembers = row.members.map((member) => ({
      id: member.id,
      queryId: member.queryId,
      queryLabel: member.queryLabel,
      source: member.source,
      title: member.title,
      googleNewsUrl: member.googleNewsUrl,
      publisherUrl: member.publisherUrl,
      canonicalUrl: member.canonicalUrl,
      publishedAtUtc: member.publishedAtUtc,
      status: member.status,
      reasons: member.rejectionReasons,
      pageQuality: member.pageQuality,
      dateConflict: member.dateConflict,
      publisherValidation: member.publisherValidation,
    }));

    const insert: ReviewInsert = {
      dedupe_key: row.dedupeKey,
      headline: representative.title,
      publisher: representative.source,
      original_url: representative.publisherUrl ?? representative.googleNewsUrl,
      canonical_url: representative.canonicalUrl,
      google_news_url: representative.googleNewsUrl,
      published_at: representative.publishedAtUtc,
      discovered_at: discoveredAt,
      hold_reason: holdReasonFor(representative),
      reasons: representative.rejectionReasons,
      validation_status: validationStatusFor(representative),
      review_status: 'pending',
      approved_for_publishing: false,
      source_evidence: {
        pilot: {
          selectedAt: discoveredAt,
          eventGroupId: row.groupId,
          eventGroupSize: row.members.length,
        },
        discovery: {
          candidateId: representative.id,
          queryId: representative.queryId,
          queryLabel: representative.queryLabel,
          query: representative.query,
          status: representative.status,
          reviewDisposition: representative.reviewDisposition,
          relevance: representative.relevance,
          company: representative.company,
          topic: representative.topic,
          combinedDigest: representative.combinedDigest,
          pageQuality: representative.pageQuality,
          dateConflict: representative.dateConflict,
          publisherUrlSource: representative.publisherUrlSource,
        },
        publisherValidation: representative.publisherValidation,
        eventGroup: {
          id: row.groupId,
          size: row.members.length,
          candidateIds: row.members.map((member) => member.id),
          members: groupMembers,
        },
      } as unknown as Json,
    };

    inserts.push(insert);
    summaries.push({
      dedupeKey: row.dedupeKey,
      headline: representative.title,
      publisher: representative.source,
      originalUrl: representative.publisherUrl ?? representative.googleNewsUrl,
      canonicalUrl: representative.canonicalUrl,
      googleNewsUrl: representative.googleNewsUrl,
      publishedAt: representative.publishedAtUtc,
      discoveredAt,
      discoveryStatus: representative.status as 'accepted' | 'held',
      validationStatus: validationStatusFor(representative),
      holdReason: holdReasonFor(representative),
      reasons: representative.rejectionReasons,
      company: representative.company,
      topic: representative.topic,
      relevance: representative.relevance,
      eventGroupId: row.groupId,
      eventGroupSize: row.members.length,
      duplicateOfSlug: null,
      publisherValidation: representative.publisherValidation,
    });
  }

  return {
    inserts,
    summaries,
    selectedGroups: limitedRows.length,
  };
}

function getClient(): SupabaseClient | null {
  if (!hasSupabaseServiceRole()) return null;
  try {
    return createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
}

async function fetchExistingQueueKeys(client: SupabaseClient): Promise<string[]> {
  try {
    const { data, error } = await client
      .from('news_review_candidates')
      .select('dedupe_key');
    if (error) {
      if (isMissingSchemaError(error)) return [];
      console.error('[google-news-pilot] Failed to read existing review queue keys:', error.message);
      return [];
    }
    return (data ?? []).map((row) => row.dedupe_key);
  } catch (error) {
    console.error('[google-news-pilot] Failed to read existing review queue keys:', error);
    return [];
  }
}

async function fetchExistingStories(
  client: SupabaseClient,
): Promise<Array<{ slug: string; source_url: string | null; title: string; event_date: string | null }>> {
  try {
    const { data, error } = await client
      .from('stories')
      .select('slug, source_url, title, event_date');
    if (error) {
      console.error('[google-news-pilot] Failed to read existing stories:', error.message);
      return [];
    }
    return (data ?? []) as Array<{
      slug: string;
      source_url: string | null;
      title: string;
      event_date: string | null;
    }>;
  } catch (error) {
    console.error('[google-news-pilot] Failed to read existing stories:', error);
    return [];
  }
}

function findTimelineDuplicateSlug(
  insert: ReviewInsert,
  stories: Array<{ slug: string; source_url: string | null; title: string; event_date: string | null }>,
): string | null {
  const canonical = insert.canonical_url ? canonicalizeUrl(insert.canonical_url) : null;
  const original = insert.original_url ? canonicalizeUrl(insert.original_url) : null;
  const titleDate = normalizeTitle(insert.headline) + '|' + (insert.published_at ?? '').slice(0, 10);

  for (const story of stories) {
    if (story.source_url) {
      const storyUrl = canonicalizeUrl(story.source_url);
      if (canonical && storyUrl === canonical) return story.slug;
      if (original && storyUrl === original) return story.slug;
    }
    const storyTitleDate = normalizeTitle(story.title) + '|' + (story.event_date ?? '').slice(0, 10);
    if (titleDate === storyTitleDate) return story.slug;
  }
  return null;
}

export async function runDiscoveryPilot(options: PilotOptions = {}): Promise<PilotResult> {
  const runId = options.runId ?? crypto.randomUUID();
  const dryRun = options.dryRun ?? true;
  const maxLimit = options.maxLimit ?? 100;
  const limit = clampPilotLimit(options.limit ?? 25, maxLimit);
  const hours = options.hours ?? 24;

  let window: UtcWindow;
  if (options.window) {
    window = options.window;
  } else if (options.windowStart && options.windowEnd) {
    window = {
      start: new Date(options.windowStart).toISOString(),
      end: new Date(options.windowEnd).toISOString(),
    };
  } else {
    window = defaultUtcWindow(hours);
  }

  const queryIds = options.queryIds ?? [];
  const queries =
    options.queries ??
    (queryIds.length
      ? DISCOVERY_QUERIES.filter((query) => queryIds.includes(query.id))
      : DISCOVERY_QUERIES);
  const safeQueries = queries.length ? queries : DISCOVERY_QUERIES;

  const discoveredAt = options.discoveredAt ?? new Date().toISOString();

  if (!dryRun && !isPilotEnabled()) {
    const message =
      'Google News pilot writes are disabled. Set GOOGLE_NEWS_PILOT_ENABLED=true to allow writes.';
    console.error('[google-news-pilot] ' + message);
    return {
      ok: false,
      runId,
      dryRun,
      error: message,
      metrics: null,
      candidates: [],
      insertedIds: [],
      skippedQueue: [],
      skippedTimeline: [],
      errors: [message],
    };
  }

  let result: DiscoveryResult;
  try {
    result = await runDiscovery({
      queries: safeQueries,
      window,
      fetchImpl: options.fetchImpl,
      maxConcurrency: options.maxConcurrency ?? 4,
      validatePublishers: options.validatePublishers ?? true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discovery failed';
    console.error('[google-news-pilot] run=' + runId + ' discovery failed: ' + message);
    return {
      ok: false,
      runId,
      dryRun,
      error: message,
      metrics: null,
      candidates: [],
      insertedIds: [],
      skippedQueue: [],
      skippedTimeline: [],
      errors: [message],
    };
  }
  const selection = selectPilotCandidates(result, {
    limit,
    maxLimit,
    includeHeld: options.includeHeld ?? true,
    includeAccepted: options.includeAccepted ?? true,
    discoveredAt,
  });

  const client =
    options.client !== undefined
      ? options.client
      : getClient();

  const queueKeys =
    options.existingQueueKeys ??
    (client ? await fetchExistingQueueKeys(client) : []);
  const existingStories =
    options.existingStories ??
    (client ? await fetchExistingStories(client) : []);

  const queueKeySet = new Set(queueKeys);
  const skippedQueue: string[] = [];
  const skippedTimeline: { dedupeKey: string; slug: string }[] = [];
  const toInsert: ReviewInsert[] = [];

  for (const insert of selection.inserts) {
    if (queueKeySet.has(insert.dedupe_key as string)) {
      skippedQueue.push(insert.dedupe_key as string);
      continue;
    }
    const slug = findTimelineDuplicateSlug(insert, existingStories);
    if (slug) {
      skippedTimeline.push({ dedupeKey: insert.dedupe_key as string, slug });
      continue;
    }
    toInsert.push(insert);
  }

  const summaries = selection.summaries.map((summary) => {
    const skipped = skippedTimeline.find((item) => item.dedupeKey === summary.dedupeKey);
    return {
      ...summary,
      duplicateOfSlug: skipped ? skipped.slug : null,
    };
  });

  const insertedIds: string[] = [];
  const insertErrors: string[] = [];

  if (!dryRun && client) {
    for (const insert of toInsert) {
      try {
        const { data, error } = await client
          .from('news_review_candidates')
          .insert(insert)
          .select('id')
          .single();
        if (error) {
          if (isUniqueViolation(error)) {
            skippedQueue.push(insert.dedupe_key as string);
          } else {
            const message = error.message || 'Insert failed';
            insertErrors.push(message);
            console.error('[google-news-pilot] Insert failed:', message);
          }
          continue;
        }
        if (data?.id) insertedIds.push(data.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Insert failed';
        insertErrors.push(message);
        console.error('[google-news-pilot] Insert failed:', message);
      }
    }
  } else if (!dryRun && !client) {
    const message = 'SUPABASE_SERVICE_ROLE_KEY is not configured.';
    insertErrors.push(message);
    console.error('[google-news-pilot] ' + message);
  }

  const metrics: PilotResult['metrics'] = {
    runId,
    dryRun,
    window,
    queriesTotal: result.metrics.queries.total,
    queriesSucceeded: result.metrics.queries.succeeded,
    queriesFailed: result.metrics.queries.failed,
    rawItems: result.metrics.rawItems,
    inWindow: result.metrics.inWindow,
    accepted: result.metrics.acceptedCandidates,
    held: result.metrics.heldCandidates,
    rejected: result.candidates.filter((candidate) => candidate.status === 'rejected').length,
    duplicatesInDiscovery: result.metrics.duplicates,
    selected: selection.inserts.length,
    skippedDuplicatesQueue: skippedQueue.length,
    skippedDuplicatesTimeline: skippedTimeline.length,
    inserted: insertedIds.length,
    insertErrors: insertErrors.length,
    companyExtractionAcceptedCoverage: result.metrics.companyExtraction.acceptedCoverage,
    decoderSucceeded: result.metrics.decoder.succeeded,
    decoderAttempted: result.metrics.decoder.attempted,
  };

  const logMessage =
    '[google-news-pilot] run=' +
    runId +
    ' dryRun=' +
    dryRun +
    ' discovered=' +
    result.candidates.length +
    ' accepted=' +
    result.metrics.acceptedCandidates +
    ' held=' +
    result.metrics.heldCandidates +
    ' selected=' +
    selection.inserts.length +
    ' inserted=' +
    insertedIds.length +
    ' skippedQueue=' +
    skippedQueue.length +
    ' skippedTimeline=' +
    skippedTimeline.length;
  console.info(logMessage);

  return {
    ok: insertErrors.length === 0,
    runId,
    dryRun,
    metrics,
    candidates: summaries,
    insertedIds,
    skippedQueue,
    skippedTimeline,
    errors: insertErrors,
  };
}
