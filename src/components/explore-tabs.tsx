'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { TimelineStoryDisplay } from '@/lib/timeline';
import { ThemeToggle } from '@/components/theme-toggle';
import { AccountButton } from '@/components/auth/account-button';
import { BookmarkButton, ShareButton, UpvoteButton } from '@/components/story-actions';
import { useBookmarks } from '@/components/story-actions/bookmark-button';
import { AboutMainView } from '@/components/views-about';
import { FeedbackConnectMainView } from '@/components/feedback-connect-view';
import { ModelBenchmarksComparator } from '@/components/model-benchmarks-comparator';
import { selectDigestHighlights } from '@/lib/digest-priority';
import { deduplicateStories } from '@/lib/story-dedup';
import { NeubenchSpinner } from '@/components/loading';
import {
  cleanTitleEditorial,
  detectRealEntityEditorial,
  generateFiveToEightLineOverviewEditorial,
  generateTriadOverviewEditorial,
  generateFiveSecondDayOverview,
  generateFiveSecondDayPoints,
  extractImpactChips,
} from '@/lib/editorial-overview';
import {
  Home,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Zap,
  Search,
  X,
  Layers,
  ArrowRight,
  TrendingUp,
  Bookmark,
  Loader2,
} from 'lucide-react';

const MONTHS = [
  { name: 'Jan', fullName: 'January' },
  { name: 'Feb', fullName: 'February' },
  { name: 'Mar', fullName: 'March' },
  { name: 'Apr', fullName: 'April' },
  { name: 'May', fullName: 'May' },
  { name: 'Jun', fullName: 'June' },
  { name: 'Jul', fullName: 'July' },
  { name: 'Aug', fullName: 'August' },
  { name: 'Sep', fullName: 'September' },
  { name: 'Oct', fullName: 'October' },
  { name: 'Nov', fullName: 'November' },
  { name: 'Dec', fullName: 'December' },
];

/* ==========================================================================
   Title & Text Sanitizers (Zero Publisher Pollution)
   ========================================================================== */

/**
 * Strips publisher suffixes, domain names, URLs, bracketed years, and noise.
 * Example:
 * "OpenAI launches GPT-6 Cyber as its models help find 81 Firefox flaws - news.lavx.hu"
 * -> "OpenAI launches GPT-6 Cyber as its models help find 81 Firefox flaws"
 */
export function cleanTitleOnly(rawTitle: string): string {
  if (!rawTitle) return '';
  let title = rawTitle.trim();

  // Strip URLs
  title = title.replace(/https?:\/\/\S+/gi, '');

  // Strip bracketed year e.g. [2026]
  title = title.replace(/\s*\[\d{4}\]/g, '');

  // Strip trailing publisher after " - ", " – ", " — ", or " | "
  title = title.replace(/\s*[-–—|]\s*([A-Za-z0-9-]+\.[a-z]{2,}(?:\/\S*)?|[A-Za-z0-9\s&.',’()]+)$/i, (match, p1) => {
    const trimmed = p1.trim();
    if (
      /\.[a-z]{2,}/i.test(trimmed) ||
      trimmed.length <= 36 ||
      /news|times|post|herald|journal|tribune|wire|daily|insider|tech|bloomberg|reuters|verge|crunch|forbes|cnbc|wired|gizmodo|zdnet|ars|finance|global|unite|buzz|seeking alpha|stocktwits|aol|rappler|gasgoo|fello ai|oncodaily|invenglobal/i.test(trimmed)
    ) {
      return '';
    }
    return match;
  });

  // Strip trailing domain or publisher without hyphen (e.g. "exploits news.lavx.hu" -> "exploits")
  title = title.replace(/\s+([a-zA-Z0-9-]+\.(?:com|org|net|hu|ai|io|co|in|tech|app|news|info|me|biz|cc|de|fr|uk))\b/gi, '');
  title = title.replace(/\s+(Unite\.Ai|Fello AI|Tech-Insider\.org|Gasgoo|Oncodaily|BigGo Finance)$/gi, '');

  // Strip leading and trailing dashes, colons, or dots
  title = title.replace(/^[\s\-–—:.]+|[\s\-–—:.]+$/g, '').trim();

  // Clean double spaces
  title = title.replace(/\s{2,}/g, ' ');

  return title;
}

export const cleanStoryTitle = cleanTitleOnly;

/**
 * Clean executive summary without repeated publisher phrases or trailing domains
 */
export function cleanSummaryText(text?: string | null): string {
  if (!text) return '';
  let summary = text
    .replace(/(?:Reported|Covered)\s+by\s+(?:Google\s+News|Reuters|TechCrunch|Bloomberg|AP|arXiv|Gasgoo|Rappler|Fello AI)[^.\n]*?(?:on\s+[A-Za-z]+\s+\d+,\s+\d+)?\.?/gi, '')
    .replace(/Google\s+News\s*—\s*AI\s+tag-filtered\s*\([^)]*\)/gi, '')
    .replace(/AI\s+tag-filtered\s*\([^)]*\)/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s*\[\d{4}\]/g, '');

  // Strip trailing publisher after " - ", " – ", " — ", or " | "
  summary = summary.replace(/\s*[-–—|]\s*([A-Za-z0-9-]+\.[a-z]{2,}(?:\/\S*)?|[A-Za-z0-9\s&.',’()]+)$/i, (match, p1) => {
    const trimmed = p1.trim();
    if (
      /\.[a-z]{2,}/i.test(trimmed) ||
      trimmed.length <= 36 ||
      /news|times|post|herald|journal|tribune|wire|daily|insider|tech|bloomberg|reuters|verge|crunch|forbes|cnbc|wired|gizmodo|zdnet|ars|finance|global|unite|buzz|seeking alpha|stocktwits|aol|rappler|gasgoo|fello ai|oncodaily|invenglobal/i.test(trimmed)
    ) {
      return '';
    }
    return match;
  });

  // Strip trailing domain or publisher without hyphen
  summary = summary.replace(/\s+([a-zA-Z0-9-]+\.(?:com|org|net|hu|ai|io|co|in|tech|app|news|info|me|biz|cc|de|fr|uk))\b/gi, '');
  summary = summary.replace(/\s+(Unite\.Ai|Fello AI|Tech-Insider\.org|Gasgoo|Oncodaily|BigGo Finance)$/gi, '');

  summary = summary.replace(/^[\s\-–—:.]+|[\s\-–—:.]+$/g, '').trim();
  summary = summary.replace(/\s{2,}/g, ' ');

  return summary;
}

export function detectRealEntity(title: string, fallbackCompany?: string): string {
  return detectRealEntityEditorial(title, fallbackCompany);
}

export function isUnwantedJunkStory(title: string, summary?: string): boolean {
  const t = `${title || ''} ${summary || ''}`.toLowerCase();
  if (t.includes('hacking fears') || t.includes('limited cybersecurity data')) return true;
  if (t.includes('trained with limited cybersecurity') || t.includes('cybersecurity data amid hacking')) return true;
  return false;
}

export function cleanExecutiveText(text: string, title?: string): string {
  if (!text) return '';
  let cleaned = text
    .replace(/(?:Reported|Covered)\s+by\s+(?:Google\s+News|Reuters|TechCrunch|Bloomberg|AP|arXiv|Gasgoo|Rappler|Fello AI)[^.\n]*?(?:on\s+[A-Za-z]+\s+\d+,\s+\d+)?\.?/gi, '')
    .replace(/Google\s+News\s*—\s*AI\s+tag-filtered\s*\([^)]*\)/gi, '')
    .replace(/AI\s+tag-filtered\s*\([^)]*\)/gi, '')
    .replace(/Google\s+News\s*—\s*[A-Za-z0-9\s_-]+/gi, '')
    .replace(/\b(Rappler|Gasgoo|Fello AI|Stocktwits|Building Indiana Business|Tom's Hardware|Cybersecurity Insiders|Interesting Engineering)\b/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\[2026\]/gi, '')
    .replace(/on\s+[A-Za-z]+\s+\d+,\s+\d+\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (title) {
    const cleanT = cleanTitleOnly(title).trim().toLowerCase();
    if (cleaned.toLowerCase().startsWith(cleanT)) {
      cleaned = cleaned.slice(cleanT.length).replace(/^[\s:–—.-]+/, '').trim();
    }
  }

  return cleaned;
}

export function getTopicSlug(topic?: string): string {
  if (!topic) return 'products';
  const t = topic.toLowerCase();
  if (t.includes('model')) return 'models';
  if (t.includes('product')) return 'products';
  if (t.includes('research') || t.includes('paper') || t.includes('science')) return 'research';
  if (t.includes('business') || t.includes('finance') || t.includes('funding')) return 'business';
  if (t.includes('policy') || t.includes('law') || t.includes('gov') || t.includes('regulat')) return 'policy';
  if (t.includes('dev') || t.includes('tool') || t.includes('infra') || t.includes('code')) return 'devtools';
  if (t.includes('benchmark')) return 'benchmarks';
  if (t.includes('open')) return 'opensource';
  return 'general';
}

export function getEntitySlug(entity?: string): string {
  if (!entity) return 'other';
  const e = entity.toLowerCase();
  if (e.includes('openai')) return 'openai';
  if (e.includes('google') || e.includes('deepmind')) return 'google';
  if (e.includes('anthropic') || e.includes('claude')) return 'anthropic';
  if (e.includes('meta') || e.includes('facebook') || e.includes('llama')) return 'meta';
  if (e.includes('microsoft') || e.includes('azure')) return 'microsoft';
  if (e.includes('nvidia')) return 'nvidia';
  if (e.includes('apple')) return 'apple';
  if (e.includes('xai') || e.includes('grok') || e.includes('musk')) return 'xai';
  if (e.includes('deepseek')) return 'deepseek';
  if (e.includes('mistral')) return 'mistral';
  if (e.includes('amazon') || e.includes('aws')) return 'amazon';
  if (e.includes('hugging')) return 'huggingface';
  if (e.includes('perplexity')) return 'perplexity';
  if (e.includes('alibaba') || e.includes('qwen')) return 'alibaba';
  if (e.includes('cohere')) return 'cohere';
  return 'other';
}

export function generateCleanOverview(s: TimelineStoryDisplay): string {
  return generateFiveToEightLineOverviewEditorial(s);
}

/**
 * Generates an in-depth, structured 5 to 8 line executive overview for the Top 10 highlights,
 * explaining what happened, technical mechanics, strategic importance, and forward outlook.
 */
export function generateFiveToEightLineOverview(story: TimelineStoryDisplay): string {
  return generateFiveToEightLineOverviewEditorial(story);
}

/**
 * Notability scoring engine for the daily highlights
 */
export function scoreStoryNotability(s: TimelineStoryDisplay): number {
  let score = 5;
  const title = (s.title || '').toLowerCase();
  const company = (s.company || '').toLowerCase();

  // 1. Tier-1 Leading AI Lab bonus
  const tier1Labs = ['openai', 'google', 'deepmind', 'anthropic', 'meta', 'nvidia', 'microsoft', 'deepseek', 'mistral', 'apple'];
  if (tier1Labs.some((lab) => company.includes(lab) || title.includes(lab))) {
    score += 14;
  }

  // 2. High-impact milestone keywords
  const milestoneWords = [
    'unveil', 'release', 'launch', 'announce', 'breakthrough', 'zero-day',
    'vulnerability', 'valuation', 'funding', 'billion', 'trillion', 'carbon',
    'blackwell', 'supercluster', 'frontier', 'reasoning', 'kernel', 'exploit',
    'ipo', 'acquisition', 'partner',
  ];
  for (const word of milestoneWords) {
    if (title.includes(word)) score += 6;
  }

  // 3. Named model releases
  const modelNames = ['gpt', 'claude', 'gemini', 'llama', 'deepseek', 'qwen', 'kimi', 'mistral'];
  if (modelNames.some((m) => title.includes(m))) {
    score += 10;
  }

  // 4. Topic priority
  if (s.topic === 'Models') score += 10;
  else if (s.topic === 'Dev Tools & Infra') score += 6;
  else if (s.topic === 'Research') score += 4;

  // 5. Penalties for low-signal or routine fluff
  const minorWords = ['book', 'student', 'opinion', 'how to', 'tips', 'webinar', 'podcast', 'council', 'local', 'case study', 'protest'];
  for (const word of minorWords) {
    if (title.includes(word)) score -= 14;
  }

  if (s.upvoteCount && s.upvoteCount > 0) {
    score += Math.min(20, s.upvoteCount * 2);
  }

  return score;
}

const VIEWS = ['latest', 'trending', 'saved', 'about', 'connect', 'benchmarks'] as const;
type View = (typeof VIEWS)[number] | 'feedback';

const LABELS: Record<string, string> = {
  latest: 'Latest',
  trending: 'Trending',
  saved: 'Saved',
  about: 'About',
  benchmarks: 'Benchmarks',
  connect: 'Feedback & Connect',
  feedback: 'Feedback & Connect',
};

export function ExploreTabs({ stories }: { stories: TimelineStoryDisplay[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get('view') as View | null;
  const initialView = requested && (VIEWS.includes(requested as any) || requested === 'feedback') ? requested : 'latest';
  const [view, setView] = useState<View>(initialView);
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);

  // User upvoted stories state (local votes from localStorage + in-session upvotes)
  const [localVoteSlugs, setLocalVoteSlugs] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('signal_upvoted_stories');
      if (raw) {
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed : Object.keys(parsed));
      }
    } catch {}
    return new Set();
  });

  useEffect(() => {
    const handleVoteEvent = (e: any) => {
      const { slug, voted } = e.detail || {};
      if (!slug) return;
      setLocalVoteSlugs((prev) => {
        const next = new Set(prev);
        if (voted) next.add(slug);
        else next.delete(slug);
        return next;
      });
    };
    window.addEventListener('neubench_vote_changed', handleVoteEvent);
    return () => window.removeEventListener('neubench_vote_changed', handleVoteEvent);
  }, []);

  // Synchronize when URL changes externally (browser back/forward button)
  useEffect(() => {
    if (requested && (VIEWS.includes(requested as any) || requested === 'feedback')) {
      setView(requested);
    } else if (!requested) {
      setView('latest');
    }
  }, [requested]);

  const handleSwitchView = (newView: View) => {
    setView(newView);
    setIsTrendingLoading(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', newView);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Find latest available date in data
  const latestDateStory = stories[0];
  const defaultYear = latestDateStory?.year || '2026';
  const defaultMonth = latestDateStory?.month || 'Nov';
  const defaultDay = latestDateStory?.day || '7';

  const [selectedYear, setSelectedYear] = useState<string>(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [selectedDay, setSelectedDay] = useState<string>(defaultDay);

  // Highlights cache: holds top 5 highlights + total count for that date
  const [dateHighlightsCache, setDateHighlightsCache] = useState<
    Record<string, { stories: TimelineStoryDisplay[]; total: number }>
  >(() => {
    const map: Record<string, { stories: TimelineStoryDisplay[]; total: number }> = {};
    const defaultMIdx = MONTHS.findIndex((m) => m.name.toLowerCase() === defaultMonth.toLowerCase());
    const todayKey = `${defaultYear}-${String(defaultMIdx >= 0 ? defaultMIdx + 1 : 11).padStart(2, '0')}-${String(defaultDay).padStart(2, '0')}`;
    const todayStories = stories.filter((s) => {
      return (
        String(s.year) === defaultYear &&
        s.month.toLowerCase() === defaultMonth.toLowerCase() &&
        String(s.day).replace(/^0/, '') === String(defaultDay).replace(/^0/, '')
      );
    });
    if (todayStories.length > 0) {
      const deduped = deduplicateStories(todayStories);
      const ranked = selectDigestHighlights(deduped as any, 5) as TimelineStoryDisplay[];
      map[todayKey] = {
        stories: ranked.length > 0 ? ranked : deduped.slice(0, 5),
        total: todayStories.length,
      };
    }
    return map;
  });

  // All Feed cache: holds full chronological dispatches for that date (only populated on-demand!)
  const [dateAllCache, setDateAllCache] = useState<Record<string, TimelineStoryDisplay[]>>(() => {
    const map: Record<string, TimelineStoryDisplay[]> = {};
    const defaultMIdx = MONTHS.findIndex((m) => m.name.toLowerCase() === defaultMonth.toLowerCase());
    const todayKey = `${defaultYear}-${String(defaultMIdx >= 0 ? defaultMIdx + 1 : 11).padStart(2, '0')}-${String(defaultDay).padStart(2, '0')}`;
    map[todayKey] = stories.filter((s) => {
      return (
        String(s.year) === defaultYear &&
        s.month.toLowerCase() === defaultMonth.toLowerCase() &&
        String(s.day).replace(/^0/, '') === String(defaultDay).replace(/^0/, '')
      );
    });
    return map;
  });

  const [isLoadingHighlights, setIsLoadingHighlights] = useState<boolean>(false);
  const [isLoadingAllFeed, setIsLoadingAllFeed] = useState<boolean>(false);
  const inFlightFetchRef = useRef<Set<string>>(new Set());

  // The Two-Tab Option: 'highlight' vs 'all' (Default: 'highlight')
  const [feedMode, setFeedMode] = useState<'highlight' | 'all'>('highlight');

  // Progressive batch loading for All Feed (Loads 10 items initially, +10 on scroll)
  const [visibleAllFeedCount, setVisibleAllFeedCount] = useState<number>(10);
  const [isLoadingMoreBatches, setIsLoadingMoreBatches] = useState<boolean>(false);
  const infiniteScrollSentinelRef = useRef<HTMLDivElement | null>(null);

  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [openDropdown, setOpenDropdown] = useState<'day' | 'month' | 'year' | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Reset batch count to 10 whenever filters, date, or feed mode change
  useEffect(() => {
    setVisibleAllFeedCount(10);
  }, [selectedYear, selectedMonth, selectedDay, selectedTopic, selectedCompany, searchQuery, feedMode]);



  // Close search when clicking outside if query is empty
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isSearchOpen &&
        searchWrapRef.current &&
        !searchWrapRef.current.contains(event.target as Node) &&
        !searchQuery.trim()
      ) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSearchOpen, searchQuery]);

  // Global keyboard shortcut for search (Cmd+K / Ctrl+K)
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => {
          const next = !prev;
          if (next) setTimeout(() => searchInputRef.current?.focus(), 60);
          return next;
        });
      } else if (e.key === 'Escape' && isSearchOpen) {
        setSearchQuery('');
        setIsSearchOpen(false);
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSearchOpen]);

  const handleMouseEnter = (type: 'day' | 'month' | 'year') => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpenDropdown(type);
  };

  const handleMouseLeave = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 280);
  };

  const daysInMonth = useMemo(() => {
    const monthIdx = MONTHS.findIndex((m) => m.name.toLowerCase() === selectedMonth.toLowerCase());
    const yearNum = parseInt(selectedYear, 10) || 2026;
    if (monthIdx === -1) return 31;
    return new Date(yearNum, monthIdx + 1, 0).getDate();
  }, [selectedMonth, selectedYear]);

  // Compute canonical date key: YYYY-MM-DD
  const selectedMonthIdx = MONTHS.findIndex((m) => m.name.toLowerCase() === selectedMonth.toLowerCase());
  const selectedMonthNum = String(selectedMonthIdx >= 0 ? selectedMonthIdx + 1 : 11).padStart(2, '0');
  const selectedDayNum = String(selectedDay).padStart(2, '0');
  const selectedDateKey = `${selectedYear}-${selectedMonthNum}-${selectedDayNum}`;

  // Automatically lazy-load dispatches when moving to any date
  // In Highlight Mode: loads ONLY the top 5 highlights and total count (fast, lightweight!)
  // In All Feed Mode: loads full chronological stream on-demand
  // Dedicated, non-blocking asynchronous data loader with deduplicated in-flight guards
  useEffect(() => {
    if (feedMode === 'all') {
      if (dateAllCache[selectedDateKey] && dateAllCache[selectedDateKey].length > 0) {
        return;
      }
      const fetchKey = `all:${selectedDateKey}`;
      if (inFlightFetchRef.current.has(fetchKey)) {
        return;
      }
      inFlightFetchRef.current.add(fetchKey);
      let active = true;
      setIsLoadingAllFeed(true);

      fetch(`/api/stories?date=${selectedDateKey}&mode=all`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch all stories');
          return res.json();
        })
        .then((data) => {
          if (!active) return;
          const fetched: TimelineStoryDisplay[] = Array.isArray(data?.stories) ? data.stories : [];
          setDateAllCache((prev) => ({
            ...prev,
            [selectedDateKey]: fetched,
          }));
        })
        .catch((err) => {
          console.error('Lazy loading failed for all stories', selectedDateKey, err);
        })
        .finally(() => {
          inFlightFetchRef.current.delete(fetchKey);
          if (active) setIsLoadingAllFeed(false);
        });

      return () => {
        active = false;
        inFlightFetchRef.current.delete(fetchKey);
      };
    } else {
      // feedMode === 'highlight' -> Fast Path: only fetch highlights + total count!
      if (dateHighlightsCache[selectedDateKey] && dateHighlightsCache[selectedDateKey].stories.length > 0) {
        return;
      }
      const fetchKey = `hl:${selectedDateKey}`;
      if (inFlightFetchRef.current.has(fetchKey)) {
        return;
      }
      inFlightFetchRef.current.add(fetchKey);
      let active = true;
      setIsLoadingHighlights(true);

      fetch(`/api/stories?date=${selectedDateKey}&mode=highlights`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch highlights');
          return res.json();
        })
        .then((data) => {
          if (!active) return;
          const fetched: TimelineStoryDisplay[] = Array.isArray(data?.stories) ? data.stories : [];
          const total = typeof data?.total === 'number' ? data.total : fetched.length;
          setDateHighlightsCache((prev) => ({
            ...prev,
            [selectedDateKey]: { stories: fetched, total },
          }));
        })
        .catch((err) => {
          console.error('Lazy loading failed for highlights', selectedDateKey, err);
        })
        .finally(() => {
          inFlightFetchRef.current.delete(fetchKey);
          if (active) setIsLoadingHighlights(false);
        });

      return () => {
        active = false;
        inFlightFetchRef.current.delete(fetchKey);
      };
    }
  }, [selectedDateKey, feedMode, dateHighlightsCache, dateAllCache]);

  // Exact total available feed dispatches for the active date
  const totalFeedCount = useMemo(() => {
    if (dateAllCache[selectedDateKey] && dateAllCache[selectedDateKey].length > 0) {
      return dateAllCache[selectedDateKey].length;
    }
    if (dateHighlightsCache[selectedDateKey]) {
      return dateHighlightsCache[selectedDateKey].total;
    }
    const ssrMatches = stories.filter((s) => {
      const matchYear = String(s.year) === selectedYear;
      const matchMonth = s.month.toLowerCase() === selectedMonth.toLowerCase();
      const matchDay = String(s.day).replace(/^0/, '') === String(selectedDay).replace(/^0/, '');
      return matchYear && matchMonth && matchDay;
    });
    return ssrMatches.length;
  }, [dateAllCache, dateHighlightsCache, selectedDateKey, stories, selectedYear, selectedMonth, selectedDay]);

  const daysWithStories = useMemo(() => {
    const set = new Set<string>();
    for (const s of stories) {
      if (String(s.year) === selectedYear && s.month.toLowerCase() === selectedMonth.toLowerCase()) {
        set.add(String(s.day).replace(/^0/, ''));
      }
    }
    for (const key of Object.keys(dateHighlightsCache)) {
      const [y, m, d] = key.split('-');
      const mIdx = parseInt(m, 10) - 1;
      const mName = MONTHS[mIdx]?.name || '';
      if (y === selectedYear && mName.toLowerCase() === selectedMonth.toLowerCase()) {
        if (dateHighlightsCache[key].total > 0) {
          set.add(String(parseInt(d, 10)));
        }
      }
    }
    for (const key of Object.keys(dateAllCache)) {
      const [y, m, d] = key.split('-');
      const mIdx = parseInt(m, 10) - 1;
      const mName = MONTHS[mIdx]?.name || '';
      if (y === selectedYear && mName.toLowerCase() === selectedMonth.toLowerCase()) {
        if (dateAllCache[key].length > 0) {
          set.add(String(parseInt(d, 10)));
        }
      }
    }
    return set;
  }, [stories, dateHighlightsCache, dateAllCache, selectedYear, selectedMonth]);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    for (const s of stories) {
      if (s.year) set.add(String(s.year));
    }
    set.add('2026');
    set.add('2025');
    set.add('2024');
    set.add('2023');
    return Array.from(set).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  }, [stories]);

  const isToday =
    selectedYear === defaultYear &&
    selectedMonth === defaultMonth &&
    String(selectedDay) === String(defaultDay);

  // Filter and rank stories for the current selected date
  const { allDayStories, highlightStories, displayedStories } = useMemo(() => {
    // 1. All Day stories: only compute if dateAllCache has it or fallback to SSR stories for today
    let rawList: TimelineStoryDisplay[] = [];
    if (dateAllCache[selectedDateKey]) {
      rawList = dateAllCache[selectedDateKey];
    } else if (isToday) {
      rawList = stories.filter((s) => {
        const matchYear = String(s.year) === selectedYear;
        const matchMonth = s.month.toLowerCase() === selectedMonth.toLowerCase();
        const matchDay = String(s.day).replace(/^0/, '') === String(selectedDay).replace(/^0/, '');
        return matchYear && matchMonth && matchDay;
      });
    }

    let dayList = rawList;
    if (dayList.length > 0) {
      if (selectedTopic !== 'all') {
        dayList = dayList.filter((s) => s.topic?.toLowerCase() === selectedTopic.toLowerCase());
      }
      if (selectedCompany !== 'all') {
        dayList = dayList.filter((s) => s.company?.toLowerCase() === selectedCompany.toLowerCase());
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        dayList = dayList.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            (s.summary && s.summary.toLowerCase().includes(q)) ||
            (s.company && s.company.toLowerCase().includes(q)),
        );
      }
    }
    const dedupedDayStories = dayList.length > 0 ? deduplicateStories(dayList) : [];

    // 2. Highlight stories (prioritize dateHighlightsCache if available)
    let highlights: TimelineStoryDisplay[] = [];
    if (dateHighlightsCache[selectedDateKey]?.stories?.length > 0) {
      let hlList = dateHighlightsCache[selectedDateKey].stories;
      if (selectedTopic !== 'all') {
        hlList = hlList.filter((s) => s.topic?.toLowerCase() === selectedTopic.toLowerCase());
      }
      if (selectedCompany !== 'all') {
        hlList = hlList.filter((s) => s.company?.toLowerCase() === selectedCompany.toLowerCase());
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        hlList = hlList.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            (s.summary && s.summary.toLowerCase().includes(q)) ||
            (s.company && s.company.toLowerCase().includes(q)),
        );
      }
      highlights = hlList.slice(0, 5);
    } else if (dedupedDayStories.length > 0) {
      const digestRanked = selectDigestHighlights(dedupedDayStories as any, 5) as TimelineStoryDisplay[];
      highlights = digestRanked.length > 0 ? digestRanked : dedupedDayStories.slice(0, 5);
    }

    const displayed = feedMode === 'highlight' ? highlights : dedupedDayStories;

    return {
      allDayStories: dedupedDayStories,
      highlightStories: highlights,
      displayedStories: displayed,
    };
  }, [dateAllCache, dateHighlightsCache, selectedDateKey, isToday, stories, selectedYear, selectedMonth, selectedDay, selectedTopic, selectedCompany, searchQuery, feedMode]);

  // Infinite scroll IntersectionObserver: loads 10 more items when reaching sentinel
  useEffect(() => {
    if (feedMode !== 'all') return;
    const sentinel = infiniteScrollSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setVisibleAllFeedCount((prev) => {
            if (prev < allDayStories.length) {
              setIsLoadingMoreBatches(true);
              setTimeout(() => setIsLoadingMoreBatches(false), 200);
              return Math.min(prev + 10, allDayStories.length);
            }
            return prev;
          });
        }
      },
      { rootMargin: '250px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [feedMode, allDayStories.length]);

  const fiveSecondPoints = useMemo(() => {
    return generateFiveSecondDayPoints(highlightStories);
  }, [highlightStories]);

  // Steppers that cleanly cross month and year boundaries
  const handlePrevDay = () => {
    const curDay = parseInt(selectedDay, 10);
    if (curDay > 1) {
      setSelectedDay(String(curDay - 1));
      return;
    }
    // Cross to previous month
    const mIdx = MONTHS.findIndex((m) => m.name.toLowerCase() === selectedMonth.toLowerCase());
    if (mIdx > 0) {
      const prevMonth = MONTHS[mIdx - 1];
      const prevYearNum = parseInt(selectedYear, 10) || 2026;
      const lastDayOfPrevMonth = new Date(prevYearNum, mIdx, 0).getDate();
      setSelectedMonth(prevMonth.name);
      setSelectedDay(String(lastDayOfPrevMonth));
    } else {
      // Cross to previous year (December 31)
      const yNum = parseInt(selectedYear, 10) || 2026;
      setSelectedYear(String(yNum - 1));
      setSelectedMonth('Dec');
      setSelectedDay('31');
    }
  };

  const handleNextDay = () => {
    const curDay = parseInt(selectedDay, 10);
    if (curDay < daysInMonth) {
      setSelectedDay(String(curDay + 1));
      return;
    }
    // Cross to next month
    const mIdx = MONTHS.findIndex((m) => m.name.toLowerCase() === selectedMonth.toLowerCase());
    if (mIdx < MONTHS.length - 1) {
      const nextMonth = MONTHS[mIdx + 1];
      setSelectedMonth(nextMonth.name);
      setSelectedDay('1');
    } else {
      // Cross to next year (January 1)
      const yNum = parseInt(selectedYear, 10) || 2026;
      setSelectedYear(String(yNum + 1));
      setSelectedMonth('Jan');
      setSelectedDay('1');
    }
  };

  const handleGoToToday = () => {
    setSelectedYear(defaultYear);
    setSelectedMonth(defaultMonth);
    setSelectedDay(defaultDay);
  };

  // Bookmarks hook
  const [bookmarks] = useBookmarks();

  // Weekly bounds calculation (resets Sunday midnight)
  const weekBounds = useMemo(() => {
    const mIdx = MONTHS.findIndex((m) => m.name.toLowerCase() === selectedMonth.toLowerCase());
    const monthNum = mIdx >= 0 ? mIdx + 1 : 11;
    const dNum = parseInt(selectedDay, 10) || 7;
    const yNum = parseInt(selectedYear, 10) || 2026;
    const selectedDate = new Date(yNum, monthNum - 1, dNum, 12, 0, 0);

    const dayOfWeek = selectedDate.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const startDate = new Date(selectedDate);
    startDate.setDate(selectedDate.getDate() - dayOfWeek);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);
    endDate.setHours(0, 0, 0, 0);

    return { startDate, endDate };
  }, [selectedYear, selectedMonth, selectedDay]);

  const weekRangeStr = useMemo(() => {
    const startM = MONTHS[weekBounds.startDate.getMonth()]?.name || selectedMonth;
    const startD = String(weekBounds.startDate.getDate()).padStart(2, '0');
    const endPrev = new Date(weekBounds.endDate);
    endPrev.setDate(endPrev.getDate() - 1);
    const endM = MONTHS[endPrev.getMonth()]?.name || selectedMonth;
    const endD = String(endPrev.getDate()).padStart(2, '0');
    const y = weekBounds.startDate.getFullYear();
    return `${startM} ${startD} – ${endM} ${endD}, ${y}`;
  }, [weekBounds, selectedMonth]);

  // Trending items computed ONLY when view === 'trending'
  const trendingStories = useMemo(() => {
    if (view !== 'trending') return [];

    // Filter ONLY voted stories FIRST: reduces 500 items down to the ~10-20 voted ones (<0.1ms)
    const votedStories = stories.filter((s) => {
      const userVoted = localVoteSlugs.has(s.slug);
      return ((s.upvoteCount ?? 0) + (userVoted ? 1 : 0)) >= 1;
    });

    if (votedStories.length === 0) return [];

    const startTime = weekBounds.startDate.getTime();
    const endTime = weekBounds.endDate.getTime();

    // Check weekly timeframe
    let list = votedStories.filter((s) => {
      let storyTime: number;
      if (s.date && s.date.includes('-')) {
        const [y, m, d] = s.date.split('-').map(Number);
        storyTime = new Date(y, m - 1, d, 12, 0, 0).getTime();
      } else {
        const mIdx = MONTHS.findIndex((m) => m.name.toLowerCase() === (s.month || '').toLowerCase());
        const dNum = parseInt(s.day, 10) || 1;
        const yNum = parseInt(s.year, 10) || 2026;
        storyTime = new Date(yNum, mIdx >= 0 ? mIdx : 10, dNum, 12, 0, 0).getTime();
      }
      return storyTime >= startTime && storyTime < endTime;
    });

    // If none in the exact week window, fallback to all voted stories
    if (list.length === 0) {
      list = votedStories;
    }

    // Deduplicate only the small voted set (< 1ms execution)
    list = deduplicateStories(list);

    if (selectedCompany !== 'all') {
      list = list.filter((s) => s.company?.toLowerCase() === selectedCompany.toLowerCase());
    }

    if (selectedTopic !== 'all') {
      list = list.filter((s) => s.topic?.toLowerCase() === selectedTopic.toLowerCase());
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.summary && s.summary.toLowerCase().includes(q)) ||
          (s.company && s.company.toLowerCase().includes(q))
      );
    }

    return list.slice().sort((a, b) => {
      const aVotes = (a.upvoteCount ?? 0) + (localVoteSlugs.has(a.slug) ? 1 : 0);
      const bVotes = (b.upvoteCount ?? 0) + (localVoteSlugs.has(b.slug) ? 1 : 0);
      const diff = bVotes - aVotes;
      if (diff !== 0) return diff;
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [view, stories, weekBounds, localVoteSlugs, selectedCompany, selectedTopic, searchQuery]);

  // Saved Stories
  const savedStories = useMemo(() => {
    let list = stories.filter((s) => bookmarks.has(s.slug));
    list = deduplicateStories(list);

    if (selectedCompany !== 'all') {
      list = list.filter((s) => s.company?.toLowerCase() === selectedCompany.toLowerCase());
    }

    if (selectedTopic !== 'all') {
      list = list.filter((s) => s.topic?.toLowerCase() === selectedTopic.toLowerCase());
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.summary && s.summary.toLowerCase().includes(q)) ||
          (s.company && s.company.toLowerCase().includes(q))
      );
    }

    return list;
  }, [stories, bookmarks, selectedCompany, selectedTopic, searchQuery]);

  return (
    <div className="ex-root">
      {/* Top sticky progress spinner when loading trending */}
      {view === 'trending' && isTrendingLoading && (
        <div className="neubench-top-loading-bar" role="status" aria-live="polite">
          <NeubenchSpinner size={16} strokeWidth={4.5} />
          <span>Loading Weekly Top Trending Dispatches…</span>
        </div>
      )}

      {/* Pinned Sticky Header */}
      <div className="ex-header-sticky">
        <header className="ex-top">
          <div className="ex-top-brand-row">
            <Link href="/home" className="ex-brand" aria-label="NEUBENCH, home" title="NEUBENCH home">
              <span className="neubench-logo-e" aria-hidden="true" style={{ width: 26, height: 30, display: 'inline-flex' }}>
                <svg viewBox="0 0 65 72" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
                  <rect className="neubench-logo-bar neubench-logo-bar--blue" x="0" y="0" width="65" height="16" rx="8" fill="#4777FF" />
                  <rect className="neubench-logo-bar neubench-logo-bar--yellow" x="0" y="28" width="65" height="16" rx="8" fill="#FDE047" />
                  <rect className="neubench-logo-bar neubench-logo-bar--teal" x="0" y="56" width="65" height="16" rx="8" fill="#13DCCB" />
                </svg>
              </span>
            </Link>

            <div className="ex-mobile-top-actions">
              <button
                type="button"
                className={`ex-mobile-search-toggle ${isSearchOpen ? 'is-active' : ''}`}
                onClick={() => {
                  setIsSearchOpen(!isSearchOpen);
                  if (!isSearchOpen) {
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }
                }}
                aria-label="Toggle search"
              >
                <Search size={15} />
              </button>
              <ThemeToggle />
              <AccountButton iconOnly />
            </div>
          </div>

          {isSearchOpen && (
            <div className="ex-mobile-header-search-bar" ref={searchWrapRef}>
              <Search size={14} className="ex-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                placeholder="Search dispatches, companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }
                }}
                className="ex-mobile-search-input"
                aria-label="Search news dispatches"
              />
              {searchQuery.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="ex-search-action-btn"
                  title="Clear search query"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="ex-search-action-btn"
                  title="Close search"
                  aria-label="Close search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          <div className="ex-tabs-track-wrap">
            <nav className="ex-tabs" aria-label="Explorer sections">
              <Link
                href="/home"
                className="ex-tab ex-tab-home"
                title="Return to NeuBench Home"
              >
                <Home size={13} className="ex-tab-home-icon" />
                <span>Home</span>
              </Link>
              <button
                type="button"
                className={`ex-tab ex-tab-latest ${view === 'latest' ? 'active' : ''}`}
                onClick={() => handleSwitchView('latest')}
              >
                Latest
              </button>
              <button
                type="button"
                className={`ex-tab ex-tab-trending ${view === 'trending' ? 'active' : ''}`}
                onClick={() => handleSwitchView('trending')}
              >
                {isTrendingLoading && <NeubenchSpinner size={12} strokeWidth={4.5} />}
                Trending
              </button>
              <button
                type="button"
                className={`ex-tab ex-tab-saved ${view === 'saved' ? 'active' : ''}`}
                onClick={() => handleSwitchView('saved')}
              >
                Saved
              </button>
              <button
                type="button"
                className={`ex-tab ex-tab-benchmarks ${view === 'benchmarks' ? 'active' : ''}`}
                onClick={() => handleSwitchView('benchmarks')}
              >
                Benchmarks
              </button>
              <button
                type="button"
                className={`ex-tab ex-tab-about ${view === 'about' ? 'active' : ''}`}
                onClick={() => handleSwitchView('about')}
              >
                About
              </button>
              <button
                type="button"
                className={`ex-tab ex-tab-connect ${view === 'connect' || view === 'feedback' ? 'active' : ''}`}
                onClick={() => handleSwitchView('connect')}
              >
                Feedback
              </button>
            </nav>
          </div>

          <div className="ex-desktop-top-actions">
            {isSearchOpen ? (
              <div className="ex-header-search-wrap" ref={searchWrapRef}>
                <Search size={14} className="ex-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  autoFocus
                  placeholder="Search dispatches, companies, models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchQuery('');
                      setIsSearchOpen(false);
                    }
                  }}
                  className="ex-header-search-input"
                  aria-label="Search news dispatches"
                />
                {searchQuery.trim().length > 0 && (
                  <span className="ex-search-matches-pill">
                    {displayedStories.length} {displayedStories.length === 1 ? 'match' : 'matches'}
                  </span>
                )}
                {searchQuery.trim().length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="ex-search-action-btn"
                    title="Clear search query"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    className="ex-search-action-btn"
                    title="Close search (Esc)"
                    aria-label="Close search"
                  >
                    <kbd className="ex-search-esc-kbd">ESC</kbd>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="ex-header-icon-btn"
                onClick={() => {
                  setIsSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                title="Search news dispatches (⌘K)"
                aria-label="Search"
              >
                <Search size={16} />
              </button>
            )}
            <ThemeToggle />
            <AccountButton iconOnly />
          </div>
        </header>

        {/* Subtoolbar with Date Slider, View-specific indicator, and Company/Topic Filters */}
        {(view === 'latest' || view === 'trending' || view === 'saved') && (
          <div className="ex-subtoolbar">
            <div className="ex-subtoolbar-inner">
              <div className="ex-subtoolbar-left">
                {/* Date Slider as it was earlier: Day, Month, Year hover popovers */}
                <div className="ex-date-selector">
                  {/* 1. Day Unit */}
                  <div
                    className="ex-picker-unit"
                    onMouseEnter={() => handleMouseEnter('day')}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button
                      type="button"
                      className={`ex-picker-trigger ${openDropdown === 'day' ? 'is-open' : ''}`}
                      onClick={() => setOpenDropdown(openDropdown === 'day' ? null : 'day')}
                      aria-haspopup="dialog"
                      aria-expanded={openDropdown === 'day'}
                    >
                      <span className="ex-picker-val">{selectedDay}</span>
                      <ChevronDown size={14} className="ex-picker-chevron" />
                    </button>

                    {openDropdown === 'day' && (
                      <div
                        className="ex-picker-dropdown ex-picker-dropdown-days"
                        onMouseEnter={() => handleMouseEnter('day')}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="ex-picker-dropdown-header">
                          <span>Select Day — {selectedMonth} {selectedYear}</span>
                        </div>
                        <div className="ex-days-grid">
                          {Array.from({ length: daysInMonth }, (_, i) => String(i + 1)).map((d) => {
                            const hasStories = daysWithStories.has(d);
                            const isSelected = String(selectedDay).replace(/^0/, '') === d;
                            return (
                              <button
                                key={d}
                                type="button"
                                className={`ex-day-cell ${isSelected ? 'is-selected' : ''} ${hasStories ? 'has-stories' : ''}`}
                                onClick={() => {
                                  setSelectedDay(d);
                                  setOpenDropdown(null);
                                }}
                              >
                                <span>{d}</span>
                                {hasStories && <span className="ex-story-dot" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Month Unit */}
                  <div
                    className="ex-picker-unit"
                    onMouseEnter={() => handleMouseEnter('month')}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button
                      type="button"
                      className={`ex-picker-trigger ${openDropdown === 'month' ? 'is-open' : ''}`}
                      onClick={() => setOpenDropdown(openDropdown === 'month' ? null : 'month')}
                      aria-haspopup="dialog"
                      aria-expanded={openDropdown === 'month'}
                    >
                      <span className="ex-picker-val">{selectedMonth}</span>
                      <ChevronDown size={14} className="ex-picker-chevron" />
                    </button>

                    {openDropdown === 'month' && (
                      <div
                        className="ex-picker-dropdown ex-picker-dropdown-months"
                        onMouseEnter={() => handleMouseEnter('month')}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="ex-picker-dropdown-header">
                          <span>Select Month — {selectedYear}</span>
                        </div>
                        <div className="ex-months-list">
                          {MONTHS.map((m) => {
                            const isSelected = selectedMonth.toLowerCase() === m.name.toLowerCase();
                            return (
                              <button
                                key={m.name}
                                type="button"
                                className={`ex-month-item ${isSelected ? 'is-selected' : ''}`}
                                onClick={() => {
                                  setSelectedMonth(m.name);
                                  setOpenDropdown(null);
                                }}
                              >
                                <span>{m.fullName}</span>
                                <span className="ex-month-short">{m.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Year Unit */}
                  <div
                    className="ex-picker-unit"
                    onMouseEnter={() => handleMouseEnter('year')}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button
                      type="button"
                      className={`ex-picker-trigger ${openDropdown === 'year' ? 'is-open' : ''}`}
                      onClick={() => setOpenDropdown(openDropdown === 'year' ? null : 'year')}
                      aria-haspopup="dialog"
                      aria-expanded={openDropdown === 'year'}
                    >
                      <span className="ex-picker-val">{selectedYear}</span>
                      <ChevronDown size={14} className="ex-picker-chevron" />
                    </button>

                    {openDropdown === 'year' && (
                      <div
                        className="ex-picker-dropdown ex-picker-dropdown-years"
                        onMouseEnter={() => handleMouseEnter('year')}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="ex-picker-dropdown-header">
                          <span>Select Year</span>
                        </div>
                        <div className="ex-years-list">
                          {availableYears.map((y) => {
                            const isSelected = selectedYear === y;
                            return (
                              <button
                                key={y}
                                type="button"
                                className={`ex-year-item ${isSelected ? 'is-selected' : ''}`}
                                onClick={() => {
                                  setSelectedYear(y);
                                  setOpenDropdown(null);
                                }}
                              >
                                <span>{y}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ex-date-stepper">
                    <button
                      type="button"
                      className="ex-stepper-btn"
                      onClick={handlePrevDay}
                      title="Previous Day"
                      aria-label="Previous Day"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      className="ex-stepper-btn"
                      onClick={handleNextDay}
                      title="Next Day"
                      aria-label="Next Day"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {!isToday && (
                    <button type="button" className="ex-today-btn" onClick={handleGoToToday} title="Jump back to latest news today">
                      <Sparkles size={11} />
                      <span>Today</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Center: Contextual indicator / switcher */}
              <div className="ex-subtoolbar-center">
                {view === 'latest' && (
                  <div className="ex-feed-tab-switch" role="tablist" aria-label="Feed mode">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={feedMode === 'highlight'}
                      className={`ex-feed-tab-btn ${feedMode === 'highlight' ? 'is-active' : ''}`}
                      onClick={() => setFeedMode('highlight')}
                    >
                      <Sparkles size={13} />
                      <span>Highlight ({Math.min(5, highlightStories.length)})</span>
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={feedMode === 'all'}
                      className={`ex-feed-tab-btn ${feedMode === 'all' ? 'is-active' : ''}`}
                      onClick={() => setFeedMode('all')}
                    >
                      <Layers size={13} />
                      <span>All Feed ({totalFeedCount})</span>
                    </button>
                  </div>
                )}

                {view === 'trending' && (
                  <div className="ex-weekly-indicator" title="Weekly Trending Cycle: Resets Sunday Midnight">
                    <TrendingUp size={13} style={{ color: 'var(--accent)' }} />
                    <span className="ex-weekly-indicator-title">Weekly Top</span>
                    <span className="ex-weekly-indicator-range">{weekRangeStr}</span>
                    <span className="ex-weekly-indicator-badge">Resets Sun 00:00</span>
                  </div>
                )}

                {view === 'saved' && (
                  <div className="ex-saved-indicator" title="Saved Stories in your Dossier">
                    <Bookmark size={13} style={{ color: 'var(--accent)' }} />
                    <span>Saved Dossier ({savedStories.length})</span>
                  </div>
                )}
              </div>

              {/* Right: Company & Category filters */}
              <div className="ex-subtoolbar-right">
                <div className="ex-toolbar-filters">
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="ex-filter-dropdown"
                  aria-label="Filter by Company"
                >
                  <option value="all">All Companies</option>
                  <option value="OpenAI">OpenAI</option>
                  <option value="Google">Google / DeepMind</option>
                  <option value="Anthropic">Anthropic</option>
                  <option value="Meta">Meta</option>
                  <option value="NVIDIA">NVIDIA</option>
                  <option value="DeepSeek">DeepSeek</option>
                  <option value="Mistral">Mistral AI</option>
                  <option value="Apple">Apple</option>
                </select>

                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="ex-filter-dropdown"
                  aria-label="Filter by Category"
                >
                  <option value="all">All Categories</option>
                  <option value="Models">Models</option>
                  <option value="Dev Tools & Infra">Dev Tools & Infra</option>
                  <option value="Research">Research</option>
                  <option value="Policy">Policy</option>
                  <option value="Business">Business</option>
                  <option value="Robotics">Robotics</option>
                  <option value="Products">Products</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Main Body */}
      <main className="ex-body">
        {/* 1. LATEST VIEW: The Two-Tab Highlight vs All Feed */}
        {view === 'latest' && (
          <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 20px' }}>
            {isLoadingHighlights && feedMode === 'highlight' ? (
              <div className="ex-date-loading-state" aria-live="polite" aria-busy="true">
                <NeubenchSpinner size={46} strokeWidth={4.5} />
                <div className="ex-date-loading-text">
                  <h3>Loading Intelligence Radar</h3>
                  <p>Fetching top highlights for {selectedMonth} {selectedDay}, {selectedYear}...</p>
                </div>
              </div>
            ) : feedMode === 'highlight' && highlightStories.length === 0 ? (
              <div className="ex-empty" style={{ margin: '40px auto' }}>
                <Sparkles size={36} style={{ opacity: 0.45, marginBottom: 14 }} />
                <h3>No dispatches match your selection</h3>
                <p>
                  No stories found for {selectedMonth} {selectedDay}, {selectedYear} under this view.
                </p>
                <button type="button" className="ex-btn-primary" onClick={handleGoToToday} style={{ marginTop: 14 }}>
                  <Sparkles size={14} />
                  <span>Show Latest News (Today)</span>
                </button>
              </div>
            ) : (
              <>
                {feedMode === 'highlight' ? (
                  /* ========================================================
                     HIGHLIGHT MODE: 30-Second Executive Summary (Top 5)
                     With 5-Second Macro Narrative on Top
                     ======================================================== */
                  <div className="ex-highlight-view">
                    {/* 1. Header Banner */}
                    <div className="ex-highlight-view-header">
                      <div className="ex-highlight-header-left">
                        <div className="ex-bluf-badge">
                          <Zap size={13} className="ex-bluf-zap-icon" />
                          <span>2-Minute Executive Summary</span>
                        </div>
                        <h2 className="ex-highlight-view-title">
                          Top 5 AI Movements — {isToday ? 'Today' : `${selectedMonth} ${selectedDay}, ${selectedYear}`}
                        </h2>
                      </div>
                      <div className="ex-highlight-header-right">
                        <span className="ex-bluf-timing-tag">⚡ 2-Min Read • Zero Fluff</span>
                        {totalFeedCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setFeedMode('all')}
                            className="ex-bluf-stream-btn"
                          >
                            <span>Full Stream ({totalFeedCount})</span>
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 2. Today's AI Moment • 5-Second Overview Box (Scannable Points) */}
                    <div className="ex-bluf-5sec-callout">
                      <div className="ex-bluf-5sec-header">
                        <div className="ex-bluf-5sec-kicker">
                          <Zap size={12} className="ex-bluf-5sec-icon" />
                          <span>Today's AI Moment • 5-Second Overview</span>
                        </div>
                        <span className="ex-bluf-5sec-sub">Scannable Executive Takeaways</span>
                      </div>

                      <ul className="ex-bluf-5sec-points">
                        {fiveSecondPoints.map((pt, pIdx) => (
                          <li key={pIdx} className="ex-bluf-5sec-point-item">
                            <span className="ex-5sec-bullet-dot" aria-hidden="true" />
                            <div className="ex-5sec-point-content">
                              <strong className="ex-5sec-point-label">{pt.label}:</strong>{' '}
                              <span className="ex-5sec-point-text">{pt.text}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 3. Top 5 AI Moments: Individual Numbered Panels */}
                    {(() => {
                      const topFive = highlightStories.slice(0, 5);
                      if (topFive.length === 0) return null;

                      return (
                        <div className="ex-highlight-panels-list" aria-label="Top 5 Highlights">
                          {topFive.map((story, idx) => {
                            const cleanTitle = cleanTitleEditorial(story.title);
                            const entity = detectRealEntityEditorial(story.title, story.company);
                            const topic = story.topic || 'Products';
                            const summary = generateTriadOverviewEditorial(story);
                            const chips = extractImpactChips(story);
                            const isLast = idx === topFive.length - 1;

                            return (
                              <article key={story.id || idx} className={`ex-highlight-panel-item ${idx === 0 ? 'is-lead' : ''}`}>
                                <div className="ex-panel-rail">
                                  <span className={`ex-panel-step-num ${idx === 0 ? 'is-lead-step' : ''}`}>
                                    {String(idx + 1).padStart(2, '0')}
                                  </span>
                                  {!isLast && <span className="ex-panel-step-line" aria-hidden="true" />}
                                </div>

                                <div className={`ex-panel-card ${idx === 0 ? 'is-lead-card' : ''}`}>
                                  <div className="ex-panel-meta-row">
                                    <span className={`ex-tag ex-tag-topic ex-topic-${getTopicSlug(topic)}`}>
                                      <span className="ex-tag-dot" />
                                      {topic}
                                    </span>
                                    {entity && (
                                      <span className={`ex-tag ex-tag-entity ex-entity-${getEntitySlug(entity)}`}>
                                        {entity}
                                      </span>
                                    )}
                                    {chips.slice(0, 2).map((chip, cIdx) => (
                                      <span key={cIdx} className={`ex-impact-chip ex-impact-chip--${chip.tone}`}>
                                        {chip.label}
                                      </span>
                                    ))}
                                    <span className="ex-panel-date">
                                      {story.date || `${selectedMonth} ${selectedDay}, ${selectedYear}`}
                                    </span>
                                  </div>

                                  <h3 className="ex-panel-title">
                                    <span>{cleanTitle}</span>
                                  </h3>

                                  <p className="ex-panel-summary">{summary}</p>

                                  <div className="ex-panel-footer">
                                    <div className="ex-panel-footer-links">
                                      <Link href={`/story/${story.slug}`} className="ex-panel-read-link">
                                        <span>Read full story</span>
                                        <ArrowRight size={13} />
                                      </Link>
                                    </div>
                                    <div className="ex-panel-actions">
                                      <UpvoteButton slug={story.slug} baseCount={story.upvoteCount ?? 0} initialVoted={localVoteSlugs.has(story.slug)} />
                                      <BookmarkButton slug={story.slug} />
                                      <ShareButton title={cleanTitle} slug={story.slug} topic={topic} />
                                    </div>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* 4. Switcher Callout to All Feed */}
                    {totalFeedCount > 5 && (
                      <div className="ex-highlight-stream-callout">
                        <span>Looking for the complete chronological stream?</span>
                        <button
                          type="button"
                          onClick={() => setFeedMode('all')}
                          className="ex-highlight-stream-link"
                        >
                          <span>Switch to All Feed ({totalFeedCount} dispatches)</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ========================================================
                     ALL FEED MODE: Complete Chronological Stream
                     ======================================================== */
                  <div className="ex-allfeed-view">
                    {(isLoadingAllFeed || (!dateAllCache[selectedDateKey] && !isToday)) ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 4px 12px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span className="ex-skeleton-pulse-dot" />
                            <span>Loading complete stream ({totalFeedCount} dispatches) for {selectedMonth} {selectedDay}, {selectedYear}...</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setFeedMode('highlight')}
                            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Sparkles size={12} />
                            <span>Switch to Highlights ({Math.min(5, highlightStories.length || 5)})</span>
                          </button>
                        </div>

                        <div className="ex-timeline-panels-list" aria-busy="true">
                          {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="ex-timeline-panel-item ex-skeleton-item">
                              <div className="ex-timeline-rail">
                                <div className="ex-timeline-date-badge ex-skeleton-badge">
                                  <span className="ex-timeline-date-day">{selectedDay}</span>
                                  <span className="ex-timeline-date-month">{selectedMonth}</span>
                                </div>
                                {i < 3 && <span className="ex-timeline-rail-line" />}
                              </div>
                              <div className="ex-panel-card ex-skeleton-card">
                                <div className="ex-skeleton-line ex-skeleton-meta" />
                                <div className="ex-skeleton-line ex-skeleton-title" />
                                <div className="ex-skeleton-line ex-skeleton-desc" />
                                <div className="ex-skeleton-line ex-skeleton-desc-short" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : allDayStories.length === 0 ? (
                      <div className="ex-empty" style={{ margin: '40px auto' }}>
                        <Sparkles size={36} style={{ opacity: 0.45, marginBottom: 14 }} />
                        <h3>No dispatches match your selection</h3>
                        <p>No dispatches found for this date under current filters.</p>
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const pagedAllDayStories = allDayStories.slice(0, visibleAllFeedCount);
                          const remainingCount = Math.max(0, allDayStories.length - visibleAllFeedCount);

                          return (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 4px 12px', fontSize: '0.8rem', color: 'var(--muted)', flexWrap: 'wrap', gap: 8 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                  <span>
                                    Showing {Math.min(visibleAllFeedCount, allDayStories.length)} of {allDayStories.length} dispatches for {selectedMonth} {selectedDay}, {selectedYear}
                                  </span>
                                  {allDayStories.length > 10 && (
                                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', background: 'rgba(253, 224, 71, 0.12)', color: 'var(--accent)', fontWeight: 600, border: '1px solid rgba(253, 224, 71, 0.25)' }}>
                                      Batches of 10
                                    </span>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setFeedMode('highlight')}
                                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                  <Sparkles size={12} />
                                  <span>Switch to Highlights ({Math.min(5, highlightStories.length)})</span>
                                </button>
                              </div>

                              <div className="ex-timeline-panels-list" aria-label="All Dispatches Timeline">
                                {pagedAllDayStories.map((story, idx) => {
                                  const cleanTitle = cleanTitleOnly(story.title);
                                  const entity = detectRealEntityEditorial(story.title, story.company);
                                  const cleanSummary =
                                    story.summary && story.summary.length > 220
                                      ? cleanSummaryText(story.summary)
                                      : generateFiveToEightLineOverviewEditorial(story);
                                  const isLast = idx === pagedAllDayStories.length - 1;

                                  return (
                                    <article key={story.id || idx} className="ex-timeline-panel-item">
                                      {/* Date Rail (OUTSIDE the panel card) */}
                                      <div className="ex-timeline-rail">
                                        <div className="ex-timeline-date-badge">
                                          <span className="ex-timeline-date-day">{story.day}</span>
                                          <span className="ex-timeline-date-month">{story.month}</span>
                                        </div>
                                        {!isLast && <span className="ex-timeline-rail-line" />}
                                      </div>

                                      {/* Content Panel Card */}
                                      <div className="ex-panel-card">
                                        <div className="ex-panel-meta-row">
                                          <span className={`ex-tag ex-tag-topic ex-topic-${getTopicSlug(story.topic)}`}>
                                            <span className="ex-tag-dot" />
                                            {story.topic || 'Products'}
                                          </span>
                                          {entity && (
                                            <span className={`ex-tag ex-tag-entity ex-entity-${getEntitySlug(entity)}`}>
                                              {entity}
                                            </span>
                                          )}
                                        </div>

                                        <h3 className="ex-panel-title">
                                          <span>{cleanTitle}</span>
                                        </h3>

                                        {cleanSummary && (
                                          <p className="ex-panel-summary">
                                            {cleanSummary}
                                          </p>
                                        )}

                                        <div className="ex-panel-footer">
                                          <div className="ex-panel-footer-links">
                                            <Link
                                              href={`/story/${story.slug}`}
                                              className="ex-panel-read-link"
                                            >
                                              <span>Read full story</span>
                                              <ArrowRight size={13} />
                                            </Link>
                                          </div>

                                          <div className="ex-panel-actions">
                                            <UpvoteButton slug={story.slug} baseCount={story.upvoteCount ?? 0} initialVoted={localVoteSlugs.has(story.slug)} />
                                            <BookmarkButton slug={story.slug} />
                                            <ShareButton title={cleanTitle} slug={story.slug} topic={story.topic} />
                                          </div>
                                        </div>
                                      </div>
                                    </article>
                                  );
                                })}
                              </div>

                              {/* Infinite Scroll Trigger Sentinel & Batch Loading Controls */}
                              {remainingCount > 0 ? (
                                <div className="ex-infinite-scroll-container">
                                  <div ref={infiniteScrollSentinelRef} className="ex-infinite-scroll-sentinel" aria-hidden="true" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsLoadingMoreBatches(true);
                                      setTimeout(() => setIsLoadingMoreBatches(false), 200);
                                      setVisibleAllFeedCount((prev) => Math.min(prev + 10, allDayStories.length));
                                    }}
                                    className="ex-load-more-btn"
                                    disabled={isLoadingMoreBatches}
                                  >
                                    {isLoadingMoreBatches ? (
                                      <>
                                        <NeubenchSpinner size={15} strokeWidth={5} />
                                        <span>Loading next 10 dispatches...</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>Load 10 More Dispatches</span>
                                        <span className="ex-load-more-count">({remainingCount} remaining)</span>
                                        <ChevronDown size={14} />
                                      </>
                                    )}
                                  </button>
                                </div>
                              ) : allDayStories.length > 10 ? (
                                <div className="ex-feed-completed-badge">
                                  <span className="ex-feed-completed-check">✓</span>
                                  <span>You have caught up with all {allDayStories.length} dispatches for {selectedMonth} {selectedDay}, {selectedYear}</span>
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </>
                )}
              </div>
            )}
              </>
            )}
          </div>
        )}

        {/* 2. TRENDING VIEW: Weekly Top */}
        {view === 'trending' && (
          <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 4px 14px', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrendingUp size={20} style={{ color: 'var(--accent)' }} />
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Weekly Top AI Dispatches</h2>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                    Weekly Top • Resetting every Sunday midnight • Ranked by community upvotes &amp; engagement
                  </span>
                </div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--muted)' }}>
                <span className="ex-weekly-indicator-badge">Resets Sunday 00:00</span>
                <span>{trendingStories.length} dispatches for {weekRangeStr}</span>
              </div>
            </div>

            {isTrendingLoading ? (
              <div className="ex-loading-state" style={{ minHeight: 380 }} role="status" aria-live="polite">
                <NeubenchSpinner size={44} strokeWidth={4.5} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--fg)', marginTop: 18, marginBottom: 6 }}>
                  Loading Weekly Top Trending Dispatches…
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0 }}>
                  Filtering community-voted dispatches (Resets Sunday 00:00)
                </p>
              </div>
            ) : trendingStories.length === 0 ? (
              <div className="ex-empty" style={{ margin: '40px auto' }}>
                <TrendingUp size={36} style={{ opacity: 0.45, marginBottom: 14 }} />
                <h3>No trending dispatches this week</h3>
                <p>
                  No stories found for {weekRangeStr} matching your filters.
                </p>
                <button type="button" className="ex-btn-primary" onClick={handleGoToToday} style={{ marginTop: 14 }}>
                  <Sparkles size={14} />
                  <span>Show Current Week</span>
                </button>
              </div>
            ) : (

            <div className="ex-timeline-panels-list" aria-label="Trending AI Dispatches">
              {trendingStories.map((story, idx) => {
                const cleanTitle = cleanTitleOnly(story.title);
                const entity = detectRealEntityEditorial(story.title, story.company);
                const cleanSummary =
                  story.summary && story.summary.length > 220
                    ? cleanSummaryText(story.summary)
                    : generateFiveToEightLineOverviewEditorial(story);
                const isLast = idx === trendingStories.length - 1;

                return (
                  <article key={story.id || idx} className="ex-timeline-panel-item">
                    {/* Rank Rail (OUTSIDE the panel card) */}
                    <div className="ex-timeline-rail">
                      <div className={`ex-timeline-date-badge ${idx < 3 ? 'is-lead-rank' : ''}`}>
                        <span className="ex-timeline-date-day">#{idx + 1}</span>
                        <span className="ex-timeline-date-month">{story.month}</span>
                      </div>
                      {!isLast && <span className="ex-timeline-rail-line" />}
                    </div>

                    {/* Content Panel Card */}
                    <div className="ex-panel-card">
                      <div className="ex-panel-meta-row">
                        <span className={`ex-tag ex-tag-topic ex-topic-${getTopicSlug(story.topic)}`}>
                          <span className="ex-tag-dot" />
                          {story.topic || 'Products'}
                        </span>
                        {entity && (
                          <span className={`ex-tag ex-tag-entity ex-entity-${getEntitySlug(entity)}`}>
                            {entity}
                          </span>
                        )}
                      </div>

                      <h3 className="ex-panel-title">
                        <span>{cleanTitle}</span>
                      </h3>

                      {cleanSummary && (
                        <p className="ex-panel-summary">
                          {cleanSummary}
                        </p>
                      )}

                      <div className="ex-panel-footer">
                        <div className="ex-panel-footer-links">
                          <Link
                            href={`/story/${story.slug}`}
                            className="ex-panel-read-link"
                          >
                            <span>Read full story</span>
                            <ArrowRight size={13} />
                          </Link>
                        </div>

                        <div className="ex-panel-actions">
                          <UpvoteButton slug={story.slug} baseCount={story.upvoteCount ?? 0} initialVoted={localVoteSlugs.has(story.slug)} />
                          <BookmarkButton slug={story.slug} />
                          <ShareButton title={cleanTitle} slug={story.slug} topic={story.topic} />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* 3. SAVED DOSSIER VIEW */}
        {view === 'saved' && (
          <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 4px 14px', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Bookmark size={20} style={{ color: 'var(--accent)' }} />
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Saved Research Dossier</h2>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                    Your bookmarked stories synced across research sessions ({savedStories.length} saved)
                  </span>
                </div>
              </div>
            </div>

            {savedStories.length === 0 ? (
              <div className="ex-empty" style={{ margin: '40px auto' }}>
                <Bookmark size={40} style={{ opacity: 0.4, marginBottom: 14 }} />
                <h3>Your Saved Dossier is Empty</h3>
                <p style={{ color: 'var(--muted)', maxWidth: 440, margin: '8px auto 20px' }}>
                  Stories you bookmark appear here for quick access across your research sessions.
                </p>
                <button
                  type="button"
                  className="ex-btn-primary"
                  onClick={() => router.replace('/explore?view=latest', { scroll: false })}
                >
                  <Sparkles size={14} />
                  <span>Browse Latest News</span>
                </button>
              </div>
            ) : (
              <div className="ex-timeline-panels-list" aria-label="Saved AI Dispatches">
                {savedStories.map((story, idx) => {
                  const cleanTitle = cleanTitleOnly(story.title);
                  const entity = detectRealEntityEditorial(story.title, story.company);
                  const cleanSummary =
                    story.summary && story.summary.length > 220
                      ? cleanSummaryText(story.summary)
                      : generateFiveToEightLineOverviewEditorial(story);
                  const isLast = idx === savedStories.length - 1;

                  return (
                    <article key={story.id || idx} className="ex-timeline-panel-item">
                      <div className="ex-timeline-rail">
                        <div className="ex-timeline-date-badge">
                          <span className="ex-timeline-date-day">{story.day}</span>
                          <span className="ex-timeline-date-month">{story.month}</span>
                        </div>
                        {!isLast && <span className="ex-timeline-rail-line" />}
                      </div>

                      <div className="ex-panel-card">
                        <div className="ex-panel-meta-row">
                          <span className={`ex-tag ex-tag-topic ex-topic-${getTopicSlug(story.topic)}`}>
                            <span className="ex-tag-dot" />
                            {story.topic || 'Products'}
                          </span>
                          {entity && (
                            <span className={`ex-tag ex-tag-entity ex-entity-${getEntitySlug(entity)}`}>
                              {entity}
                            </span>
                          )}
                        </div>

                        <h3 className="ex-panel-title">
                          <span>{cleanTitle}</span>
                        </h3>

                        {cleanSummary && (
                          <p className="ex-panel-summary">
                            {cleanSummary}
                          </p>
                        )}

                        <div className="ex-panel-footer">
                          <div className="ex-panel-footer-links">
                            <Link
                              href={`/story/${story.slug}`}
                              className="ex-panel-read-link"
                            >
                              <span>Read full story</span>
                              <ArrowRight size={13} />
                            </Link>
                          </div>

                          <div className="ex-panel-actions">
                            <UpvoteButton slug={story.slug} baseCount={story.upvoteCount ?? 0} initialVoted={localVoteSlugs.has(story.slug)} />
                            <BookmarkButton slug={story.slug} />
                            <ShareButton title={cleanTitle} slug={story.slug} topic={story.topic} />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. BENCHMARKS VIEW */}
        {view === 'benchmarks' && (
          <div className="ex-benchmarks-embed-wrap" style={{ maxWidth: 1360, margin: '0 auto', padding: '0 20px 60px' }}>
            <ModelBenchmarksComparator embedded />
          </div>
        )}

        {/* 4. ABOUT VIEW */}
        {view === 'about' && (
          <AboutMainView
            onBrowseLatest={() => router.replace('/explore?view=latest', { scroll: false })}
          />
        )}

        {/* 5. FEEDBACK & CONNECT VIEW */}
        {(view === 'connect' || view === 'feedback') && (
          <FeedbackConnectMainView
            onBrowseLatest={() => router.replace('/explore?view=latest', { scroll: false })}
          />
        )}
      </main>
    </div>
  );
}
