'use client';

import React from 'react';
import {
  Calendar,
  Cpu,
  Gauge,
  DollarSign,
  Layers,
  ShieldCheck,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import type { AIModelRecord } from '@/lib/benchmarks/types';
import { generationFor } from '@/lib/benchmarks/service';

interface BenchmarkSpecsTableProps {
  selectedModels: AIModelRecord[];
}

export function BenchmarkSpecsTable({ selectedModels }: BenchmarkSpecsTableProps) {
  return (
    <div
      className="specs-table-container"
      role="region"
      aria-label="Specifications and economics comparison table"
      tabIndex={0}
    >
      <table className="specs-comparison-table">
        <thead>
          <tr>
            <th scope="col" className="table-th-feature">
              Feature &amp; Metric
            </th>
            {selectedModels.map((m) => (
              <th key={m.id} scope="col" className={`table-th-model th-${m.developerColor}`}>
                <span className="table-th-model-name">
                  <span
                    className={`model-color-dot fill-${m.developerColor}`}
                    aria-hidden="true"
                  />
                  {m.name}
                </span>
                <span className="table-th-model-dev">{m.developer}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Group 1: Release & Capacity */}
          <tr className="table-group-row">
            <th colSpan={selectedModels.length + 1} scope="colgroup">
              Release &amp; Capacity
            </th>
          </tr>

          <tr>
            <th scope="row" className="table-td-feature">
              <div className="feature-title-wrap">
                <Calendar size={13} className="feature-icon feature-icon-violet" />
                <span>Release Date &amp; Generation</span>
              </div>
            </th>
            {selectedModels.map((m) => (
              <td key={m.id} className="table-td-val text-xs">
                <span className="table-td-strong">{m.specs.releaseDate}</span>
                <span className="table-td-sub">
                  {generationFor(m) === 'current' ? 'Current Generation' : 'Previous Generation'}
                </span>
              </td>
            ))}
          </tr>

          <tr>
            <th scope="row" className="table-td-feature">
              <div className="feature-title-wrap">
                <Cpu size={13} className="feature-icon feature-icon-blue" />
                <span>Context Window</span>
              </div>
            </th>
            {selectedModels.map((m) => (
              <td key={m.id} className="table-td-val table-td-numeric">
                {m.specs.displayContext}
              </td>
            ))}
          </tr>

          {/* Group 2: Capability & Economics */}
          <tr className="table-group-row">
            <th colSpan={selectedModels.length + 1} scope="colgroup">
              Capability &amp; API Economics
            </th>
          </tr>

          <tr>
            <th scope="row" className="table-td-feature">
              <div className="feature-title-wrap">
                <Gauge size={13} className="feature-icon feature-icon-amber" />
                <span>AA Intelligence Index</span>
              </div>
            </th>
            {selectedModels.map((m) => {
              const score = m.benchmarks['aa-intelligence']?.score;
              const sourceUrl = m.benchmarks['aa-intelligence']?.sourceUrl;
              return (
                <td key={m.id} className="table-td-val table-td-numeric">
                  {typeof score === 'number' ? (
                    <a href={sourceUrl} target="_blank" rel="noreferrer">
                      {score} / 100
                    </a>
                  ) : (
                    'Not reported'
                  )}
                </td>
              );
            })}
          </tr>

          <tr>
            <th scope="row" className="table-td-feature">
              <div className="feature-title-wrap">
                <DollarSign size={13} className="feature-icon feature-icon-emerald" />
                <span>Input Cost / 1M Tokens</span>
              </div>
            </th>
            {selectedModels.map((m) => (
              <td key={m.id} className="table-td-val table-td-numeric">
                {typeof m.pricing.inputPerMillion === 'number'
                  ? `$${m.pricing.inputPerMillion.toFixed(2)}`
                  : m.pricing.inputPerMillion}
              </td>
            ))}
          </tr>

          <tr>
            <th scope="row" className="table-td-feature">
              <div className="feature-title-wrap">
                <DollarSign size={13} className="feature-icon feature-icon-emerald" />
                <span>Output Cost / 1M Tokens</span>
              </div>
            </th>
            {selectedModels.map((m) => (
              <td key={m.id} className="table-td-val table-td-numeric">
                {typeof m.pricing.outputPerMillion === 'number'
                  ? `$${m.pricing.outputPerMillion.toFixed(2)}`
                  : m.pricing.outputPerMillion}
              </td>
            ))}
          </tr>

          {/* Group 3: Licensing & Catalogue Links */}
          <tr className="table-group-row">
            <th colSpan={selectedModels.length + 1} scope="colgroup">
              Licensing &amp; Catalogue Links
            </th>
          </tr>

          <tr>
            <th scope="row" className="table-td-feature">
              <div className="feature-title-wrap">
                <Layers size={13} className="feature-icon feature-icon-violet" />
                <span>License &amp; Weights</span>
              </div>
            </th>
            {selectedModels.map((m) => (
              <td key={m.id} className="table-td-val text-xs">
                <span
                  className={
                    m.specs.isOpenWeights ? 'license-open' : 'license-proprietary'
                  }
                >
                  {m.specs.isOpenWeights ? 'Open Weights' : 'Proprietary Cloud API'}
                </span>
              </td>
            ))}
          </tr>

          <tr>
            <th scope="row" className="table-td-feature">
              <span>Architecture</span>
            </th>
            {selectedModels.map((m) => (
              <td key={m.id} className="table-td-val">
                <span className="table-td-sub">
                  {m.specs.architecture || 'Dense Transformer'}
                </span>
              </td>
            ))}
          </tr>

          <tr>
            <th scope="row" className="table-td-feature">
              <div className="feature-title-wrap">
                <ShieldCheck size={13} className="feature-icon feature-icon-emerald" />
                  <span>Catalogue &amp; Documentation</span>
              </div>
            </th>
            {selectedModels.map((m) => (
              <td key={m.id} className="table-td-val text-xs">
                <div className="official-link-stack">
                  <a
                    href={m.officialSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="official-verification-link"
                    title={`View OpenRouter catalogue record: ${m.name}`}
                  >
                    <span>Catalogue</span>
                    <ExternalLink size={10} />
                  </a>
                  {m.officialDocumentationUrl && (
                    <a
                      href={m.officialDocumentationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="official-doc-link"
                      title={`View official docs: ${m.name}`}
                    >
                      <BookOpen size={10} />
                      <span>Docs</span>
                    </a>
                  )}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

