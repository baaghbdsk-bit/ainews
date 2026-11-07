"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  Layers,
  BookOpen,
  ShieldCheck,
  Cpu,
  Globe,
  Radio,
  BarChart2,
  ArrowRight,
  CheckCircle2,
  Wrench,
  TrendingUp,
  ExternalLink,
} from "lucide-react";

interface AboutMainViewProps {
  onBrowseLatest: () => void;
}

export function AboutMainView({ onBrowseLatest }: AboutMainViewProps) {
  return (
    <div className="about-main-container">
      {/* 1. Hero Section */}
      <section className="about-v2-hero" aria-label="About NeuBench">
        <div className="about-v2-kicker">
          <Sparkles size={14} className="about-v2-kicker-icon" />
          <span>Independent Intelligence Archive</span>
        </div>
        <h1 className="about-v2-title">
          Documenting the arc of <span className="about-v2-title-gradient">artificial intelligence.</span>
        </h1>
        <p className="about-v2-lede">
          NeuBench is a living historical index and real-time radar tracking the pivotal releases,
          architectural breakthroughs, and regulatory shifts shaping synthetic intelligence.
        </p>
      </section>

      {/* 2. Key Metrics Grid */}
      <section className="about-v2-stats" aria-label="NeuBench at a glance">
        <div className="about-v2-stat-card">
          <div className="about-v2-stat-value">6 Pillars</div>
          <div className="about-v2-stat-label">Systematic Taxonomy</div>
          <div className="about-v2-stat-desc">
            Models, Products, Research, Policy &amp; Safety, Business, and Dev Tools covering the full frontier.
          </div>
        </div>
        <div className="about-v2-stat-card">
          <div className="about-v2-stat-value">20+ Feeds</div>
          <div className="about-v2-stat-label">Primary Sources</div>
          <div className="about-v2-stat-desc">
            Continuous automated ingestion from OpenAI, DeepMind, Anthropic, Meta, Mistral, and arXiv preprints.
          </div>
        </div>
        <div className="about-v2-stat-card">
          <div className="about-v2-stat-value">4+ Years</div>
          <div className="about-v2-stat-label">Historical Depth</div>
          <div className="about-v2-stat-desc">
            From early foundation transformers to unified multi-modal reasoning and autonomous agent systems.
          </div>
        </div>
        <div className="about-v2-stat-card">
          <div className="about-v2-stat-value">100% Sourced</div>
          <div className="about-v2-stat-label">Zero Hallucinations</div>
          <div className="about-v2-stat-desc">
            Every dispatch links directly to verified technical whitepapers, repo commits, and official releases.
          </div>
        </div>
      </section>

      {/* 3. Purpose & Signal vs Noise */}
      <section className="about-v2-section" aria-label="Our Mission">
        <div className="about-v2-section-head">
          <span className="about-v2-section-kicker">Core Mission</span>
          <h2 className="about-v2-section-title">The signal vs. noise problem</h2>
          <p className="about-v2-section-subtitle">
            The velocity of artificial intelligence development is without precedent. Hundreds of announcements,
            preprints, and speculative narratives flood feeds daily. NeuBench preserves historical clarity.
          </p>
        </div>

        <div className="about-v2-pillars-grid">
          <div className="about-v2-card">
            <div className="about-v2-card-icon">
              <Layers size={22} />
            </div>
            <h3 className="about-v2-card-title">Chronological Continuum</h3>
            <p className="about-v2-card-text">
              Rather than treating news as disposable ephemera, NeuBench organizes developments into an interactive,
              permanent timeline where cause, consequence, and architectural evolution remain transparent.
            </p>
          </div>

          <div className="about-v2-card">
            <div className="about-v2-card-icon">
              <BookOpen size={22} />
            </div>
            <h3 className="about-v2-card-title">Objective Context</h3>
            <p className="about-v2-card-text">
              Each entry is distilled into an objective executive summary paired with technical significance,
              highlighting capability leaps, benchmark scores, and production readiness.
            </p>
          </div>

          <div className="about-v2-card">
            <div className="about-v2-card-icon">
              <ShieldCheck size={22} />
            </div>
            <h3 className="about-v2-card-title">Primary Attribution</h3>
            <p className="about-v2-card-text">
              No third-party hearsay or synthetic speculation. Every story preserves verified primary publisher citations,
              release notes, and direct links to origin publications.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Taxonomy & Pillars */}
      <section className="about-v2-section" aria-label="Taxonomy">
        <div className="about-v2-section-head">
          <span className="about-v2-section-kicker">Taxonomy</span>
          <h2 className="about-v2-section-title">Six Foundational Intelligence Vectors</h2>
          <p className="about-v2-section-subtitle">
            Every dispatch in the NeuBench repository is classified across six vectors to provide precision filtering:
          </p>
        </div>

        <div className="about-v2-vectors-grid">
          <div className="about-v2-vector-card">
            <div className="about-v2-vector-header">
              <Cpu size={16} className="about-v2-vector-icon" />
              <span className="about-v2-vector-badge">Models</span>
            </div>
            <h3 className="about-v2-vector-title">Frontier &amp; Open Weight Architectures</h3>
            <p className="about-v2-vector-desc">
              Major foundation model checkpoints, mixture-of-experts breakthroughs, context-window expansions,
              and open-weights releases (GPT, Gemini, Claude, Llama, DeepSeek, Qwen).
            </p>
          </div>

          <div className="about-v2-vector-card">
            <div className="about-v2-vector-header">
              <Globe size={16} className="about-v2-vector-icon" />
              <span className="about-v2-vector-badge">Products</span>
            </div>
            <h3 className="about-v2-vector-title">Applied Platforms &amp; Autonomous Agents</h3>
            <p className="about-v2-vector-desc">
              Enterprise platforms, autonomous agent runtimes, consumer assistants, and specialized vertical software
              bringing frontier models into high-throughput production.
            </p>
          </div>

          <div className="about-v2-vector-card">
            <div className="about-v2-vector-header">
              <Radio size={16} className="about-v2-vector-icon" />
              <span className="about-v2-vector-badge">Research</span>
            </div>
            <h3 className="about-v2-vector-title">Scientific Milestones &amp; Methodologies</h3>
            <p className="about-v2-vector-desc">
              Peer-reviewed breakthroughs, post-training paradigms, mechanistic interpretability, reinforcement learning,
              and domain breakthroughs in biology, mathematics, and physics.
            </p>
          </div>

          <div className="about-v2-vector-card">
            <div className="about-v2-vector-header">
              <ShieldCheck size={16} className="about-v2-vector-icon" />
              <span className="about-v2-vector-badge">Policy &amp; Safety</span>
            </div>
            <h3 className="about-v2-vector-title">Governance, Treaties &amp; Compute Geopolitics</h3>
            <p className="about-v2-vector-desc">
              Global regulatory frameworks (EU AI Act, Executive Orders), export restrictions on advanced silicon,
              frontier safety protocols, and liability precedents.
            </p>
          </div>

          <div className="about-v2-vector-card">
            <div className="about-v2-vector-header">
              <TrendingUp size={16} className="about-v2-vector-icon" />
              <span className="about-v2-vector-badge">Business</span>
            </div>
            <h3 className="about-v2-vector-title">Capital Allocation &amp; Compute Economics</h3>
            <p className="about-v2-vector-desc">
              Strategic capital rounds, hyperscaler compute commitments, data center infrastructure, M&amp;A activity,
              and changing market valuations across the ecosystem.
            </p>
          </div>

          <div className="about-v2-vector-card">
            <div className="about-v2-vector-header">
              <Wrench size={16} className="about-v2-vector-icon" />
              <span className="about-v2-vector-badge">Dev Tools &amp; Infra</span>
            </div>
            <h3 className="about-v2-vector-title">Tooling, Orchestration &amp; Frameworks</h3>
            <p className="about-v2-vector-desc">
              Inference engines, quantization tools, agent SDKs, fine-tuning libraries, and evaluation harnesses
              powering modern AI engineering workflows.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Navigation Call to Action */}
      <section className="about-v2-cta" aria-label="Explore NeuBench">
        <h2 className="about-v2-cta-title">Explore the Intelligence Radar</h2>
        <p className="about-v2-cta-text">
          Browse real-time dispatches, benchmark capability matrices, or track community consensus.
        </p>
        <div className="about-v2-cta-buttons">
          <button type="button" className="about-v2-btn-primary" onClick={onBrowseLatest}>
            <Sparkles size={15} />
            <span>Browse Latest Stories</span>
          </button>
          <Link href="/benchmarks" className="about-v2-btn-secondary">
            <BarChart2 size={15} />
            <span>Benchmark Comparator</span>
            <ArrowRight size={13} />
          </Link>
          <Link href="/explore?view=connect" className="about-v2-btn-secondary">
            <span>Feedback &amp; Connect</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </section>
    </div>
  );
}
