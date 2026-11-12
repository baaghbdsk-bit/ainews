"use client";

import Link from "next/link";
import { type CSSProperties } from "react";
import "@/styles/neubench-logo.css";
import { AccountButton } from "@/components/auth/account-button";
import { HomeBackdrop } from "@/components/home-backdrop";
import {
  BarChart2,
  Bookmark,
  Flame,
  Info,
  MessageSquare,
  Newspaper,
} from "lucide-react";

interface ModuleConfig {
  key: string;
  icon: typeof BarChart2;
  title: string;
  desc: string;
  tone: string;
  href: string;
}

const MODULES: ModuleConfig[] = [
  {
    key: "latest",
    icon: Newspaper,
    title: "Latest",
    desc: "The newest launches, papers, and AI developments as they land.",
    tone: "#22e6ff",
    href: "/latest",
  },
  {
    key: "benchmarks",
    icon: BarChart2,
    title: "Benchmarks",
    desc: "Compare frontier models, scores, and capability charts.",
    tone: "#ff6a1a",
    href: "/benchmarks",
  },
  {
    key: "trending",
    icon: Flame,
    title: "Trending",
    desc: "What the community is upvoting and discussing right now.",
    tone: "#ff4d4d",
    href: "/trending",
  },
  {
    key: "saved",
    icon: Bookmark,
    title: "Saved",
    desc: "Your personal intelligence dossier, synced across devices.",
    tone: "#f5d300",
    href: "/saved",
  },
  {
    key: "about",
    icon: Info,
    title: "About",
    desc: "Our methodology, taxonomy pillars, and archive mission.",
    tone: "#a78bfa",
    href: "/about",
  },
  {
    key: "connect",
    icon: MessageSquare,
    title: "Connect",
    desc: "Channels to reach the team, share feedback, and shape the product.",
    tone: "#34d399",
    href: "/connect",
  },
];

const WORDMARK = ["N", "E", "U", "B", "E", "N", "C", "H"];

export function HomeLauncher() {
  return (
    <section className="hl-root" aria-label="NeuBench home">
      <HomeBackdrop />
      <div className="hl-user">
        <AccountButton iconOnly />
      </div>
      <div className="bh-mast">
        <div className="bh-brand-stage">
          <h1 className="bh-wordmark" aria-label="NEUBENCH">
            {WORDMARK.map((letter, index) => (
              <span
                key={`${letter}-${index}`}
                className={`bh-letter${letter === "E" ? " bh-letter--signal" : ""}`}
                style={{ "--letter-index": index } as CSSProperties}
                aria-hidden="true"
              >
                {letter === "E" ? (
                  <span className="neubench-logo-e">
                    <svg
                      viewBox="0 0 65 72"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      focusable="false"
                    >
                      <rect
                        x="0"
                        y="0"
                        width="65"
                        height="16"
                        rx="8"
                        fill="#22E6FF"
                      />
                      <rect
                        x="0"
                        y="28"
                        width="65"
                        height="16"
                        rx="8"
                        fill="#F5D300"
                      />
                      <rect
                        x="0"
                        y="56"
                        width="65"
                        height="16"
                        rx="8"
                        fill="#FF6A1A"
                      />
                    </svg>
                  </span>
                ) : (
                  letter
                )}
              </span>
            ))}
            <span className="bh-hallmark">The One-Stop AI News Platform</span>
          </h1>
          <p className="bh-sub">
          <span className="bh-sub-line-1">
            Daily AI news, papers, model releases, and research highlights —
            all in one single feed.
          </span>
          <br />
          <span className="bh-sub-line-2">
            Don&apos;t browse 10 different sites. Track frontier models,
            research breakthroughs, and industry shifts in real time —
            curated for AI practitioners.
          </span>
        </p>
      </div>
      </div>
      <div className="bh-shell">
          <div className="bh-section-head">
            <div>
              <p className="bh-section-kicker">NEUBENCH / DESTINATIONS</p>
            </div>
          </div>
          <nav
            className="bh-grid"
            aria-label="Explore NeuBench sections"
          >
          {MODULES.map((m, index) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.key}
                href={m.href}
                prefetch={false}
                className="bh-mod"
                aria-label={`${m.title}. ${m.desc}`}
                style={
                  {
                    "--bh-tone": m.tone,
                    "--deck-index": index,
                  } as CSSProperties
                }
              >
                <span className="bh-mod-topline">
                  <span className="bh-ic">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="bh-mod-title">{m.title}</span>
                </span>
                <span className="bh-mod-copy">
                  <span className="bh-mod-desc">{m.desc}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
