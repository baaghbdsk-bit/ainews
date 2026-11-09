"use client";

import Link from "next/link";
import "@/styles/neubench-logo.css";
import { AccountButton } from "@/components/auth/account-button";
import { HomeBackdrop } from "@/components/home-backdrop";
import {
  BarChart2,
  Bookmark,
  Flame,
  Info,
  MessageSquare,
  Sparkles,
} from "lucide-react";

interface ModuleConfig {
  key: string;
  icon: typeof BarChart2;
  title: string;
  desc: string;
  tone: string;
  glow: string;
  href: string;
}

const MODULES: ModuleConfig[] = [
  {
    key: "latest",
    icon: Sparkles,
    title: "Latest",
    desc: "The newest launches, papers, and AI developments as they land.",
    tone: "#22e6ff",
    glow: "rgba(34, 230, 255, 0.18)",
    href: "/latest",
  },
  {
    key: "benchmarks",
    icon: BarChart2,
    title: "Benchmarks",
    desc: "Compare frontier models, scores, and capability charts.",
    tone: "#ff6a1a",
    glow: "rgba(255, 106, 26, 0.2)",
    href: "/benchmarks",
  },
  {
    key: "trending",
    icon: Flame,
    title: "Trending",
    desc: "What the community is upvoting and discussing right now.",
    tone: "#ff4d4d",
    glow: "rgba(255, 77, 77, 0.2)",
    href: "/trending",
  },
  {
    key: "saved",
    icon: Bookmark,
    title: "Saved",
    desc: "Your personal intelligence dossier, synced across devices.",
    tone: "#f5d300",
    glow: "rgba(245, 211, 0, 0.18)",
    href: "/saved",
  },
  {
    key: "about",
    icon: Info,
    title: "About",
    desc: "Our methodology, taxonomy pillars, and archive mission.",
    tone: "#a78bfa",
    glow: "rgba(167, 139, 250, 0.18)",
    href: "/about",
  },
  {
    key: "connect",
    icon: MessageSquare,
    title: "Connect",
    desc: "Channels to reach the team, share feedback, and shape the product.",
    tone: "#34d399",
    glow: "rgba(52, 211, 153, 0.18)",
    href: "/connect",
  },
];

export function HomeLauncher() {
  return (
    <section className="hl-root" aria-label="NeuBench home">
      <HomeBackdrop />
      <div className="hl-user">
        <AccountButton iconOnly />
      </div>
      <div className="bh-mast">
        <div className="bh-live-marker">
          <span className="bh-live-dot" aria-hidden="true" />
          <span>Live feed</span>
        </div>
        <h1 className="bh-wordmark" aria-label="NEUBENCH">
          <span aria-hidden="true">N</span>
          <span className="neubench-logo-e" aria-hidden="true">
            <svg viewBox="0 0 65 72" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
              <rect className="neubench-logo-bar neubench-logo-bar--blue" x="0" y="0" width="65" height="16" rx="8" fill="#22E6FF" />
              <rect className="neubench-logo-bar neubench-logo-bar--yellow" x="0" y="28" width="65" height="16" rx="8" fill="#F5D300" />
              <rect className="neubench-logo-bar neubench-logo-bar--teal" x="0" y="56" width="65" height="16" rx="8" fill="#FF6A1A" />
            </svg>
          </span>
          <span aria-hidden="true">UBENCH</span>
          <span className="bh-hallmark">The One-Stop AI News Platform</span>
        </h1>
        <p className="bh-sub">
          <span className="bh-sub-line-1">Daily AI news and highlights in one single feed.</span>
          <br />
          <span className="bh-sub-line-2">Don&apos;t browse 10 different sites — track model releases, research &amp; industry shifts in real time.</span>
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
                prefetch={false}
                className="bh-mod"
                style={{ "--bh-tone": m.tone, "--bh-glow": m.glow } as React.CSSProperties}
              >
                <span className="bh-ic">
                  <Icon size={15} aria-hidden="true" />
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
