import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SiteHeader } from '@/app/site-header';
import { ModelBenchmarksComparator } from '@/components/model-benchmarks-comparator';
import { getCatalogueAudit, getFreshnessAuditSummary } from '@/lib/benchmarks/service';
import './benchmarks.css';

export const metadata: Metadata = {
  title: 'AI Model Benchmark Comparison — NeuBench',
  description:
    'Compare frontier AI models side-by-side across published coding, agentic, reasoning, and mathematics benchmarks, context capacity, and API pricing.',
  alternates: {
    canonical: '/benchmarks',
  },
  openGraph: {
    title: 'AI Model Benchmark Comparison — NeuBench',
    description:
      'Compare frontier AI models side-by-side across published coding, agentic, reasoning, and mathematics benchmarks, context capacity, and API pricing.',
    type: 'website',
  },
};

type BenchmarksSearchParams = Promise<{ view?: string }>;

async function BenchmarksView({ searchParams }: { searchParams: BenchmarksSearchParams }) {
  const params = await searchParams;
  const initialView =
    params.view === 'radar' ||
    params.view === 'quadrant' ||
    params.view === 'specs' ||
    params.view === 'grid'
      ? params.view
      : undefined;

  return <ModelBenchmarksComparator initialView={initialView} audit={getFreshnessAuditSummary()} />;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.neubench.workers.dev';

const benchmarksJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'NeuBench Frontier AI Model Benchmark Index',
  description:
    'Comprehensive empirical benchmark dataset comparing frontier artificial intelligence models across coding, agentic autonomy, reasoning, mathematics, context windows, and API economics.',
  url: `${siteUrl}/benchmarks`,
  creator: {
    '@type': 'Organization',
    name: 'NeuBench',
    url: siteUrl,
  },
  keywords: [
    'AI benchmarks',
    'LLM evaluation',
    'Terminal-Bench',
    'SWE-bench Verified',
    'GPQA Diamond',
    'AIME',
    'API Pricing',
    'Frontier Models',
  ],
  variableMeasured: [
    'Terminal-Bench (Autonomous CLI Coding)',
    'SWE-bench Verified (Software Engineering)',
    'LiveCodeBench (Contamination-Resistant Coding)',
    'GPQA Diamond (Graduate Scientific Reasoning)',
    'AIME (Mathematical Reasoning)',
    'Context Window Size (Tokens)',
    'Input Token Pricing ($/M)',
    'Output Token Pricing ($/M)',
  ],
  isAccessibleForFree: true,
  license: 'https://creativecommons.org/licenses/by/4.0/',
};

export default function BenchmarksPage({
  searchParams,
}: {
  searchParams: BenchmarksSearchParams;
}) {
  const shellAudit = getCatalogueAudit();

  return (
    <main className="site-frame archive-page benchmarks-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(benchmarksJsonLd) }}
      />
      <SiteHeader className="story-article-topbar" />
      <Suspense fallback={<ModelBenchmarksComparator audit={shellAudit} />}>
        <BenchmarksView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
