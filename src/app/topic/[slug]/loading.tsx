import { LoadingSpinner } from '@/components/loading';
import { SiteHeader } from '@/app/site-header';

/**
 * Shown while the topic hub resolves its dossier and story list.
 */
export default function TopicLoading() {
  return (
    <main className="site-frame archive-page dossier-page">
      <SiteHeader className="dossier-topbar" />
      <div className="about-container">
        <LoadingSpinner label="Loading topic" />
      </div>
    </main>
  );
}
