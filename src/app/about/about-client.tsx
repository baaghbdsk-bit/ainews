"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Code2,
  Cpu,
  Globe,
  Layers,
  Mail,
  Radio,
  Rss,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { SiteHeader } from "../site-header";
import { useTheme } from "@/lib/theme";

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export function AboutClient() {
  const [isLight, toggleTheme] = useTheme();

  // Form submission state for story tip / feedback
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    url: "",
    title: "",
    topic: "Models",
    note: "",
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.url && !formData.title && !formData.note) return;
    setFormSubmitted(true);
  };

  return (
    <main className="site-frame archive-page about-page">
      <SiteHeader
        className="about-topbar"
        right={
          <div className="about-topbar-actions">
            <Link className="topbar-link" href="/" title="Back to timeline">
              <ArrowLeft size={15} />
              <span>Back to timeline</span>
            </Link>
            <button
              aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
              aria-pressed={isLight}
              className="header-icon-button"
              onClick={toggleTheme}
              title={isLight ? "Dark theme" : "Light theme"}
              type="button"
            >
              <Sun size={17} />
            </button>
          </div>
        }
      />

      <div className="about-container">
        {/* Hero Section */}
        <section className="about-hero" aria-label="About Signal">
          <div className="about-kicker">
            <Sparkles size={13} aria-hidden="true" />
            <span>Chronological Intelligence</span>
          </div>
          <h1 className="about-title">
            Documenting the arc of{" "}
            <span className="about-title-accent">artificial intelligence.</span>
          </h1>
          <p className="about-lede">
            Signal is a living historical index and real-time radar tracking the pivotal releases,
            architectural leaps, and regulatory shifts defining synthetic intelligence.
          </p>
        </section>

        {/* Stats Grid */}
        <section className="about-stats-grid" aria-label="Signal at a glance">
          <div className="about-stat-card">
            <div className="about-stat-value">4 Pillars</div>
            <div className="about-stat-label">Systematic taxonomy</div>
            <div className="about-stat-desc">Models, Products, Research, and Policy covering the full spectrum.</div>
          </div>
          <div className="about-stat-card">
            <div className="about-stat-value">20+ Feeds</div>
            <div className="about-stat-label">Primary sources</div>
            <div className="about-stat-desc">Continuous ingestion directly from OpenAI, DeepMind, Anthropic, Meta, and arXiv.</div>
          </div>
          <div className="about-stat-card">
            <div className="about-stat-value">4+ Years</div>
            <div className="about-stat-label">Historical depth</div>
            <div className="about-stat-desc">From early foundation models to unified multi-modal reasoning agents.</div>
          </div>
          <div className="about-stat-card">
            <div className="about-stat-value">100% Sourced</div>
            <div className="about-stat-label">Zero hallucinations</div>
            <div className="about-stat-desc">Every moment links directly to verified whitepapers and official releases.</div>
          </div>
        </section>

        {/* Mission & Purpose */}
        <section className="about-section" aria-label="Why Signal exists">
          <div className="about-section-header">
            <span className="about-section-kicker">Our Purpose</span>
            <h2 className="about-section-title">The signal vs. noise problem</h2>
            <p className="about-section-desc">
              The velocity of AI advancement is without precedent. Hundreds of announcements, academic preprints,
              and speculative takes flood the web weekly. Critical shifts get buried in ephemeral social media feeds.
            </p>
          </div>

          <div className="about-mission-grid">
            <div className="about-feature-card">
              <div className="about-feature-icon">
                <Layers size={22} />
              </div>
              <h3 className="about-feature-title">Chronological Continuum</h3>
              <p className="about-feature-text">
                Rather than treating news as disposable updates, Signal organizes milestones into a permanent,
                browsable continuum where historical cause and effect remain clear.
              </p>
            </div>

            <div className="about-feature-card">
              <div className="about-feature-icon">
                <BookOpen size={22} />
              </div>
              <h3 className="about-feature-title">Objective Context</h3>
              <p className="about-feature-text">
                Each entry is synthesized into an objective summary paired with a focused &ldquo;Why It Matters&rdquo;
                analysis, highlighting technical capability leaps and strategic industry ramifications.
              </p>
            </div>

            <div className="about-feature-card">
              <div className="about-feature-icon">
                <ShieldCheck size={22} />
              </div>
              <h3 className="about-feature-title">Primary Attribution</h3>
              <p className="about-feature-text">
                No third-party hearsay or synthetic hallucinations. Every timeline moment preserves verified citations,
                publisher metadata, and direct links to original release notes and research papers.
              </p>
            </div>
          </div>
        </section>

        {/* The Four Core Pillars */}
        <section className="about-section" aria-label="Taxonomy and Pillars">
          <div className="about-section-header">
            <span className="about-section-kicker">Taxonomy</span>
            <h2 className="about-section-title">Organized across four foundational pillars</h2>
            <p className="about-section-desc">
              To cut through surface-level noise, every story in the Signal archive is categorized
              across four distinct vectors:
            </p>
          </div>

          <div className="about-pillars-grid">
            <div className="about-pillar-card pillar-models">
              <div className="about-pillar-header">
                <span className="about-pillar-badge">
                  <Cpu size={14} /> Models
                </span>
              </div>
              <h3 className="about-pillar-title">Frontier &amp; Open Weight Architectures</h3>
              <p className="about-pillar-desc">
                Major foundation model releases, hybrid reasoning systems, mixture-of-experts breakthroughs,
                context-window expansions, and open-weights competition (GPT, Gemini, Claude, Llama, DeepSeek, Grok).
              </p>
              <div className="about-pillar-examples">
                <span className="about-pillar-tag">Reasoning Systems</span>
                <span className="about-pillar-tag">Multi-Modal Models</span>
                <span className="about-pillar-tag">Open Weights</span>
              </div>
            </div>

            <div className="about-pillar-card pillar-products">
              <div className="about-pillar-header">
                <span className="about-pillar-badge">
                  <Globe size={14} /> Products
                </span>
              </div>
              <h3 className="about-pillar-title">Applied Platforms &amp; Developer Tooling</h3>
              <p className="about-pillar-desc">
                Consumer assistants, enterprise integrations, autonomous software agents, developer APIs,
                and specialized vertical software bringing frontier models into production workflows.
              </p>
              <div className="about-pillar-examples">
                <span className="about-pillar-tag">Autonomous Agents</span>
                <span className="about-pillar-tag">Developer APIs</span>
                <span className="about-pillar-tag">Enterprise Workflows</span>
              </div>
            </div>

            <div className="about-pillar-card pillar-research">
              <div className="about-pillar-header">
                <span className="about-pillar-badge">
                  <Radio size={14} /> Research
                </span>
              </div>
              <h3 className="about-pillar-title">Scientific Milestones &amp; Architecture</h3>
              <p className="about-pillar-desc">
                Peer-reviewed breakthroughs, post-training paradigms, mechanistic interpretability,
                reinforcement learning innovations, and domain-specific advances in biology, chemistry, and physics (AlphaFold, diffusion).
              </p>
              <div className="about-pillar-examples">
                <span className="about-pillar-tag">Mechanistic Interpretability</span>
                <span className="about-pillar-tag">Synthetic Biology</span>
                <span className="about-pillar-tag">Scaling Laws</span>
              </div>
            </div>

            <div className="about-pillar-card pillar-policy">
              <div className="about-pillar-header">
                <span className="about-pillar-badge">
                  <ShieldCheck size={14} /> Policy
                </span>
              </div>
              <h3 className="about-pillar-title">Governance, Treaties &amp; Compute Geopolitics</h3>
              <p className="about-pillar-desc">
                Global regulatory frameworks (EU AI Act, Executive Orders), export restrictions on advanced silicon,
                national compute clusters, liability precedents, and institutional safety commitments.
              </p>
              <div className="about-pillar-examples">
                <span className="about-pillar-tag">EU AI Act</span>
                <span className="about-pillar-tag">Compute Infrastructure</span>
                <span className="about-pillar-tag">Export Controls</span>
              </div>
            </div>
          </div>
        </section>

        {/* Connect & Contact Options */}
        <section className="about-section" id="connect" aria-label="Connect with Signal">
          <div className="about-section-header">
            <span className="about-section-kicker">Connect &amp; Collaborate</span>
            <h2 className="about-section-title">Get Connected</h2>
            <p className="about-section-desc">
              Whether you are an AI researcher, founder, journalist, or reader with an archive tip,
              we welcome collaboration, questions, and feedback.
            </p>
          </div>

          <div className="connect-card connect-card-expanded">
            <div className="connect-card-head">
              <div className="connect-card-icon">
                <Code2 size={22} />
              </div>
              <div>
                <h3 className="connect-card-title">Get Connected</h3>
                <p className="connect-card-desc">
                  Access the archive programmatically, follow along on socials, explore the open-source code, or reach out directly.
                </p>
              </div>
            </div>

            <div className="connect-channels-grid">
              <a
                className="connect-channel-button"
                href="/api/stories"
                rel="noreferrer"
                target="_blank"
              >
                <Rss size={16} />
                <span>Stories API</span>
                <ArrowUpRight size={13} style={{ marginLeft: "auto", opacity: 0.6 }} />
              </a>

              <a
                className="connect-channel-button"
                href="https://github.com/baaghbdsk-bit/ainews"
                rel="noreferrer"
                target="_blank"
              >
                <GithubIcon size={16} />
                <span>GitHub</span>
                <ArrowUpRight size={13} style={{ marginLeft: "auto", opacity: 0.6 }} />
              </a>

              <a
                className="connect-channel-button"
                href="https://www.instagram.com/itsvivek982/"
                rel="noreferrer"
                target="_blank"
              >
                <InstagramIcon size={16} />
                <span>Instagram</span>
                <ArrowUpRight size={13} style={{ marginLeft: "auto", opacity: 0.6 }} />
              </a>

              <a
                className="connect-channel-button"
                href="mailto:gvivek982+signalaifeed@gmail.com"
              >
                <Mail size={16} />
                <span>Email</span>
                <ArrowUpRight size={13} style={{ marginLeft: "auto", opacity: 0.6 }} />
              </a>
            </div>
          </div>

          {/* Interactive Story Tip / Submission Form */}
          <div className="connect-feedback-card">
            <div className="connect-feedback-header">
              <h3 className="connect-feedback-title">Suggest a Story or Submit a Milestone</h3>
              <p className="connect-feedback-desc">
                Know of a frontier model launch, seminal paper, or policy update that belongs on the Signal timeline?
                Submit it below for editorial review.
              </p>
            </div>

            {formSubmitted ? (
              <div className="connect-success-box" role="status">
                <CheckCircle2 color="#10B981" size={26} />
                <div>
                  <strong style={{ display: "block", fontSize: 15, marginBottom: 2 }}>
                    Milestone tip received!
                  </strong>
                  <span style={{ fontSize: 13, color: "var(--shell-muted)" }}>
                    Thank you for contributing to the Signal archive. Our editorial ingestion team will review the citation.
                  </span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit}>
                <div className="connect-form-grid">
                  <div className="connect-form-field">
                    <label className="connect-form-label" htmlFor="tip-url">
                      Source / Announcement URL
                    </label>
                    <input
                      className="connect-form-input"
                      id="tip-url"
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://blog.google/... or https://arxiv.org/..."
                      required
                      type="url"
                      value={formData.url}
                    />
                  </div>

                  <div className="connect-form-field">
                    <label className="connect-form-label" htmlFor="tip-category">
                      Category
                    </label>
                    <select
                      className="connect-form-select"
                      id="tip-category"
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      value={formData.topic}
                    >
                      <option value="Models">Models</option>
                      <option value="Products">Products</option>
                      <option value="Research">Research</option>
                      <option value="Policy">Policy</option>
                    </select>
                  </div>

                  <div className="connect-form-field full-width">
                    <label className="connect-form-label" htmlFor="tip-title">
                      Story Title / Breakthrough Summary
                    </label>
                    <input
                      className="connect-form-input"
                      id="tip-title"
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. Anthropic announces Claude 3.7 hybrid reasoning model"
                      required
                      type="text"
                      value={formData.title}
                    />
                  </div>

                  <div className="connect-form-field full-width">
                    <label className="connect-form-label" htmlFor="tip-notes">
                      Why does it matter? (Optional)
                    </label>
                    <textarea
                      className="connect-form-textarea"
                      id="tip-notes"
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      placeholder="What capability leap or strategic implication makes this significant?"
                      value={formData.note}
                    />
                  </div>
                </div>

                <button className="connect-form-submit" type="submit">
                  <Send size={15} />
                  <span>Submit to Archive</span>
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

