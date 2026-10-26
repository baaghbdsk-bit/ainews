# Benchmark data pipeline

The `/benchmarks` page is backed by the generated catalogue at
`src/lib/benchmarks/data.ts`. It is deliberately not populated with guessed
scores: a model remains visible with `Not reported` until a supported source
publishes a result.

## Sources

| Data | Source | Update path |
| --- | --- | --- |
| Model IDs, release date, context, pricing, modalities, and AA indices | OpenRouter public model catalogue | `scripts/fetch-models.mjs` |
| Provider and benchmark-owner results | BenchLM leaderboard and per-model pages | `scripts/fetch-models.mjs` |
| Design preference ELO | OpenRouter's Design Arena enrichment | `scripts/fetch-models.mjs` |

BenchLM may link to a first-party provider report, a benchmark-owner result, or
an aggregated BenchLM row. The generated score stores that URL, evaluator,
evaluation type, methodology note, dataset version, and verification date.

## Refresh and verification

```text
npm run benchmarks:refresh
npm run test:benchmarks
npm run benchmarks:audit-sources
```

GitHub Actions runs the same refresh every day at 06:17 UTC. It opens or updates
a pull request instead of silently shipping an unreviewed score change. Merge
that pull request to publish new models and refreshed scores. The workflow now
runs the integrity suite and URL audit even when the generated file has no
diff, so source rot is not hidden by a no-op refresh.

## Why a model can have no score

OpenRouter lists models before benchmark owners or providers publish results.
Specialized image, safety, router, and preview models also do not belong on
every general-purpose benchmark. The page reports per-benchmark coverage and
keeps these models selectable rather than fabricating a proxy score.

When coverage is genuinely needed, add a source adapter in
`scripts/fetch-models.mjs` and a matching definition in `DEFINITIONS`. Do not
copy a score from a similarly named model unless the source explicitly says it
is the same checkpoint; if a score is a model-plus-harness result, keep that
fact in `methodologyNotes`.

## Quality gates

- All records have valid IDs, HTTPS citations, dates, pricing, and benchmark
  definition/unit/category parity.
- Percentages and ELO values are bounded, and display values match numbers.
- Every score maps to a registered benchmark definition.
- Coverage and source-host counts are exposed in `/api/benchmarks` and shown in
  the benchmark page's coverage ledger.
- The network source audit fails refresh CI on a dead citation.
