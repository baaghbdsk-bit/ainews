import { SiteHeader } from '@/app/site-header';
import { NeubenchSpinner, NeubenchLoadingLogo } from '@/components/loading';
import './benchmarks.css';

/**
 * NeuBench unified loading experience for the benchmarks catalogue.
 * Displays both the sticky top progress bar and the 3-color circular brand spinner.
 */
export default function BenchmarksLoading() {
  return (
    <>
      <div className="neubench-top-loading-bar" role="status" aria-live="polite">
        <NeubenchSpinner size={16} strokeWidth={4.5} />
        <span>Loading Frontier Benchmark Index &amp; Models…</span>
      </div>

      <main className="site-frame archive-page benchmarks-page">
        <SiteHeader className="story-article-topbar" />

        <div className="bench-loading-shell" role="status" aria-live="polite" aria-busy="true">
          <NeubenchLoadingLogo
            variant="panel"
            size={48}
            label="Loading Frontier Benchmark Index & Empirical Model Evaluations…"
          />
        </div>
      </main>
    </>
  );
}
