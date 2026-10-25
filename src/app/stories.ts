export type Topic = "Models" | "Products" | "Research" | "Policy";

export type Story = {
  id: string;
  date: string;
  day: string;
  month: string;
  year: string;
  title: string;
  topic: Topic;
  summary: string;
  significance: string;
  source: string;
  company?: string;
  sourceUrl: string;
  color: string;
};

export const stories: Story[] = [
  {
    id: "gemini-3-pro",
    date: "2025-11-18",
    day: "18",
    month: "NOV",
    year: "2025",
    title: "Google releases Gemini 3 Pro",
    topic: "Models",
    summary:
      "Google released Gemini 3 Pro, a frontier multimodal reasoning model that topped major independent leaderboards and emphasized agentic and coding ability.",
    significance:
      "Intensified the late-2025 frontier race, with Google regaining top marks on several reasoning and coding benchmarks and pushing competitors to respond quickly.",
    source: "Google",
    company: "Google",
    sourceUrl: "https://blog.google/products/gemini/gemini-3/",
    color: "violet",
  },
  {
    id: "gpt-5",
    date: "2025-08-07",
    day: "07",
    month: "AUG",
    year: "2025",
    title: "OpenAI releases GPT-5 as a unified fast-and-thinking system",
    topic: "Products",
    summary:
      "OpenAI released GPT-5, a system that automatically routes between a fast model and a deeper \"thinking\" model, and rolled it out to all ChatGPT users.",
    significance:
      "Consolidated the fast-versus-reasoning split into a single product experience and reset the frontier for general-purpose assistants.",
    source: "OpenAI",
    company: "OpenAI",
    sourceUrl: "https://openai.com/index/introducing-gpt-5/",
    color: "cyan",
  },
  {
    id: "claude-4",
    date: "2025-05-22",
    day: "22",
    month: "MAY",
    year: "2025",
    title: "Anthropic releases Claude Opus 4 and Sonnet 4",
    topic: "Models",
    summary:
      "Anthropic released Claude Opus 4 and Sonnet 4, its most capable models to date, with extended thinking, tool use, and strong agentic coding performance.",
    significance:
      "Marked a step change in autonomous coding and long-running agent tasks, a focus area the leading labs were now competing hard on.",
    source: "Anthropic",
    company: "Anthropic",
    sourceUrl: "https://www.anthropic.com/news/claude-4",
    color: "violet",
  },
  {
    id: "ai-diffusion-rule-rescinded",
    date: "2025-05-13",
    day: "13",
    month: "MAY",
    year: "2025",
    title: "US rescinds the AI Diffusion Rule on chip exports",
    topic: "Policy",
    summary:
      "The US Commerce Department rescinded the Biden-era AI Diffusion Rule that would have tiered and capped advanced AI-chip exports to most countries.",
    significance:
      "Reset US export policy just as it was taking effect, adding uncertainty for global compute distribution and allies' AI infrastructure plans.",
    source: "U.S. Department of Commerce",
    company: "U.S. Department of Commerce",
    sourceUrl: "https://www.bis.gov/",
    color: "blue",
  },
  {
    id: "gpt-4-1-api",
    date: "2025-04-14",
    day: "14",
    month: "APR",
    year: "2025",
    title: "OpenAI ships GPT-4.1 with a 1M-token context in the API",
    topic: "Products",
    summary:
      "OpenAI released GPT-4.1 (plus mini and nano) via its API, offering up to a 1M-token context window and improved coding and instruction following for developers.",
    significance:
      "Made very long-context coding and document workflows practical for API customers, pressuring rivals on both context length and price.",
    source: "OpenAI",
    company: "OpenAI",
    sourceUrl: "https://openai.com/index/gpt-4-1/",
    color: "cyan",
  },
  {
    id: "llama-4",
    date: "2025-04-05",
    day: "05",
    month: "APR",
    year: "2025",
    title: "Meta releases the Llama 4 family of open multimodal models",
    topic: "Models",
    summary:
      "Meta released Llama 4 Scout and Maverick as natively multimodal mixture-of-experts models, openly available and tuned for efficiency and long context.",
    significance:
      "Kept strong open-weight competition alive against closed frontier models, though early reviews were mixed on some coding and reasoning tasks.",
    source: "Meta",
    company: "Meta",
    sourceUrl: "https://ai.meta.com/blog/llama-4-multimodal-intelligence/",
    color: "violet",
  },
  {
    id: "gemini-2-5-pro",
    date: "2025-03-25",
    day: "25",
    month: "MAR",
    year: "2025",
    title: "Google releases Gemini 2.5 Pro, a leading \"thinking\" model",
    topic: "Models",
    summary:
      "Google released Gemini 2.5 Pro, a reasoning-first model that topped several reasoning and coding leaderboards and expanded its long-context capabilities.",
    significance:
      "Pushed \"thinking\" models into the mainstream and raised the bar for coding assistants and agentic applications.",
    source: "Google",
    company: "Google",
    sourceUrl: "https://blog.google/technology/google-deepmind/gemini-model-thinking-updates-march-2025/",
    color: "violet",
  },
  {
    id: "gpt-4-5-orion",
    date: "2025-02-27",
    day: "27",
    month: "FEB",
    year: "2025",
    title: "OpenAI previews GPT-4.5 as a step toward GPT-5",
    topic: "Models",
    summary:
      "OpenAI released GPT-4.5 (\"Orion\") as a research preview, its largest chat model yet, positioned as the last non-reasoning model before GPT-5.",
    significance:
      "Served as a bridge to reasoning models while OpenAI gathered data on scaling pre-training, hinting at the unified systems to come.",
    source: "OpenAI",
    company: "OpenAI",
    sourceUrl: "https://openai.com/index/introducing-gpt-4-5/",
    color: "violet",
  },
  {
    id: "claude-3-7-sonnet",
    date: "2025-02-24",
    day: "24",
    month: "FEB",
    year: "2025",
    title: "Anthropic ships Claude 3.7 Sonnet, its first hybrid reasoning model",
    topic: "Models",
    summary:
      "Anthropic released Claude 3.7 Sonnet, a hybrid reasoning model that lets users toggle between instant answers and extended step-by-step thinking.",
    significance:
      "Popularized user-controlled reasoning depth, letting developers trade latency for accuracy within a single model.",
    source: "Anthropic",
    company: "Anthropic",
    sourceUrl: "https://www.anthropic.com/news/claude-3-7-sonnet",
    color: "violet",
  },
  {
    id: "grok-3",
    date: "2025-02-17",
    day: "17",
    month: "FEB",
    year: "2025",
    title: "xAI releases Grok 3",
    topic: "Models",
    summary:
      "xAI released Grok 3, trained on its Colossus supercluster, positioning it as a top-tier reasoning and chat model competitive with leading US labs.",
    significance:
      "Reinforced the trend of well-funded challengers closing the gap with frontier labs within months of each major release.",
    source: "xAI",
    company: "xAI",
    sourceUrl: "https://x.ai/news/grok-3",
    color: "violet",
  },
  {
    id: "deepseek-r1",
    date: "2025-01-20",
    day: "20",
    month: "JAN",
    year: "2025",
    title: "DeepSeek releases R1, an open reasoning model that rivals o1",
    topic: "Research",
    summary:
      "Chinese lab DeepSeek released R1, an open-weight reasoning model reported to match OpenAI's o1 on math and coding benchmarks at a far lower training cost.",
    significance:
      "R1's open weights and low reported cost challenged assumptions about compute barriers and sent the DeepSeek app to the top of app stores.",
    source: "DeepSeek",
    company: "DeepSeek",
    sourceUrl: "https://api-docs.deepseek.com/news/news250120",
    color: "amber",
  },
  {
    id: "stargate",
    date: "2025-01-21",
    day: "21",
    month: "JAN",
    year: "2025",
    title: "OpenAI, SoftBank and Oracle announce the $500B Stargate project",
    topic: "Products",
    summary:
      "OpenAI, SoftBank and Oracle announced Stargate, a venture to invest up to $500 billion in AI data-center infrastructure across the United States.",
    significance:
      "A landmark bet that frontier progress depends on massive new compute and energy capacity, reshaping infrastructure investment and US AI policy.",
    source: "OpenAI",
    company: "OpenAI",
    sourceUrl: "https://openai.com/index/announcing-the-stargate-project/",
    color: "cyan",
  },
  {
    id: "eu-ai-act-prohibitions",
    date: "2025-02-02",
    day: "02",
    month: "FEB",
    year: "2025",
    title: "The EU AI Act's first prohibitions take effect",
    topic: "Policy",
    summary:
      "The EU AI Act's bans on \"unacceptable-risk\" AI, such as social scoring and untargeted facial scraping, plus AI-literacy duties, became applicable.",
    significance:
      "The world's first comprehensive AI law moved from proposal to enforcement, creating binding obligations global providers must design around.",
    source: "European Commission",
    company: "European Commission",
    sourceUrl: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
    color: "blue",
  },
  {
    id: "ai-act",
    date: "2024-05-21",
    day: "21",
    month: "MAY",
    year: "2024",
    title: "The EU gives the AI Act its final approval",
    topic: "Policy",
    summary:
      "The Council of the European Union gave final approval to the bloc's first comprehensive rules for artificial intelligence, following agreement with the European Parliament.",
    significance:
      "A risk-based framework moved from proposal to law, setting obligations that would shape how high-risk AI systems are built and deployed across a major market.",
    source: "Council of the European Union",
    company: "Council of the European Union",
    sourceUrl:
      "https://www.consilium.europa.eu/en/press/press-releases/2024/05/21/artificial-intelligence-ai-act-council-gives-final-green-light-to-the-first-worldwide-rules-on-ai/",
    color: "blue",
  },
  {
    id: "gpt-4o",
    date: "2024-05-13",
    day: "13",
    month: "MAY",
    year: "2024",
    title: "GPT-4o brings real-time voice and vision to ChatGPT",
    topic: "Models",
    summary:
      "OpenAI introduced GPT-4o, a model trained to handle text, audio, and images together, with a live voice experience designed to respond more naturally.",
    significance:
      "The announcement pushed multimodal interaction into the mainstream product conversation: AI was no longer just a text box, but an interface that could see and hear.",
    source: "OpenAI",
    company: "OpenAI",
    sourceUrl: "https://openai.com/index/hello-gpt-4o/",
    color: "violet",
  },
  {
    id: "alphafold-3",
    date: "2024-05-08",
    day: "08",
    month: "MAY",
    year: "2024",
    title: "AlphaFold 3 predicts how life's molecules interact",
    topic: "Research",
    summary:
      "Google DeepMind and Isomorphic Labs unveiled AlphaFold 3, extending molecular structure prediction to interactions between proteins, DNA, RNA, and other molecules.",
    significance:
      "The work pointed toward AI systems that could help researchers reason about the chemistry of life, not only the shape of individual proteins.",
    source: "Google DeepMind",
    company: "Google DeepMind",
    sourceUrl: "https://deepmind.google/discover/blog/alphafold-3-predicts-the-structure-and-interactions-of-all-of-lifes-molecules/",
    color: "amber",
  },
  {
    id: "sora",
    date: "2024-02-15",
    day: "15",
    month: "FEB",
    year: "2024",
    title: "OpenAI reveals Sora, a model for video generation",
    topic: "Models",
    summary:
      "OpenAI introduced Sora through a set of text-to-video examples, showing extended scenes with camera movement, multiple subjects, and detailed environments.",
    significance:
      "The demos made video generation a central frontier for generative AI while raising urgent questions about provenance, safety, and synthetic media.",
    source: "OpenAI",
    company: "OpenAI",
    sourceUrl: "https://openai.com/index/sora/",
    color: "violet",
  },
  {
    id: "gpt-store",
    date: "2024-01-10",
    day: "10",
    month: "JAN",
    year: "2024",
    title: "The GPT Store opens a new chapter for custom assistants",
    topic: "Products",
    summary:
      "OpenAI launched the GPT Store, giving eligible ChatGPT users a place to discover custom assistants made with its GPT builder.",
    significance:
      "The move tested a platform model for AI: developers and communities could create purpose-built assistants inside an existing distribution channel.",
    source: "OpenAI",
    company: "OpenAI",
    sourceUrl: "https://openai.com/index/introducing-the-gpt-store/",
    color: "cyan",
  },
  {
    id: "gemini",
    date: "2023-12-06",
    day: "06",
    month: "DEC",
    year: "2023",
    title: "Google introduces Gemini as a natively multimodal model",
    topic: "Models",
    summary:
      "Google announced Gemini, a model family designed to work across text, code, audio, image, and video, with Ultra, Pro, and Nano versions.",
    significance:
      "The launch signaled that leading labs were building multimodality into the model itself, rather than treating each input type as a separate add-on.",
    source: "Google",
    company: "Google",
    sourceUrl: "https://blog.google/technology/ai/google-gemini-ai/",
    color: "violet",
  },
  {
    id: "llama-2",
    date: "2023-07-18",
    day: "18",
    month: "JUL",
    year: "2023",
    title: "Meta releases Llama 2 for commercial use",
    topic: "Models",
    summary:
      "Meta released Llama 2 model weights for research and commercial use, alongside a partnership with Microsoft and a focus on open development.",
    significance:
      "Capable downloadable models gave developers a credible alternative to closed APIs and accelerated the open-weight AI ecosystem.",
    source: "Meta AI",
    company: "Meta",
    sourceUrl: "https://ai.meta.com/blog/llama-2/",
    color: "violet",
  },
  {
    id: "gpt-4",
    date: "2023-03-14",
    day: "14",
    month: "MAR",
    year: "2023",
    title: "GPT-4 shows a leap in reasoning and image understanding",
    topic: "Models",
    summary:
      "OpenAI released GPT-4, a large multimodal model that could accept image and text inputs and demonstrated stronger performance across a range of professional and academic tests.",
    significance:
      "Its launch made the pace of model progress tangible to a broad audience and intensified debate about capability evaluation and responsible deployment.",
    source: "OpenAI",
    company: "OpenAI",
    sourceUrl: "https://openai.com/index/gpt-4/",
    color: "violet",
  },
  {
    id: "chatgpt",
    date: "2022-11-30",
    day: "30",
    month: "NOV",
    year: "2022",
    title: "ChatGPT turns generative AI into a public conversation",
    topic: "Products",
    summary:
      "OpenAI released ChatGPT as a free research preview, bringing a conversational interface for its GPT models to the public.",
    significance:
      "A simple chat interface made generative AI immediately accessible to millions and changed the public, business, and policy conversation almost overnight.",
    source: "OpenAI",
    company: "OpenAI",
    sourceUrl: "https://openai.com/index/chatgpt/",
    color: "cyan",
  },
];