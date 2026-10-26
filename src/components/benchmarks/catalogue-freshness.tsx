import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { CatalogueAudit } from '@/lib/benchmarks/service';

/** "2026-10-17" -> "17 Oct 2026". */
const formatFreshnessDate = (iso: string) => {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return new Date(parsed).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export interface CatalogueFreshnessAudit extends CatalogueAudit {
  /** Present only when the age was measured on the server. */
  catalogueAgeDays?: number;
  stale?: boolean;
}

/**
 * Catalogue freshness indicator.
 *
 * "Newest model" and the date come from the data, so they render on the
 * server. The age in days needs the current clock, so the server measures it
 * and passes it down — computing it here would make the server render and
 * hydration disagree, and would make the page unprerenderable.
 */
export function CatalogueFreshness({ audit }: { audit: CatalogueFreshnessAudit }) {
  const age = audit.catalogueAgeDays;
  const stale = audit.stale === true;

  return (
    <div
      className="audit-freshness"
      title={`Catalogue snapshot: ${audit.lastAuditedDate}. Newest model release: ${audit.newestModelReleaseDate}. Regenerated from the live OpenRouter and BenchLM catalogues.`}
    >
      {stale ? <AlertCircle size={13} className="text-amber-400" /> : <CheckCircle2 size={13} className="text-emerald-400" />}
        <span>
          Catalogue audited {formatFreshnessDate(audit.lastAuditedDate)}
          {typeof age === 'number' && age >= 0 ? ` (${age}d)` : ''}
        </span>
    </div>
  );
}
