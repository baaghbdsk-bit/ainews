import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
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

async function BenchmarksView({ searchParams }: { searchParams?: BenchmarksSearchParams }) {
  // Reading the clock is only allowed at request time. The static shell uses
  // the data-derived audit; this part opts into dynamic rendering first.
  await connection();

  const params = await searchParams;
  const initialView =
    params?.view === 'radar' ||
    params?.view === 'quadrant' ||
    params?.view === 'specs' ||
    params?.view === 'grid'
      ? params.view
      : undefined;

  // Read the clock here, inside the streamed part of the route. The page
  // shell is prerendered, and a Date.now() there would make the output
  // unstable and fail the build.
  return <ModelBenchmarksComparator initialView={initialView} audit={getFreshnessAuditSummary()} />;
}

export default function BenchmarksPage({
  searchParams,
}: {
  searchParams?: BenchmarksSearchParams;
}) {
  // The static shell gets the deterministic audit (no age); the streamed view
  // below measures the age on the server.
  const shellAudit = getCatalogueAudit();

  return (
    <main className="site-frame archive-page benchmarks-page">
      <SiteHeader
        className="story-article-topbar"
        right={
          <div className="header-actions">
            <Link className="story-back-link" href="/">
              <ArrowLeft size={16} />
              <span>Back to timeline</span>
            </Link>
          </div>
        }
      />

      <Suspense fallback={<ModelBenchmarksComparator audit={shellAudit} />}>
        <BenchmarksView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
