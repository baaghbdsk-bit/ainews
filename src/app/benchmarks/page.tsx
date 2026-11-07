import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ExploreTabs } from '@/components/explore-tabs';
import { NeubenchLoadingLogo } from '@/components/loading';

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

export default function BenchmarksPage() {
  return (
    <Suspense fallback={<NeubenchLoadingLogo variant="fullscreen" size={56} label="Loading Model Benchmarks…" />}>
      <ExploreTabs initialView="benchmarks" stories={[]} />
    </Suspense>
  );
}
