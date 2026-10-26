-- Expand the stories.topic check constraint from the original 4 topics to the
-- new 6-topic taxonomy: Models, Products, Business, Research, Policy,
-- Dev Tools & Infra. Values are unchanged for existing rows; this only lifts
-- the constraint so new topics can be written and the backfill can re-label.
--
-- Run in the Supabase SQL Editor before executing the topic backfill.

ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_topic_check;

ALTER TABLE stories ADD CONSTRAINT stories_topic_check
  CHECK (topic IN ('Models', 'Products', 'Business', 'Research', 'Policy', 'Dev Tools & Infra'));
