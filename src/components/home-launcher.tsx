"use client";

import Link from "next/link";
import "@/styles/neubench-logo.css";
import { AccountButton } from "@/components/auth/account-button";
import { useTheme } from "@/lib/theme";
import {
  BarChart2,
  Bookmark,
  CalendarDays,
  Flame,
  MessageSquare,
  Sparkles,
} from "lucide-react";

const MODULES: { key: string; icon: typeof BarChart2; title: string; desc: string; tone: string; href: string }[] = [
  { key: "latest", icon: Sparkles, title: "Latest", desc: "The newest launches, papers, and AI developments as they land.", tone: "#2563eb", href: "/latest" },
  { key: "benchmarks", icon: BarChart2, title: "Benchmarks", desc: "Compare frontier models, scores, and capability charts.", tone: "#9333ea", href: "/benchmarks" },
  { key: "digest", icon: CalendarDays, title: "Daily Digest", desc: "A 24-hour executive briefing of the most important AI news.", tone: "#0891b2", href: "/explore?view=digest" },
  { key: "trending", icon: Flame, title: "Trending", desc: "What the community is upvoting and discussing right now.", tone: "#f97316", href: "/explore?view=trending" },
  { key: "saved", icon: Bookmark, title: "Saved", desc: "Your personal intelligence dossier, synced across devices.", tone: "#16a34a", href: "/explore?view=saved" },
  { key: "connect", icon: MessageSquare, title: "Feedback & Connect", desc: "Channels to reach the team and shape the product.", tone: "#e11d48", href: "/about" },
];

export function HomeLauncher() {
  const [isLight] = useTheme();
  return (
    <section className="hl-root" data-bh-theme={isLight ? "light" : "dark"} aria-label="NeuBench home">
      <div className="hl-user">
        <AccountButton iconOnly />
      </div>
      <div className="bh-mast">
        <h1 className="bh-wordmark" aria-label="NEUBENCH">
          <span aria-hidden="true">N</span>
          <span className="neubench-logo-e" aria-hidden="true">
            <svg viewBox="0 0 65 72" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
              <rect className="neubench-logo-bar neubench-logo-bar--blue" x="0" y="0" width="65" height="16" rx="8" fill="#4777FF" />
              <rect className="neubench-logo-bar neubench-logo-bar--violet" x="0" y="28" width="65" height="16" rx="8" fill="#8055F5" />
              <rect className="neubench-logo-bar neubench-logo-bar--teal" x="0" y="56" width="65" height="16" rx="8" fill="#13DCCB" />
            </svg>
          </span>
          <span aria-hidden="true">UBENCH</span>
          <span className="bh-hallmark">The AI intelligence daily</span>
        </h1>
        <p className="bh-sub">
          Your daily read on the AI frontier —<br />
          models, products, research &amp; policy, distilled every day.
        </p>
      </div>

      <div className="bh-shell">
        <div className="bh-grid">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.key}
                href={m.href}
                className="bh-mod"
                style={{ "--bh-tone": m.tone } as React.CSSProperties}
              >
                <span className="bh-ic">
                  <Icon size={15} /> {m.title}
                </span>
                <h3>{m.title}</h3>
                <p>{m.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
