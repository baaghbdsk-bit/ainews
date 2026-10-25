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
          image_url: string | null;
          image_attempts: number;
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
          image_url?: string | null;
          image_attempts?: number;
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
          image_url?: string | null;
          image_attempts?: number;
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
      story_upvotes: {
        Row: {
          id: string;
          story_slug: string;
          client_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          story_slug: string;
          client_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          story_slug?: string;
          client_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      story_vote_counts: {
        Row: {
          story_slug: string;
          upvote_count: number;
          updated_at: string;
        };
        Insert: {
          story_slug: string;
          upvote_count?: number;
          updated_at?: string;
        };
        Update: {
          story_slug?: string;
          upvote_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      story_bookmarks: {
        Row: {
          id: string;
          story_slug: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          story_slug: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          story_slug?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      feedback_submissions: {
        Row: {
          id: string;
          category: string;
          comment: string;
          email: string | null;
          client_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          comment: string;
          email?: string | null;
          client_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          comment?: string;
          email?: string | null;
          client_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      news_review_candidates: {
        Row: {
          id: string;
          dedupe_key: string;
          headline: string;
          publisher: string | null;
          original_url: string | null;
          canonical_url: string | null;
          google_news_url: string | null;
          published_at: string | null;
          discovered_at: string;
          hold_reason: string | null;
          reasons: string[];
          validation_status: string;
          review_status: 'pending' | 'approved' | 'rejected' | 'deferred' | 'duplicate';
          review_reason: string | null;
          duplicate_of_slug: string | null;
          related_story_slug: string | null;
          approved_for_publishing: boolean;
          published_story_slug: string | null;
          reviewer_id: string | null;
          reviewer_email: string | null;
          reviewed_at: string | null;
          source_evidence: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dedupe_key: string;
          headline: string;
          publisher?: string | null;
          original_url?: string | null;
          canonical_url?: string | null;
          google_news_url?: string | null;
          published_at?: string | null;
          discovered_at?: string;
          hold_reason?: string | null;
          reasons?: string[];
          validation_status?: string;
          review_status?: 'pending' | 'approved' | 'rejected' | 'deferred' | 'duplicate';
          review_reason?: string | null;
          duplicate_of_slug?: string | null;
          related_story_slug?: string | null;
          approved_for_publishing?: boolean;
          published_story_slug?: string | null;
          reviewer_id?: string | null;
          reviewer_email?: string | null;
          reviewed_at?: string | null;
          source_evidence?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dedupe_key?: string;
          headline?: string;
          publisher?: string | null;
          original_url?: string | null;
          canonical_url?: string | null;
          google_news_url?: string | null;
          published_at?: string | null;
          discovered_at?: string;
          hold_reason?: string | null;
          reasons?: string[];
          validation_status?: string;
          review_status?: 'pending' | 'approved' | 'rejected' | 'deferred' | 'duplicate';
          review_reason?: string | null;
          duplicate_of_slug?: string | null;
          related_story_slug?: string | null;
          approved_for_publishing?: boolean;
          published_story_slug?: string | null;
          reviewer_id?: string | null;
          reviewer_email?: string | null;
          reviewed_at?: string | null;
          source_evidence?: Json;
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


