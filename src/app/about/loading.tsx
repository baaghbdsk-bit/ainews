import { LoadingSpinner } from '@/components/loading';

/**
 * Shown while the about page resolves.
 */
export default function AboutLoading() {
  return (
    <main className="site-frame archive-page archive-page about-page">
      <div className="about-container">
        <LoadingSpinner label="Loading" />
      </div>
    </main>
  );
}
