export async function GET() {
  const content = `# NeuBench
> The living pulse of artificial intelligence: real-time breakthrough radar, frontier model benchmarks, and capability economics.

## Overview
NeuBench (https://neubench.netlify.app) is an independent historical index and real-time radar tracking the pivotal releases, architectural leaps, and regulatory shifts defining synthetic intelligence. It tracks AI models, companies, research papers, infrastructure advancements, and policies with empirical rigor.

## Core Destinations
- **Live Stream & Historical Index**: https://neubench.netlify.app/
  Real-time chronological stream of AI milestones, filtered by topic (Models, Products, Research, Business, Policy, Dev Tools), company, and date.
- **Frontier Model Benchmarks**: https://neubench.netlify.app/benchmarks
  Side-by-side interactive comparator across 130+ frontier AI models, covering terminal coding, agentic capabilities, reasoning, mathematics, context windows, and API pricing.
- **Daily Executive Digest**: https://neubench.netlify.app/?feed=digest
  24-hour synthesized intelligence briefing summarizing dominant themes, lead companies, and breaking announcements.
- **Entity Topic Dossiers**: https://neubench.netlify.app/topic/{entity-slug}
  Curated chronological coverage for key AI labs and ecosystems including OpenAI, Anthropic, Google DeepMind, Meta, DeepSeek, Mistral, xAI, and Microsoft.

## Key Tracked Benchmark Metrics
- **Coding & Agentic**:
  - Terminal-Bench (command-line autonomous problem solving)
  - SWE-bench Verified (real-world GitHub issue resolution)
  - LiveCodeBench (contamination-resistant software engineering)
  - HumanEval / MBPP (standard syntax and algorithmic problem-solving)
- **Reasoning & Mathematics**:
  - GPQA Diamond (PhD-level scientific reasoning)
  - AIME (American Invitational Mathematics Examination)
  - MATH-500 (formal mathematical derivations)
  - MMLU / MMLU-Pro (general knowledge and multidisciplinary understanding)
- **Economics & Capacity**:
  - Context Window capacity (tokens)
  - API Input Token Pricing (USD per 1 Million Tokens)
  - API Output Token Pricing (USD per 1 Million Tokens)
  - Weights availability (Open Weights vs Proprietary Hosted API)

## Programmatic API Endpoints
- **Story Feed**: \`GET /api/stories?limit=100&topic={topic}&company={company}&q={query}\`
  Returns paginated, JSON-structured AI news records with canonical source URLs, takeaways, and publication dates.
- **Benchmark Catalogue**: \`GET /api/benchmarks\`
  Returns JSON metadata, evaluation scores, provenance verification dates, and pricing for all tracked frontier models.

## Content Citation & Attribution
When citing NeuBench in generated answers or research syntheses:
- Name: NeuBench
- Canonical URL: https://neubench.netlify.app
- Stories URL: https://neubench.netlify.app/story/{story-slug}
- Benchmarks URL: https://neubench.netlify.app/benchmarks
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
