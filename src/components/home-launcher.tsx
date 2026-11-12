"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import "@/styles/neubench-logo.css";
import { AccountButton } from "@/components/auth/account-button";
import { HomeBackdrop } from "@/components/home-backdrop";
import {
  ArrowLeft,
  ArrowRight,
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
const SPLASH_POSITIONS = [68, 192, 318, 444, 562, 684, 812, 932];

export function HomeLauncher() {
  const railRef = useRef<HTMLDivElement>(null);
  const [railEdge, setRailEdge] = useState({ start: true, end: false });

  function updateRailEdge() {
    const rail = railRef.current;
    if (!rail) return;

    const nextEdge = {
      start: rail.scrollLeft <= 8,
      end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8,
    };

    setRailEdge((current) =>
      current.start === nextEdge.start && current.end === nextEdge.end
        ? current
        : nextEdge,
    );
  }

  function scrollRail(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;

    rail.scrollBy({
      left: direction * Math.max(rail.clientWidth * 0.78, 260),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

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
          <svg
            className="bh-liquid"
            viewBox="0 0 1000 180"
            preserveAspectRatio="none"
            role="presentation"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id="bh-liquid-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22e6ff" stopOpacity=".34" />
                <stop offset="100%" stopColor="#22e6ff" stopOpacity=".015" />
              </linearGradient>
            </defs>
            <path
              className="bh-liquid-body"
              d="M0 83 C72 73 125 89 190 82 S315 74 380 84 S493 94 565 82 S702 72 770 83 S916 91 1000 79 V180 H0Z"
            />
            <path
              className="bh-liquid-edge"
              d="M0 83 C72 73 125 89 190 82 S315 74 380 84 S493 94 565 82 S702 72 770 83 S916 91 1000 79"
            />
            {SPLASH_POSITIONS.map((position, index) => (
              <g
                key={position}
                className="bh-liquid-impact"
                style={{ "--impact-index": index } as CSSProperties}
                transform={`translate(${position} 84)`}
              >
                <circle className="bh-impact-ripple" r="3" />
                <path
                  className="bh-impact-crown"
                  d="M-30 2 C-20 1 -17 -14 -10 -5 C-5 2 -3 7 0 -18 C3 7 5 2 10 -5 C17 -14 20 1 30 2"
                />
                <circle
                  className="bh-impact-drop bh-impact-drop--left"
                  cx="-13"
                  cy="-2"
                  r="3"
                />
                <circle
                  className="bh-impact-drop bh-impact-drop--right"
                  cx="13"
                  cy="-2"
                  r="3"
                />
              </g>
            ))}
          </svg>
        </div>
        <p className="bh-sub">
          <span className="bh-sub-line-1">
            Daily AI news and highlights in one single feed.
          </span>
          <br />
          <span className="bh-sub-line-2">
            Don&apos;t browse 10 different sites, track model releases, research
            &amp; industry shifts in real time.
          </span>
        </p>
      </div>
      <div className="bh-shell">
        <div className="bh-section-head">
          <div>
            <p className="bh-section-kicker">NEUBENCH / DESTINATIONS</p>
            <h2>Choose a section</h2>
          </div>
          <div className="bh-rail-controls" aria-label="Section controls">
            <button
              type="button"
              aria-label="Scroll to previous sections"
              onClick={() => scrollRail(-1)}
              disabled={railEdge.start}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Scroll to next sections"
              onClick={() => scrollRail(1)}
              disabled={railEdge.end}
            >
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="bh-rail-hint" id="bh-rail-hint">
          Scroll sideways to move through NeuBench
        </p>
        <nav
          ref={railRef}
          className="bh-grid"
          aria-label="Explore NeuBench sections"
          aria-describedby="bh-rail-hint"
          tabIndex={0}
          onScroll={updateRailEdge}
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
                <span className="bh-mod-watermark" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="bh-mod-topline">
                  <span className="bh-ic">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="bh-mod-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")} / 06
                  </span>
                </span>
                <span className="bh-mod-copy">
                  <span className="bh-mod-title">{m.title}</span>
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
