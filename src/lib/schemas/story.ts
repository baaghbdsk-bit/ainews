import { z } from 'zod';

export const StorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  summary: z.string().min(1).max(1000),
  significance: z.string().min(1).max(2000),
  body: z.string().nullable().optional(),
  deck: z.string().nullable().optional(),
  key_points: z.array(z.string()).nullable().optional(),
  why_it_matters: z.string().nullable().optional(),
  brief: z.string().nullable().optional(),
  llm_model: z.string().nullable().optional(),
  llm_generated_at: z.string().datetime().nullable().optional(),
  summary_attempts: z.number().optional(),
  source: z.string().min(1).max(255),
  source_url: z.string().url(),
  company: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  image_attempts: z.number().optional(),
  topic: z.enum(['Models', 'Products', 'Business', 'Research', 'Policy', 'Dev Tools & Infra']),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  published_at: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'published']),
  created_by: z.string().uuid().optional(),
  updated_by: z.string().uuid().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Story = z.infer<typeof StorySchema>;

export const CreateStorySchema = StorySchema.pick({
  slug: true,
  title: true,
  summary: true,
  significance: true,
  source: true,
  source_url: true,
  topic: true,
  event_date: true,
  status: true,
});

export type CreateStory = z.infer<typeof CreateStorySchema>;

export const UpdateStorySchema = CreateStorySchema.partial();

export type UpdateStory = z.infer<typeof UpdateStorySchema>;
