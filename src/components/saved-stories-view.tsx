'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bookmark, Search, Sparkles, ArrowRight } from 'lucide-react';
import { BookmarkButton, ShareButton, UpvoteButton, useBookmarks } from '@/components/story-actions';
import { useAuth } from '@/lib/auth/store';
import type { TimelineStoryDisplay } from '@/lib/timeline';
import { NeubenchLoadingLogo } from '@/components/loading';
import {
  generateFiveToEightLineOverviewEditorial,
  cleanTitleEditorial,
} from '@/lib/editorial-overview';
import { cleanSummaryText } from '@/components/explore-tabs';

interface SavedStoriesResult {
  key: string;
  stories: TimelineStoryDisplay[];
  error: string | null;
}

const EMPTY_STORIES: TimelineStoryDisplay[] = [];

export function SavedStoriesView() {
  const [bookmarks] = useBookmarks();
  const { status: authStatus } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<SavedStoriesResult | null>(null);
  const slugsKey = useMemo(() => [...bookmarks].sort().join('\n'), [bookmarks]);

  useEffect(() => {
    if (!slugsKey) return;

    let active = true;
    const slugs = slugsKey.split('\n');

    fetch('/api/stories/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          stories?: TimelineStoryDisplay[];
          error?: string;
        };
        if (!response.ok || !Array.isArray(payload.stories)) {
          throw new Error(payload.error || `Failed to load saved stories (${response.status})`);
        }
        return payload.stories;
      })
      .then((stories) => {
        if (active) setResult({ key: slugsKey, stories, error: null });
      })
      .catch((error: unknown) => {
        if (active) {
          setResult({
            key: slugsKey,
            stories: [],
            error: error instanceof Error ? error.message : 'Failed to load saved stories.',
          });
        }
      });

    return () => {
      active = false;
    };
  }, [retryCount, slugsKey]);

  const currentResult = result?.key === slugsKey ? result : null;
  const isLoading = authStatus === 'loading' || (Boolean(slugsKey) && currentResult === null);
  const stories = currentResult?.stories ?? EMPTY_STORIES;
  const savedStories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return stories.filter((story) => {
      if (!bookmarks.has(story.slug)) return false;
      if (selectedCompany !== 'all' && story.company?.toLowerCase() !== selectedCompany.toLowerCase()) {
        return false;
      }
      if (selectedTopic !== 'all' && story.topic?.toLowerCase() !== selectedTopic.toLowerCase()) {
        return false;
      }
      return (
        !query ||
        story.title.toLowerCase().includes(query) ||
        story.summary.toLowerCase().includes(query) ||
        story.company?.toLowerCase().includes(query)
      );
    });
  }, [bookmarks, searchQuery, selectedCompany, selectedTopic, stories]);

  const companies = useMemo(
    () => [...new Set(stories.map((story) => story.company).filter((company): company is string => Boolean(company)))].sort(),
    [stories],
  );
  const topics = useMemo(
    () => [...new Set(stories.map((story) => story.topic).filter((topic): topic is NonNullable<typeof topic> => topic != null))].sort(),
    [stories],
  );

  return (
    <main className="ex-body saved-stories-page">
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 4px 14px', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bookmark size={20} style={{ color: 'var(--accent)' }} />
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Saved Research Dossier</h1>
              <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                Your bookmarked stories ({bookmarks.size} saved)
              </span>
            </div>
          </div>
        </div>

        <div className="saved-stories-filters">
          <label className="saved-search-control">
            <Search size={14} className="ex-search-icon" />
            <input
              type="search"
              aria-label="Search saved stories"
              placeholder="Search saved stories..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              maxLength={200}
            />
          </label>
          <select
            value={selectedCompany}
            onChange={(event) => setSelectedCompany(event.target.value)}
            className="ex-filter-dropdown"
            aria-label="Filter saved stories by company"
          >
            <option value="all">All Companies</option>
            {companies.map((company) => <option key={company} value={company}>{company}</option>)}
          </select>
          <select
            value={selectedTopic}
            onChange={(event) => setSelectedTopic(event.target.value)}
            className="ex-filter-dropdown"
            aria-label="Filter saved stories by topic"
          >
            <option value="all">All Topics</option>
            {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div aria-busy="true">
            <NeubenchLoadingLogo variant="panel" size={44} label="Loading saved stories…" />
          </div>
        ) : currentResult?.error ? (
          <div className="ex-empty" role="alert" style={{ margin: '40px auto' }}>
            <h2>Saved stories could not be loaded</h2>
            <p>{currentResult.error}</p>
            <button type="button" className="ex-btn-primary" onClick={() => setRetryCount((count) => count + 1)}>
              Try again
            </button>
          </div>
        ) : savedStories.length === 0 ? (
          <div className="ex-empty" style={{ margin: '40px auto' }}>
            <Bookmark size={40} style={{ opacity: 0.4, marginBottom: 14 }} />
            <h2>{bookmarks.size === 0 ? 'Your Saved Dossier is Empty' : 'No saved stories match these filters'}</h2>
            <p style={{ color: 'var(--muted)', maxWidth: 440, margin: '8px auto 20px' }}>
              Stories you bookmark appear here for quick access across your research sessions.
            </p>
            <Link href="/latest" className="ex-btn-primary">
              <Sparkles size={14} />
              <span>Browse Latest News</span>
            </Link>
          </div>
        ) : (
          <div className="ex-timeline-panels-list" aria-label="Saved AI Dispatches">
            {savedStories.map((story, index) => {
              const cleanTitle = cleanTitleEditorial(story.title);
              const cleanSummary =
                story.summary && story.summary.length > 220
                  ? cleanSummaryText(story.summary)
                  : generateFiveToEightLineOverviewEditorial(story);

              return (
              <article key={story.id || story.slug} className="ex-timeline-panel-item">
                <div className="ex-timeline-rail">
                  <time className="ex-timeline-date-badge" dateTime={story.date}>
                    <span className="ex-timeline-date-day">{story.day}</span>
                    <span className="ex-timeline-date-month">{story.month}</span>
                    <span className="ex-timeline-date-year">{story.year}</span>
                  </time>
                  {index < savedStories.length - 1 && <span className="ex-timeline-rail-line" />}
                </div>
                <div className="ex-panel-card">
                  <div className="ex-panel-meta-row">
                    <span className={`ex-tag ex-tag-topic ex-topic-${story.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                      <span className="ex-tag-dot" />
                      {story.topic}
                    </span>
                    {story.company && <span className="ex-tag ex-tag-entity">{story.company}</span>}
                  </div>
                  <h2 className="ex-panel-title">
                    {story.sourceUrl ? (
                      <a href={story.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {cleanTitle}
                      </a>
                    ) : (
                      <span>{cleanTitle}</span>
                    )}
                  </h2>
                  <p className="ex-panel-summary">{cleanSummary}</p>
                  <div className="ex-panel-footer">
                    <div className="ex-panel-footer-links">
                      {story.sourceUrl && (
                        <a
                          href={story.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ex-panel-read-link"
                        >
                        <span>Read original article</span>
                        <ArrowRight size={13} />
                        </a>
                      )}
                    </div>
                    <div className="ex-panel-actions">
                      <UpvoteButton slug={story.slug} baseCount={story.upvoteCount ?? 0} />
                      <BookmarkButton slug={story.slug} />
                      <ShareButton title={story.title} slug={story.slug} topic={story.topic} sourceUrl={story.sourceUrl} />
                    </div>
                  </div>
                </div>
              </article>
                );
              })}
          </div>
        )}
      </div>
    </main>
  );
}
