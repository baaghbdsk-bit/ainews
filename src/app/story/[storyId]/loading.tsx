import { LoadingSpinner } from '@/components/loading';
import { SiteHeader } from '@/app/site-header';

/**
 * Shown while the article resolves. The page streams in its content behind
 * this, so the reader sees a spinner rather than a blank frame. The shell
 * matches the real page so nothing jumps when the content arrives.
 */
export default function StoryLoading() {
  return (
    <main className="site-frame archive-page story-article-page">
      <SiteHeader className="story-article-topbar" />
      <article className="story-article">
        <LoadingSpinner label="Opening article" />
      </article>
    </main>
  );
}
