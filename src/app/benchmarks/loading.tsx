import { LoadingSpinner } from '@/components/loading';

/**
 * Shown while the benchmarks catalogue resolves.
 */
export default function BenchmarksLoading() {
  return (
    <main className="site-frame archive-page benchmarks-page">
      <div className="bench-loading-shell" role="status" aria-live="polite" aria-busy="true">
        <span className="bench-loading-pulse" aria-hidden="true" />
        <span>Loading benchmark catalogue</span>
      </div>
    </main>
  );
}
