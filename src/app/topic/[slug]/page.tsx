import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Sparkles } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getDossierBySlug } from '@/lib/actions/dossiers';
import { getStoriesByEntityTerms } from '@/lib/actions/stories';
import { ENTITIES, findEntity } from '@/lib/dossier/entities';
import { buildOutline, DossierBody, DossierSources, DossierToc } from '@/components/dossier/dossier-article';
import { SiteHeader } from '../../site-header';

/**
 * A dossier page: a long-form, cited article about one entity, built from the
 * stories we have already ingested.
 *
 * Everything on the page traces back to a source story — the writer may only
 * cite the numbered list it was given, and any marker pointing outside it is
 * stripped before storage. The page says so explicitly, because a reader should
 * know this is synthesis with sources, not first-hand reporting.
 */

export const instant = false;

// Wait for the static result on unlisted slugs instead of serving the App
// Shell: an unknown topic then returns a real 404 (not a streamed 200) on the
// first request. Requires generateStaticParams below and all route data cached.
export const ensureStatic = 'navigation';

export function generateStaticParams(): { slug: string }[] {
  return ENTITIES.map(({ slug }) => ({ slug }));
}

type TopicPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const dossier = await getDossierBySlug(slug);
    if (dossier) {
      return {
        title: `${dossier.title} | NeuBench`,
        description: dossier.subtitle || undefined,
        alternates: { canonical: `/topic/${slug}` },
      };
    }
  } catch {
    // Supabase may be unavailable while prerendering; fall through to the entity.
  }

  const entity = findEntity(slug);
  if (!entity) notFound();
  return {
    title: `${entity.label} | NeuBench`,
    description: entity.about,
    alternates: { canonical: `/topic/${slug}` },
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  const name = MONTHS[Number(month) - 1] ?? '';
  return `${name} ${Number(day)}, ${year}`;
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { slug } = await params;

  const entity = findEntity(slug);
  const dossier = await getDossierBySlug(slug);

  // No dossier (or empty blocks): known entities get a hub page listing the
  // matching stories, so the topic chips on story pages never 404. Unknown
  // slugs are a real 404.
  if (!dossier || dossier.blocks.length === 0) {
    if (!entity) notFound();
    const stories = await getStoriesByEntityTerms(entity.terms);
    return (
      <main className="site-frame archive-page dossier-page">
        <SiteHeader
          className="dossier-topbar"
          right={
            <Link className="topbar-link" href="/">
              <ArrowLeft size={15} /> Back to timeline
            </Link>
          }
        />
        <article className="dossier">
          <div className="dossier-hero">
            <p className="dossier-kicker">
              <Sparkles size={13} aria-hidden="true" />
              {entity.label} · Topic
            </p>
            <h1>{entity.label}</h1>
            <p className="dossier-standfirst">{entity.about}</p>
            <p className="dossier-meta">
              {stories.length} {stories.length === 1 ? 'story' : 'stories'} on the timeline
            </p>
          </div>
          <div className="entity-hub-list">
            {stories.length === 0 ? (
              <p className="entity-hub-empty">No stories on the timeline mention {entity.label} yet.</p>
            ) : (
              <ul>
                {stories.map((story) => (
                  <li key={story.id}>
                    <Link href={`/story/${story.slug}`}>
                      <time dateTime={story.event_date}>{formatDate(story.event_date)}</time>
                      <span className="entity-hub-title">{story.title}</span>
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </main>
    );
  }

  const outline = buildOutline(dossier.blocks);

  // The sources are ordered newest-first, so the ends of the list are the span
  // of coverage this article is drawn from.
  const dates = dossier.sources.map((source) => source.eventDate).sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  return (
    <main className="site-frame archive-page dossier-page">
      <SiteHeader
        className="dossier-topbar"
        right={
          <Link className="topbar-link" href="/">
            <ArrowLeft size={15} /> Back to timeline
          </Link>
        }
      />

      <article className="dossier">
        <div className="dossier-hero">
          <p className="dossier-kicker">
            <Sparkles size={13} aria-hidden="true" />
            {entity ? entity.label : 'Topic'} · Topic dossier
          </p>

          <h1>{dossier.title}</h1>

          {dossier.subtitle ? <p className="dossier-standfirst">{dossier.subtitle}</p> : null}

          <p className="dossier-meta">
            {dossier.sources.length} sources
            {firstDate && lastDate ? (
              <>
                {' '}· {formatDate(firstDate)} – {formatDate(lastDate)}
              </>
            ) : null}
            {dossier.llmModel ? <> · written by {dossier.llmModel}</> : null}
          </p>
        </div>

        <div className="dossier-layout">
          <DossierToc outline={outline} />

          <div className="dossier-column">
            <DossierBody blocks={dossier.blocks} sources={dossier.sources} outline={outline} />

            <DossierSources sources={dossier.sources} />

            <p className="dossier-disclaimer">
              This dossier is synthesized from the stories listed above. Every claim is cited;
              follow a source link to read the original reporting.
            </p>
          </div>
        </div>
      </article>
    </main>
  );
}
