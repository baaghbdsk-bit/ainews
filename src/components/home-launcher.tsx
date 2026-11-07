"use client";

import Link from "next/link";
import "@/styles/neubench-logo.css";
import { AccountButton } from "@/components/auth/account-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/lib/theme";
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
  darkTone: string;
  darkGlow: string;
  lightTone: string;
  lightGlow: string;
  href: string;
}

const MODULES: ModuleConfig[] = [
  {
    key: "latest",
    icon: Sparkles,
    title: "Latest",
    desc: "The newest launches, papers, and AI developments as they land.",
    darkTone: "#38bdf8",
    darkGlow: "rgba(56, 189, 248, 0.22)",
    lightTone: "#0284c7",
    lightGlow: "rgba(2, 132, 199, 0.15)",
    href: "/explore?view=latest",
  },
  {
    key: "benchmarks",
    icon: BarChart2,
    title: "Benchmarks",
    desc: "Compare frontier models, scores, and capability charts.",
    darkTone: "#fb7185",
    darkGlow: "rgba(251, 113, 133, 0.22)",
    lightTone: "#e11d48",
    lightGlow: "rgba(225, 29, 72, 0.15)",
    href: "/explore?view=benchmarks",
  },
  {
    key: "trending",
    icon: Flame,
    title: "Trending",
    desc: "What the community is upvoting and discussing right now.",
    darkTone: "#f59e0b",
    darkGlow: "rgba(245, 158, 11, 0.22)",
    lightTone: "#d97706",
    lightGlow: "rgba(217, 119, 6, 0.15)",
    href: "/explore?view=trending",
  },
  {
    key: "saved",
    icon: Bookmark,
    title: "Saved",
    desc: "Your personal intelligence dossier, synced across devices.",
    darkTone: "#10b981",
    darkGlow: "rgba(16, 185, 129, 0.22)",
    lightTone: "#059669",
    lightGlow: "rgba(5, 150, 105, 0.15)",
    href: "/explore?view=saved",
  },
  {
    key: "about",
    icon: Info,
    title: "About",
    desc: "Our methodology, taxonomy pillars, and archive mission.",
    darkTone: "#818cf8",
    darkGlow: "rgba(129, 140, 248, 0.22)",
    lightTone: "#4f46e5",
    lightGlow: "rgba(79, 70, 229, 0.15)",
    href: "/explore?view=about",
  },
  {
    key: "connect",
    icon: MessageSquare,
    title: "Feedback & Connect",
    desc: "Channels to reach the team and shape the product.",
    darkTone: "#2dd4bf",
    darkGlow: "rgba(45, 212, 191, 0.22)",
    lightTone: "#0d9488",
    lightGlow: "rgba(13, 148, 136, 0.15)",
    href: "/explore?view=connect",
  },
];

export function HomeLauncher() {
  const [isLight] = useTheme();
  return (
    <section className="hl-root" data-bh-theme={isLight ? "light" : "dark"} aria-label="NeuBench home">
      <div className="hl-user">
        <ThemeToggle className="hl-theme-btn" />
        <AccountButton iconOnly />
      </div>
      <div className="bh-mast">
        <h1 className="bh-wordmark" aria-label="NEUBENCH">
          <span aria-hidden="true">N</span>
          <span className="neubench-logo-e" aria-hidden="true">
            <svg viewBox="0 0 65 72" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
              <rect className="neubench-logo-bar neubench-logo-bar--blue" x="0" y="0" width="65" height="16" rx="8" fill="#4777FF" />
              <rect className="neubench-logo-bar neubench-logo-bar--yellow" x="0" y="28" width="65" height="16" rx="8" fill="#FDE047" />
              <rect className="neubench-logo-bar neubench-logo-bar--teal" x="0" y="56" width="65" height="16" rx="8" fill="#13DCCB" />
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
            const tone = isLight ? m.lightTone : m.darkTone;
            const glow = isLight ? m.lightGlow : m.darkGlow;
            return (
              <Link
                key={m.key}
                href={m.href}
                prefetch={true}
                className="bh-mod"
                style={{ "--bh-tone": tone, "--bh-glow": glow } as React.CSSProperties}
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
