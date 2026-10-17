import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { DossierBlock } from '@/lib/dossier/schema';
import type { DossierSourceView } from '@/lib/actions/dossiers';
import { slugify } from '@/lib/slug';

/**
 * Renders a dossier's typed blocks.
 *
 * Kept as a plain server component with no client JavaScript: the article is
 * static content, anchors and citation links work without hydration, and there
 * is nothing here that can mismatch between server and client render.
 */

const CITATION = /\[(\d{1,3})\]/g;

export interface OutlineEntry {
  blockIndex: number;
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Section anchors for the table of contents. Ids are derived from the heading
 * text (de-duplicated) so a regenerated dossier keeps stable, linkable
 * sections.
 */
export function buildOutline(blocks: DossierBlock[]): OutlineEntry[] {
  const used = new Map<string, number>();
  const outline: OutlineEntry[] = [];

  blocks.forEach((block, blockIndex) => {
    if (block.type !== 'heading') return;
    const base = slugify(block.text) || `section-${blockIndex}`;
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    outline.push({
      blockIndex,
      id: seen === 0 ? base : `${base}-${seen}`,
      text: block.text,
      level: block.level,
    });
  });

  return outline;
}

/**
 * Splits text on `[n]` markers and renders each as a superscript link to the
 * matching entry in the sources list. A marker with no matching source is left
 * as plain text rather than becoming a dead link.
 */
function CitedText({
  text,
  sources,
}: {
  text: string;
  sources: Map<number, DossierSourceView>;
}) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of text.matchAll(CITATION)) {
    const index = Number(match[1]);
    const source = sources.get(index);
    if (!source) continue;

    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <a
        key={`cite-${key++}`}
        className="dossier-cite"
        href={`#source-${index}`}
        aria-label={`Source ${index}: ${source.title}`}
      >
        [{index}]
      </a>,
    );
    cursor = start + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

export function DossierBody({
  blocks,
  sources,
  outline,
}: {
  blocks: DossierBlock[];
  sources: DossierSourceView[];
  outline: OutlineEntry[];
}) {
  const byIndex = new Map(sources.map((source) => [source.index, source]));
  const anchorById = new Map(outline.map((entry) => [entry.blockIndex, entry.id]));

  return (
    <div className="dossier-body">
      {blocks.map((block, blockIndex) => {
        switch (block.type) {
          case 'heading': {
            const id = anchorById.get(blockIndex);
            return block.level === 3 ? (
              <h3 key={blockIndex} id={id}>
                {block.text}
              </h3>
            ) : (
              <h2 key={blockIndex} id={id}>
                {block.text}
              </h2>
            );
          }
          case 'paragraph':
            return (
              <p key={blockIndex}>
                <CitedText text={block.text} sources={byIndex} />
              </p>
            );
          case 'list':
            return (
              <ul key={blockIndex} className="dossier-list">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <CitedText text={item} sources={byIndex} />
                  </li>
                ))}
              </ul>
            );
          case 'quote': {
            const source = byIndex.get(block.index);
            return (
              <blockquote key={blockIndex} className="dossier-quote">
                <p>“{block.text}”</p>
                {source ? (
                  <cite>
                    <a href={`#source-${source.index}`}>{source.source}</a>
                    <span> · {source.eventDate}</span>
                  </cite>
                ) : null}
              </blockquote>
            );
          }
          case 'keyfacts':
            return (
              <aside key={blockIndex} className="dossier-keyfacts" aria-label="Key facts">
                <h2>Key facts</h2>
                <dl>
                  {block.facts.map((fact, factIndex) => (
                    <div key={factIndex}>
                      <dt>{fact.label}</dt>
                      <dd>
                        {fact.value}
                        {fact.index && byIndex.has(fact.index) ? (
                          <a className="dossier-cite" href={`#source-${fact.index}`}>
                            [{fact.index}]
                          </a>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </aside>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export function DossierToc({ outline }: { outline: OutlineEntry[] }) {
  if (outline.length === 0) return null;

  return (
    <nav className="dossier-toc" aria-label="Contents">
      <p className="dossier-toc-label">Contents</p>
      <ol>
        {outline.map((entry) => (
          <li key={entry.id} data-level={entry.level}>
            <a href={`#${entry.id}`}>{entry.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function DossierSources({ sources }: { sources: DossierSourceView[] }) {
  if (sources.length === 0) return null;

  return (
    <section className="dossier-sources" aria-label="Sources">
      <h2>Sources</h2>
      <ol>
        {sources.map((source) => (
          <li key={source.storyId} id={`source-${source.index}`}>
            <span className="dossier-source-marker">[{source.index}]</span>
            <span className="dossier-source-body">
              <Link href={source.url}>{source.title}</Link>
              <span className="dossier-source-meta">
                {source.source} · {source.eventDate}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="dossier-source-note">
        Read the original reporting{' '}
        <ArrowUpRight size={12} aria-hidden="true" /> via each story page.
      </p>
    </section>
  );
}
