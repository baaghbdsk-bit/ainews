/**
 * Shared URL helpers.
 *
 * Slug generation was duplicated in three places (seed conversion, static
 * params, detail-page lookup) and diverged from the feed slugger, which broke
 * lookups for titles containing punctuation. Everything now funnels through
 * `slugify` so a slug produced anywhere resolves everywhere.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Query params that only identify a campaign/referrer. Two feed entries that
 * differ solely by these are the same article, so dedupe collapses them.
 * Kept deliberately conservative — ambiguous params (`ref`, `source`) are
 * preserved so genuinely distinct URLs are never merged.
 */
const TRACKING_PARAM_PATTERNS = [
  /^utm_/i,
  /^ga_/i,
  /^mc_(cid|eid)$/i,
  /^(fbclid|gclid|dclid|msclkid|yclid|igshid|twclid)$/i,
];

function isTrackingParam(name: string): boolean {
  return TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Normalize a URL into a stable de-duplication key: drop the fragment and
 * tracking params, sort the remaining query params, lowercase the host, and
 * strip a trailing slash. Returns the input unchanged if it is not a valid URL.
 */
export function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const name of [...url.searchParams.keys()]) {
      if (isTrackingParam(name)) url.searchParams.delete(name);
    }
    url.searchParams.sort();
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}
