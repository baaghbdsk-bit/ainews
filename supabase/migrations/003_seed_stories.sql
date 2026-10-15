-- Migration 003: Seed initial 9 AI news stories from Phase 1
-- Run this in Supabase SQL Editor after RLS policies are set up

-- Insert the 9 curated AI stories as published content
-- All stories are set to published status with their original event dates
-- Use ON CONFLICT DO NOTHING to skip if stories already exist

INSERT INTO stories (slug, title, summary, significance, source, source_url, topic, event_date, status, published_at) VALUES

-- Story 1: ChatGPT Launch (November 2022)
(
  'chatgpt-launches-to-the-public',
  'ChatGPT Launches to the Public',
  'OpenAI releases ChatGPT, a conversational AI that can answer questions, write essays, debug code, and more—bringing large language models into the mainstream.',
  'ChatGPT marks the moment AI became accessible to millions. It triggered a wave of innovation, investment, and public debate about AI''s role in society.',
  'OpenAI Blog',
  'https://openai.com/blog/chatgpt',
  'Products',
  '2022-11-30',
  'published',
  '2022-11-30T00:00:00Z'
),

-- Story 2: GPT-4 Launch (March 2023)
(
  'gpt-4-powers-a-new-generation-of-applications',
  'GPT-4 Powers a New Generation of Applications',
  'OpenAI unveils GPT-4, a multimodal model capable of processing images and text, with stronger reasoning and reliability than GPT-3.5.',
  'GPT-4 raised the bar for AI capabilities. From medical diagnosis to creative writing, it showed how far language models had advanced in just months.',
  'OpenAI Blog',
  'https://openai.com/research/gpt-4',
  'Models',
  '2023-03-14',
  'published',
  '2023-03-14T00:00:00Z'
),

-- Story 3: Llama 2 Open Source (July 2023)
(
  'meta-releases-llama-2-for-commercial-use',
  'Meta Releases Llama 2 for Commercial Use',
  'Meta releases Llama 2, a family of open-source large language models free for research and commercial applications, trained on 2 trillion tokens.',
  'Llama 2 democratized access to frontier AI. By making powerful models freely available, Meta accelerated global AI development and research.',
  'Meta AI Blog',
  'https://ai.meta.com/llama/',
  'Models',
  '2023-07-18',
  'published',
  '2023-07-18T00:00:00Z'
),

-- Story 4: Google Gemini Launch (December 2023)
(
  'google-launches-gemini-its-most-capable-ai-model',
  'Google Launches Gemini, Its Most Capable AI Model',
  'Google unveils Gemini, a multimodal AI model built from the ground up to handle text, images, audio, and video with state-of-the-art performance.',
  'Gemini represented Google''s full-scale entry into the AI race. Built natively for multimodality, it challenged OpenAI''s dominance in foundation models.',
  'Google Blog',
  'https://blog.google/technology/ai/google-gemini-ai/',
  'Models',
  '2023-12-06',
  'published',
  '2023-12-06T00:00:00Z'
),

-- Story 5: GPT Store Launch (January 2024)
(
  'openai-launches-the-gpt-store',
  'OpenAI Launches the GPT Store',
  'OpenAI opens the GPT Store, a marketplace where users can discover and share custom versions of ChatGPT built for specific tasks—no coding required.',
  'The GPT Store transformed ChatGPT from a tool into a platform. It empowered millions to build AI applications without writing a single line of code.',
  'OpenAI Blog',
  'https://openai.com/blog/introducing-the-gpt-store',
  'Products',
  '2024-01-10',
  'published',
  '2024-01-10T00:00:00Z'
),

-- Story 6: Sora Video Generation (February 2024)
(
  'openai-unveils-sora-text-to-video-ai',
  'OpenAI Unveils Sora, Text-to-Video AI',
  'OpenAI introduces Sora, an AI model that generates high-quality, minute-long videos from text prompts with realistic motion and scene composition.',
  'Sora showed that generative AI had moved beyond images. It opened new frontiers in filmmaking, education, and creative expression.',
  'OpenAI Blog',
  'https://openai.com/sora',
  'Models',
  '2024-02-15',
  'published',
  '2024-02-15T00:00:00Z'
),

-- Story 7: AlphaFold 3 Breakthrough (May 2024)
(
  'deepmind-releases-alphafold-3-for-drug-discovery',
  'DeepMind Releases AlphaFold 3 for Drug Discovery',
  'Google DeepMind unveils AlphaFold 3, which predicts the structure and interactions of proteins, DNA, RNA, and small molecules with unprecedented accuracy.',
  'AlphaFold 3 accelerated biology and medicine. By modeling molecular interactions, it made drug discovery faster, cheaper, and more precise.',
  'Nature',
  'https://www.nature.com/articles/s41586-024-07487-w',
  'Research',
  '2024-05-08',
  'published',
  '2024-05-08T00:00:00Z'
),

-- Story 8: GPT-4o Real-Time Voice (May 2024)
(
  'gpt-4o-brings-real-time-voice-and-vision-to-chatgpt',
  'GPT-4o Brings Real-Time Voice and Vision to ChatGPT',
  'OpenAI launches GPT-4o, a faster, more capable model that can see, hear, and speak in real time—making AI interactions feel truly conversational.',
  'GPT-4o blurred the line between AI and human interaction. Real-time voice and vision made ChatGPT more intuitive, accessible, and powerful.',
  'OpenAI Blog',
  'https://openai.com/index/hello-gpt-4o/',
  'Products',
  '2024-05-13',
  'published',
  '2024-05-13T00:00:00Z'
),

-- Story 9: EU AI Act Approval (May 2024)
(
  'the-eu-gives-the-ai-act-its-final-approval',
  'The EU Gives the AI Act Its Final Approval',
  'The European Union passes the AI Act, the world''s first comprehensive regulation of artificial intelligence, setting global standards for AI safety and transparency.',
  'The EU AI Act created the blueprint for AI governance worldwide. It balanced innovation with accountability, shaping how AI will be built and deployed.',
  'European Parliament',
  'https://www.europarl.europa.eu/news/en/headlines/society/20230601STO93804/eu-ai-act-first-regulation-on-artificial-intelligence',
  'Policy',
  '2024-05-21',
  'published',
  '2024-05-21T00:00:00Z'
)
ON CONFLICT (slug) DO NOTHING;

-- Verify the insert
-- Run this to check:
-- SELECT id, slug, title, topic, event_date, status FROM stories ORDER BY event_date DESC;
