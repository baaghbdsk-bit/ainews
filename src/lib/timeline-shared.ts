/**
 * Timeline display types and pure helpers, shared by the server (merge,
 * pagination API) and the client (rendering). Kept free of server-only
 * imports so client components can pull types and constants from it safely.
 */

export interface StoryDisplay {
  id: string;
  slug: string;
  title: string;
  summary: string;
  significance: string;
  source: string;
  sourceUrl: string;
  company?: string;
  /** Lead image for the row tile; absent → the row renders a monogram tile. */
  imageUrl?: string | null;
  topic: "Models" | "Products" | "Research" | "Policy";
  date: string;
  day: string;
  month: string;
  year: string;
  color: string;
}

export interface TimelineFacets {
  years: string[];
  months: { value: string; label: string }[];
  companies: string[];
}

export interface TimelineFilters {
  topic?: string;
  year?: string;
  month?: string;
  company?: string;
  q?: string;
}

/** How many rows ship per page — the first page is server-rendered, the rest
 *  are fetched from /api/stories as the reader scrolls or changes filters. */
export const PAGE_SIZE = 60;

/** Lowercased search haystack per story. Same fields the client used to
 *  search locally, so results match the old behaviour exactly. */
export function haystackOf(story: StoryDisplay): string {
  return `${story.title} ${story.summary} ${story.significance} ${story.source} ${story.topic} ${story.date}`.toLowerCase();
}

/** Filter the merged timeline. Pure and synchronous — the API route applies
 *  this server-side so the browser only ever holds one page of stories. */
export function filterTimelineStories(
  all: StoryDisplay[],
  filters: TimelineFilters,
): StoryDisplay[] {
  const topic = filters.topic && filters.topic !== "all" ? filters.topic : null;
  const year = filters.year && filters.year !== "all" ? filters.year : null;
  const month = filters.month && filters.month !== "all" ? filters.month : null;
  const company = filters.company && filters.company !== "all" ? filters.company : null;
  const q = (filters.q ?? "").toLowerCase().trim();

  if (!topic && !year && !month && !company && !q) return all;

  return all.filter((story) => {
    if (topic && story.topic !== topic) return false;
    if (year && story.year !== year) return false;
    if (month && story.date.slice(5, 7) !== month) return false;
    if (company && story.company !== company) return false;
    if (q && !haystackOf(story).includes(q)) return false;
    return true;
  });
}

/** Distinct years (newest first), months, and companies across the full
 *  merged set — shipped once with the first page so the filter controls
 *  never depend on which stories happen to be loaded. */
export function computeFacets(all: StoryDisplay[]): TimelineFacets {
  const years = Array.from(new Set(all.map((s) => s.year))).sort((a, b) => b.localeCompare(a));

  const monthByValue = new Map<string, string>();
  for (const story of all) {
    const value = story.date.slice(5, 7);
    if (!monthByValue.has(value)) monthByValue.set(value, story.month);
  }
  const months = Array.from(monthByValue.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const companies = Array.from(
    new Set(all.map((s) => s.company).filter((c): c is string => Boolean(c))),
  ).sort((a, b) => a.localeCompare(b));

  return { years, months, companies };
}
