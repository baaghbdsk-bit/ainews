/**
 * Backfill prod topic values using the new 6-topic classifier.
 *
 * 1. Exports a slug -> topic backup JSON first (topic-backup-<ts>.json).
 * 2. Re-classifies every story from its title+summary.
 * 3. Updates only rows whose topic actually changes.
 *
 * Requires: 018_expand_topic_check.sql to have been run (CHECK constraint
 * must allow Business and Dev Tools & Infra).
 *
 * Usage:  node --env-file=.env.local scripts/backfill-topics.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { classifyStoryTopic } from '../src/lib/feeds/classify-topic.ts';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PAGE = 1000;
let from = 0;
let total = 0;
let changed = 0;
const backup = {};
const changes = [];

for (;;) {
  const { data: rows, error } = await db
    .from('stories')
    .select('id, slug, title, summary, topic')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) { console.error('fetch error:', error.message); process.exit(1); }
  if (!rows || rows.length === 0) break;

  for (const row of rows) {
    total += 1;
    backup[row.slug] = row.topic;
    const next = classifyStoryTopic({
      title: row.title,
      summary: row.summary,
      fallbackTopic: row.topic,
    });
    if (next !== row.topic) {
      changed += 1;
      changes.push({ slug: row.slug, from: row.topic, to: next, title: row.title.slice(0, 80) });
      const { error: upErr } = await db.from('stories').update({ topic: next }).eq('id', row.id);
      if (upErr) console.error(`update failed ${row.slug}:`, upErr.message);
    }
  }

  from += PAGE;
  if (rows.length < PAGE) break;
}

const backupFile = `topic-backup-${Date.now()}.json`;
await (await import('node:fs/promises')).writeFile(backupFile, JSON.stringify(backup, null, 2));

console.log(`total: ${total}, changed: ${changed}`);
console.log('backup written to', backupFile);
console.log('--- sample changes (first 25) ---');
for (const c of changes.slice(0, 25)) console.log(`${c.from} -> ${c.to} | ${c.title}`);
