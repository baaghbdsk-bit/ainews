import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SiteHeader } from '@/app/site-header';
import { ModelBenchmarksComparator } from '@/components/model-benchmarks-comparator';
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
  const params = await searchParams;
  const initialView =
    params?.view === 'radar' ||
    params?.view === 'quadrant' ||
    params?.view === 'specs' ||
    params?.view === 'grid'
      ? params.view
      : undefined;

  return <ModelBenchmarksComparator initialView={initialView} />;
}

export default function BenchmarksPage({
  searchParams,
}: {
  searchParams?: BenchmarksSearchParams;
}) {
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

      <Suspense fallback={<ModelBenchmarksComparator />}>
        <BenchmarksView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
