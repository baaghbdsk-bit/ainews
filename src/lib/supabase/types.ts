export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      stories: {
        Row: {
          id: string;
          slug: string;
          title: string;
          summary: string;
          significance: string;
          body: string | null;
          company: string | null;
          enrich_attempts: number;
          deck: string | null;
          key_points: string[] | null;
          why_it_matters: string | null;
          brief: string | null;
          llm_model: string | null;
          llm_generated_at: string | null;
          summary_attempts: number;
          source: string;
          source_url: string;
          topic: 'Models' | 'Products' | 'Research' | 'Policy';
          event_date: string; // YYYY-MM-DD
          published_at: string | null;
          status: 'draft' | 'published';
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          summary: string;
          significance: string;
          body?: string | null;
          company?: string | null;
          enrich_attempts?: number;
          deck?: string | null;
          key_points?: string[] | null;
          why_it_matters?: string | null;
          brief?: string | null;
          llm_model?: string | null;
          llm_generated_at?: string | null;
          summary_attempts?: number;
          source: string;
          source_url: string;
          topic: 'Models' | 'Products' | 'Research' | 'Policy';
          event_date: string;
          published_at?: string | null;
          status: 'draft' | 'published';
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          summary?: string;
          significance?: string;
          body?: string | null;
          company?: string | null;
          enrich_attempts?: number;
          deck?: string | null;
          key_points?: string[] | null;
          why_it_matters?: string | null;
          brief?: string | null;
          llm_model?: string | null;
          llm_generated_at?: string | null;
          summary_attempts?: number;
          source?: string;
          source_url?: string;
          topic?: 'Models' | 'Products' | 'Research' | 'Policy';
          event_date?: string;
          published_at?: string | null;
          status?: 'draft' | 'published';
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      dossiers: {
        Row: {
          id: string;
          slug: string;
          title: string;
          subtitle: string | null;
          blocks: Json;
          story_ids: string[];
          llm_model: string | null;
          generated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          subtitle?: string | null;
          blocks?: Json;
          story_ids?: string[];
          llm_model?: string | null;
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          subtitle?: string | null;
          blocks?: Json;
          story_ids?: string[];
          llm_model?: string | null;
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
