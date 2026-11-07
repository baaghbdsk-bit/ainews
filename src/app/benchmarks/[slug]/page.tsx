import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/app/site-header';
import {
  parseComparisonSlug,
  analyzeComparison,
  getCuratedComparisonSlugs,
} from '@/lib/benchmarks/comparison';
import './comparison.css';

interface ComparisonPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getCuratedComparisonSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ComparisonPageProps): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseComparisonSlug(slug);

  if (!parsed || !parsed.modelA || !parsed.modelB) {
    return {
      title: 'Model Comparison — NeuBench',
    };
  }

  const { modelA, modelB } = parsed;
  const title = `${modelA.name} vs ${modelB.name} Benchmarks Comparison & Pricing — NeuBench`;
  const description = `Direct comparison between ${modelA.name} and ${modelB.name}. Compare benchmark scores across coding, reasoning, mathematics, context window (${modelA.specs.displayContext} vs ${modelB.specs.displayContext}), and API pricing.`;

  return {
    title,
    description,
    keywords: [
      `${modelA.name} vs ${modelB.name}`,
      `${modelA.name} benchmark`,
      `${modelB.name} benchmark`,
      'LLM comparison',
      'AI model benchmarks',
      'coding benchmark',
      'API pricing comparison',
      modelA.name,
      modelB.name,
      modelA.developer,
      modelB.developer,
    ],
    alternates: {
      canonical: `/benchmarks/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/benchmarks/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function ModelComparisonPage({ params }: ComparisonPageProps) {
  const { slug } = await params;
  const parsed = parseComparisonSlug(slug);

  if (!parsed || !parsed.modelA || !parsed.modelB) {
    notFound();
  }

  const analysis = analyzeComparison(parsed.modelA, parsed.modelB);
  const { modelA, modelB } = analysis;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://app.neubench.workers.dev',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Benchmarks',
        item: 'https://app.neubench.workers.dev/benchmarks',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${modelA.name} vs ${modelB.name}`,
        item: `https://app.neubench.workers.dev/benchmarks/${slug}`,
      },
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: analysis.faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <main className="comparison-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <SiteHeader />

      <div className="comparison-container">
        {/* Breadcrumb Navigation */}
        <nav className="comparison-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/home">Home</Link>
          <span className="sep">/</span>
          <Link href="/benchmarks">Benchmarks</Link>
          <span className="sep">/</span>
          <span>
            {modelA.name} vs {modelB.name}
          </span>
        </nav>

        {/* Hero Section */}
        <section className="comparison-hero">
          <div className="comparison-badge">Frontier Model Comparison</div>
          <h1 className="comparison-title">
            {modelA.name} vs {modelB.name}
          </h1>
          <p className="comparison-subtitle">
            Compare performance benchmarks, coding intelligence, reasoning evaluations, context
            limits, and API economics between {modelA.name} ({modelA.developer}) and {modelB.name} (
            {modelB.developer}).
          </p>
        </section>

        {/* Scoreboard Tally */}
        <section className="comparison-scoreboard">
          <div className={`score-card ${analysis.winsA > analysis.winsB ? 'lead' : ''}`}>
            <span className="score-card-developer">{modelA.developer}</span>
            <span className="score-card-name">{modelA.name}</span>
            <div className="score-card-tally">
              <span className="tally-number">{analysis.winsA}</span>
              <span className="tally-label">benchmark leads</span>
            </div>
          </div>

          <div className="score-card">
            <span className="score-card-developer">Evaluation Balance</span>
            <span className="score-card-name">Ties / On-Par</span>
            <div className="score-card-tally">
              <span className="tally-number">{analysis.ties}</span>
              <span className="tally-label">equivalent metrics</span>
            </div>
          </div>

          <div className={`score-card ${analysis.winsB > analysis.winsA ? 'lead' : ''}`}>
            <span className="score-card-developer">{modelB.developer}</span>
            <span className="score-card-name">{modelB.name}</span>
            <div className="score-card-tally">
              <span className="tally-number">{analysis.winsB}</span>
              <span className="tally-label">benchmark leads</span>
            </div>
          </div>
        </section>

        {/* Core Specifications Table */}
        <section className="comparison-section">
          <h2 className="section-title">Specifications & Architecture</h2>
          <div className="specs-table-wrapper">
            <table className="specs-table">
              <thead>
                <tr>
                  <th>Metric / Capability</th>
                  <th>{modelA.name}</th>
                  <th>{modelB.name}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Developer / Organization</td>
                  <td><strong>{modelA.developer}</strong></td>
                  <td><strong>{modelB.developer}</strong></td>
                </tr>
                <tr>
                  <td>Release Date</td>
                  <td>{modelA.specs.releaseDate}</td>
                  <td>{modelB.specs.releaseDate}</td>
                </tr>
                <tr>
                  <td>Deployment / Weights</td>
                  <td>
                    {modelA.specs.isOpenWeights ? 'Open Weights' : 'Proprietary Cloud API'}
                  </td>
                  <td>
                    {modelB.specs.isOpenWeights ? 'Open Weights' : 'Proprietary Cloud API'}
                  </td>
                </tr>
                <tr>
                  <td>Context Window</td>
                  <td>
                    <strong>{modelA.specs.displayContext}</strong> ({modelA.specs.contextWindowTokens.toLocaleString()} tokens)
                  </td>
                  <td>
                    <strong>{modelB.specs.displayContext}</strong> ({modelB.specs.contextWindowTokens.toLocaleString()} tokens)
                  </td>
                </tr>
                <tr>
                  <td>Input Pricing (/1M Tokens)</td>
                  <td>
                    {typeof modelA.pricing.inputPerMillion === 'number'
                      ? `$${modelA.pricing.inputPerMillion}`
                      : modelA.pricing.inputPerMillion ?? 'N/A'}
                  </td>
                  <td>
                    {typeof modelB.pricing.inputPerMillion === 'number'
                      ? `$${modelB.pricing.inputPerMillion}`
                      : modelB.pricing.inputPerMillion ?? 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td>Output Pricing (/1M Tokens)</td>
                  <td>
                    {typeof modelA.pricing.outputPerMillion === 'number'
                      ? `$${modelA.pricing.outputPerMillion}`
                      : modelA.pricing.outputPerMillion ?? 'N/A'}
                  </td>
                  <td>
                    {typeof modelB.pricing.outputPerMillion === 'number'
                      ? `$${modelB.pricing.outputPerMillion}`
                      : modelB.pricing.outputPerMillion ?? 'N/A'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Benchmark Scores Head to Head */}
        <section className="comparison-section">
          <h2 className="section-title">Head-to-Head Benchmark Scores</h2>
          <div className="benchmarks-table-wrapper">
            <table className="specs-table">
              <thead>
                <tr>
                  <th>Benchmark / Domain</th>
                  <th>{modelA.name}</th>
                  <th>{modelB.name}</th>
                  <th>Advantage</th>
                </tr>
              </thead>
              <tbody>
                {analysis.benchmarks.map((bm) => (
                  <tr key={bm.benchmarkId}>
                    <td>
                      <div className="benchmark-row-header">{bm.name}</div>
                      {bm.description && (
                        <div className="benchmark-row-desc">{bm.description}</div>
                      )}
                    </td>
                    <td className={`score-cell ${bm.winner === 'A' ? 'winner' : ''}`}>
                      {bm.displayA ?? '—'}
                    </td>
                    <td className={`score-cell ${bm.winner === 'B' ? 'winner' : ''}`}>
                      {bm.displayB ?? '—'}
                    </td>
                    <td>
                      {bm.winner === 'A' && (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>
                          {modelA.name} {bm.marginPercent ? `(+${bm.marginPercent}%)` : 'leads'}
                        </span>
                      )}
                      {bm.winner === 'B' && (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>
                          {modelB.name} {bm.marginPercent ? `(+${bm.marginPercent}%)` : 'leads'}
                        </span>
                      )}
                      {bm.winner === 'tie' && <span style={{ color: 'var(--fg-muted)' }}>On par</span>}
                      {bm.winner === 'none' && <span style={{ color: 'var(--fg-muted)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Dynamic FAQ Section */}
        <section className="comparison-section">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="faq-list">
            {analysis.faqItems.map((faq, idx) => (
              <div key={idx} className="faq-card">
                <h3 className="faq-question">{faq.question}</h3>
                <p className="faq-answer">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related Comparisons (Internal Linking) */}
        {analysis.relatedSlugs.length > 0 && (
          <section className="comparison-section">
            <h2 className="section-title">Explore Related Comparisons</h2>
            <div className="related-grid">
              {analysis.relatedSlugs.map((rel) => (
                <Link
                  key={rel.slug}
                  href={`/benchmarks/${rel.slug}`}
                  className="related-card"
                >
                  <span>{rel.label}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Interactive CTA */}
        <div className="comparison-cta">
          <h2 className="comparison-cta-title">Explore Multi-Model Benchmarks</h2>
          <p className="comparison-cta-desc">
            Analyze 130+ models side-by-side using interactive radar charts, cost-efficiency quadrant
            plots, and live dataset filters on the full NeuBench index.
          </p>
          <Link href="/benchmarks" className="comparison-cta-btn">
            Open Interactive Comparator
          </Link>
        </div>
      </div>
    </main>
  );
}
