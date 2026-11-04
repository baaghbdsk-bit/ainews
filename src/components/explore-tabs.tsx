"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { TimelineStoryDisplay } from "@/lib/timeline";

const VIEWS = ["latest", "digest", "trending", "saved"] as const;
type View = (typeof VIEWS)[number];

const LABELS: Record<View, string> = {
  latest: "Latest",
  digest: "Daily Digest",
  trending: "Trending",
  saved: "Saved",
};

export function ExploreTabs({ stories }: { stories: TimelineStoryDisplay[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("view") as View | null;
  const view = requested && VIEWS.includes(requested) ? requested : "latest";

  const items =
    view === "trending"
      ? [...stories].sort((a, b) => (b.upvoteCount ?? 0) - (a.upvoteCount ?? 0))
      : stories.slice(0, 30);

  return (
    <div className="ex-root">
      <header className="ex-top">
        <span className="ex-brand">
          <Link href="/home">NeuBench</Link>
        </span>
        <nav className="ex-tabs" aria-label="Explorer sections">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              className={`ex-tab ${view === v ? "active" : ""}`}
              onClick={() => router.replace(`/explore?view=${v}`, { scroll: false })}
            >
              {LABELS[v]}
            </button>
          ))}
        </nav>
      </header>

      <main className="ex-body">
        {(view === "latest" || view === "trending" || view === "saved") && (
          <div className="ex-filter" aria-label="Filter stories">
            <label>Year</label>
            <select defaultValue="2026"><option value="2026">2026</option><option value="all">All</option></select>
            <label>Month</label>
            <select defaultValue="all"><option value="all">All</option><option>Nov</option><option>Oct</option></select>
            <label>Company</label>
            <select defaultValue="all"><option value="all">All</option></select>
          </div>
        )}

        {view === "digest" && <DigestView stories={stories} />}

        {view === "saved" && (
          <div className="ex-empty">
            Saved stories will appear here — sign in and bookmark stories to build your dossier.
          </div>
        )}

        {(view === "latest" || view === "trending") && (
          <>
            <div className="ex-h">
              <h2>{LABELS[view]}</h2>
              <span className="ex-count">{items.length} stories</span>
            </div>
            {items.map((s, i) => (
              <div className="ex-row" key={s.id}>
                <span className="ex-rank">{String(i + 1).padStart(2, "0")}</span>
                <span className="ex-title">{s.title}</span>
                <span className="ex-topic">{s.topic}</span>
                <span className="ex-date">{s.month} {s.day}, {s.year}</span>
                <span className="ex-votes">{s.upvoteCount ?? 0}</span>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function DigestView({ stories }: { stories: TimelineStoryDisplay[] }) {
  const digest = stories.slice(0, 4).map((s) => ({
    tag: s.topic,
    text: s.deck || s.summary || s.title,
  }));
  return (
    <>
      <div className="ex-h">
        <h2>Daily Digest</h2>
        <span className="ex-count">24h briefing</span>
      </div>
      <div className="ex-digest-head">What moved today</div>
      {digest.map((d, i) => (
        <div className="ex-digest-item" key={i}>
          <span className="ex-tag">{d.tag}</span>
          {d.text}
        </div>
      ))}
    </>
  );
}
