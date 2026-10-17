-- Add a persisted company label to stories.
--
-- The timeline used to run extractCompany() over title+summary+body+source at
-- read time for every row (and every timeline merge). Storing the result keeps
-- facets and the company filter cheap and stable.
--
-- The backfill below is generated from src/lib/story-company.ts (same list,
-- longest-name-first order, same escaping, same whole-word matching over
-- lower(title || ' ' || summary || ' ' || body || ' ' || source)). Postgres
-- uses \y word boundaries — \b is NOT a word boundary in Postgres ARE.
-- Future COMPANY_LIST changes need a follow-up backfill migration.

alter table public.stories add column company text;

comment on column public.stories.company is
  'Derived company/organisation label (extractCompany); NULL when nothing matches.';

with src as (
  select id,
         lower(
           coalesce(title, '') || ' ' ||
           coalesce(summary, '') || ' ' ||
           coalesce(body, '') || ' ' ||
           coalesce(source, '')
         ) as haystack
  from public.stories
  where company is null
)
update public.stories s
set company = case
  when src.haystack ~ '\ybureau of industry and security\y' then 'Bureau of Industry and Security'
  when src.haystack ~ '\ycouncil of the european union\y' then 'Council of the European Union'
  when src.haystack ~ '\yu\.s\. department of commerce\y' then 'U.S. Department of Commerce'
  when src.haystack ~ '\yuk ai safety institute\y' then 'UK AI Safety Institute'
  when src.haystack ~ '\ymit technology review\y' then 'MIT Technology Review'
  when src.haystack ~ '\yeuropean commission\y' then 'European Commission'
  when src.haystack ~ '\yeuropean parliament\y' then 'European Parliament'
  when src.haystack ~ '\ygoogle deepmind\y' then 'Google DeepMind'
  when src.haystack ~ '\yperplexity ai\y' then 'Perplexity AI'
  when src.haystack ~ '\yinflection ai\y' then 'Inflection AI'
  when src.haystack ~ '\yhugging face\y' then 'Hugging Face'
  when src.haystack ~ '\ystability ai\y' then 'Stability AI'
  when src.haystack ~ '\ycharacter ai\y' then 'Character AI'
  when src.haystack ~ '\yfireworks ai\y' then 'Fireworks AI'
  when src.haystack ~ '\yars technica\y' then 'Ars Technica'
  when src.haystack ~ '\ytogether ai\y' then 'Together AI'
  when src.haystack ~ '\yventurebeat\y' then 'VentureBeat'
  when src.haystack ~ '\ymistral ai\y' then 'Mistral AI'
  when src.haystack ~ '\yperplexity\y' then 'Perplexity'
  when src.haystack ~ '\ydatabricks\y' then 'Databricks'
  when src.haystack ~ '\ytechcrunch\y' then 'TechCrunch'
  when src.haystack ~ '\yanthropic\y' then 'Anthropic'
  when src.haystack ~ '\ymicrosoft\y' then 'Microsoft'
  when src.haystack ~ '\ysambanova\y' then 'SambaNova'
  when src.haystack ~ '\ysnowflake\y' then 'Snowflake'
  when src.haystack ~ '\ythe verge\y' then 'The Verge'
  when src.haystack ~ '\ythe batch\y' then 'The Batch'
  when src.haystack ~ '\yimport ai\y' then 'Import AI'
  when src.haystack ~ '\ydeepmind\y' then 'DeepMind'
  when src.haystack ~ '\yscale ai\y' then 'Scale AI'
  when src.haystack ~ '\ycerebras\y' then 'Cerebras'
  when src.haystack ~ '\yanyscale\y' then 'Anyscale'
  when src.haystack ~ '\ypalantir\y' then 'Palantir'
  when src.haystack ~ '\ymistral\y' then 'Mistral'
  when src.haystack ~ '\yopenai\y' then 'OpenAI'
  when src.haystack ~ '\ynvidia\y' then 'NVIDIA'
  when src.haystack ~ '\yamazon\y' then 'Amazon'
  when src.haystack ~ '\ycohere\y' then 'Cohere'
  when src.haystack ~ '\yreplit\y' then 'Replit'
  when src.haystack ~ '\yapple\y' then 'Apple'
  when src.haystack ~ '\yadept\y' then 'Adept'
  when src.haystack ~ '\ywired\y' then 'Wired'
  when src.haystack ~ '\ymeta\y' then 'Meta'
  when src.haystack ~ '\ygroq\y' then 'Groq'
  when src.haystack ~ '\yaisi\y' then 'AISI'
  when src.haystack ~ '\yxai\y' then 'xAI'
  when src.haystack ~ '\yaws\y' then 'AWS'
end
from src
where s.id = src.id;
