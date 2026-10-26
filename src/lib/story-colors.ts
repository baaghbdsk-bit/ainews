import type { Story } from "@/lib/schemas/story";

export type StoryTopic = Story["topic"];

/**
 * The accent vocabulary shared by the timeline nodes, topic dots, filter chips,
 * and the story article. One name per color; CSS defines `.node-*`, `.dot-*`,
 * and `.article-*` for each member of this union.
 */
export type StoryColor = "blue" | "violet" | "cyan" | "amber" | "green" | "rose";

/**
 * One color per topic, so a story keeps the same accent everywhere it appears
 * (timeline row, article page) and the colors form a stable legend readers can
 * learn: Policy = blue, Models = violet, Products = cyan, Research = amber,
 * Business = green, Dev Tools & Infra = rose.
 */
export const TOPIC_COLORS: Record<StoryTopic, StoryColor> = {
  Policy: "blue",
  Models: "violet",
  Products: "cyan",
  Research: "amber",
  Business: "green",
  "Dev Tools & Infra": "rose",
};

export function colorForTopic(topic: StoryTopic): StoryColor {
  return TOPIC_COLORS[topic] ?? "blue";
}
