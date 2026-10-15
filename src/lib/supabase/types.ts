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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
