/**
 * Tipos gerados manualmente para o schema Supabase (MVP).
 * Substituir por `supabase gen types typescript` quando o projecto
 * estiver linkado a um projecto Supabase real.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          club_id: string | null;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          club_id?: string | null;
          display_name?: string | null;
        };
        Update: {
          club_id?: string | null;
          display_name?: string | null;
        };
      };
      clubs: {
        Row: {
          id: string;
          short_name: string;
          name: string;
          city: string | null;
          stadium: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          short_name: string;
          name: string;
          city?: string | null;
          stadium?: string | null;
        };
        Update: {
          short_name?: string;
          name?: string;
          city?: string | null;
          stadium?: string | null;
        };
      };
      players: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          num: number;
          pos: string;
          archetype: string;
          zone: string;
          behavior: string;
          attributes: Record<string, number>;
          fatigue: number;
          injury_risk: number;
          evolution_xp: number;
          out_for_matches: number;
          schema_version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          num?: number;
          pos?: string;
          archetype?: string;
          zone?: string;
          behavior?: string;
          attributes?: Record<string, number>;
          fatigue?: number;
          injury_risk?: number;
          evolution_xp?: number;
          out_for_matches?: number;
          schema_version?: number;
        };
        Update: Partial<Omit<Database['public']['Tables']['players']['Insert'], 'id' | 'club_id'>>;
      };
      matches: {
        Row: {
          id: string;
          home_club_id: string;
          away_club_id: string | null;
          away_name: string | null;
          mode: 'live' | 'quick' | 'auto';
          status: 'scheduled' | 'live' | 'finished' | 'abandoned';
          score_home: number;
          score_away: number;
          simulation_seed: number | null;
          started_at: string | null;
          ended_at: string | null;
          post_match_data: Record<string, unknown> | null;
          created_at: string;
          /** Opcional: ligação ao módulo ADMIN / competições (migração 00002). */
          competition_id: string | null;
          fixture_id: string | null;
        };
        Insert: {
          id?: string;
          home_club_id: string;
          away_club_id?: string | null;
          away_name?: string | null;
          mode?: 'live' | 'quick' | 'auto';
          status?: 'scheduled' | 'live' | 'finished' | 'abandoned';
          score_home?: number;
          score_away?: number;
          simulation_seed?: number | null;
          started_at?: string | null;
          competition_id?: string | null;
          fixture_id?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['matches']['Insert'], 'id'>>;
      };
      match_events: {
        Row: {
          id: number;
          match_id: string;
          minute: number;
          kind: string;
          payload: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          match_id: string;
          minute: number;
          kind: string;
          payload?: Record<string, unknown>;
        };
        Update: never;
      };

      /** ADMIN / Leagues — ver docs/LEAGUES.md e supabase/migrations/00002_admin_leagues_competitions.sql */
      seasons: {
        Row: {
          id: string;
          code: string | null;
          name: string;
          starts_at: string;
          ends_at: string;
          promotion_count: number;
          relegation_count: number;
          tie_break_order: Record<string, unknown>;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code?: string | null;
          name: string;
          starts_at: string;
          ends_at: string;
          promotion_count?: number;
          relegation_count?: number;
          tie_break_order?: Record<string, unknown>;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Omit<Database['public']['Tables']['seasons']['Insert'], 'id'>>;
      };

      season_divisions: {
        Row: {
          id: string;
          season_id: string;
          tier: number;
          name: string;
          max_clubs: number;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          tier: number;
          name: string;
          max_clubs?: number;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Omit<Database['public']['Tables']['season_divisions']['Insert'], 'id'>>;
      };

      season_division_memberships: {
        Row: {
          id: string;
          season_division_id: string;
          club_id: string;
          joined_at: string;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          season_division_id: string;
          club_id: string;
          joined_at?: string;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Omit<Database['public']['Tables']['season_division_memberships']['Insert'], 'id'>>;
      };

      competitions: {
        Row: {
          id: string;
          kind: 'league' | 'cup';
          league_subtype: 'round_robin' | 'premium' | null;
          season_id: string | null;
          season_division_id: string | null;
          visibility: 'public' | 'participants_only';
          name: string;
          code: string | null;
          duration_unit: 'days' | 'rounds';
          duration_value: number;
          knockout_advance_count: 8 | 16 | 32 | 64 | 128 | null;
          rewards: Record<string, unknown> | null;
          relegation_config: Record<string, unknown> | null;
          status: 'draft' | 'scheduled' | 'active' | 'finished' | 'cancelled';
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: 'league' | 'cup';
          league_subtype?: 'round_robin' | 'premium' | null;
          season_id?: string | null;
          season_division_id?: string | null;
          visibility?: 'public' | 'participants_only';
          name: string;
          code?: string | null;
          duration_unit: 'days' | 'rounds';
          duration_value: number;
          knockout_advance_count?: 8 | 16 | 32 | 64 | 128 | null;
          rewards?: Record<string, unknown> | null;
          relegation_config?: Record<string, unknown> | null;
          status?: 'draft' | 'scheduled' | 'active' | 'finished' | 'cancelled';
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Omit<Database['public']['Tables']['competitions']['Insert'], 'id'>>;
      };

      competition_phases: {
        Row: {
          id: string;
          competition_id: string;
          phase_order: number;
          phase_kind: 'league' | 'knockout';
          name: string | null;
          starts_at: string | null;
          ends_at: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          phase_order: number;
          phase_kind: 'league' | 'knockout';
          name?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Omit<Database['public']['Tables']['competition_phases']['Insert'], 'id'>>;
      };

      competition_participants: {
        Row: {
          id: string;
          competition_id: string;
          club_id: string;
          seed: number | null;
          eliminated_at: string | null;
          exp_snapshot: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          club_id: string;
          seed?: number | null;
          eliminated_at?: string | null;
          exp_snapshot?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Omit<Database['public']['Tables']['competition_participants']['Insert'], 'id'>>;
      };

      competition_standings: {
        Row: {
          id: string;
          competition_id: string;
          phase_id: string;
          club_id: string;
          played: number;
          wins: number;
          draws: number;
          losses: number;
          goals_for: number;
          goals_against: number;
          points: number;
          standing_rank: number | null;
          tie_break: Record<string, unknown> | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          phase_id: string;
          club_id: string;
          played?: number;
          wins?: number;
          draws?: number;
          losses?: number;
          goals_for?: number;
          goals_against?: number;
          points?: number;
          standing_rank?: number | null;
          tie_break?: Record<string, unknown> | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['competition_standings']['Insert'], 'id'>>;
      };

      competition_rewards: {
        Row: {
          id: string;
          competition_id: string;
          from_rank: number;
          to_rank: number;
          reward: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          from_rank: number;
          to_rank: number;
          reward?: Record<string, unknown>;
        };
        Update: Partial<Omit<Database['public']['Tables']['competition_rewards']['Insert'], 'id'>>;
      };

      fixtures: {
        Row: {
          id: string;
          competition_id: string;
          phase_id: string;
          round_index: number;
          leg: 1 | 2;
          home_club_id: string;
          away_club_id: string;
          aggregate_home_goals: number | null;
          aggregate_away_goals: number | null;
          tie_break_home_exp: string | null;
          tie_break_away_exp: string | null;
          status: 'scheduled' | 'live' | 'finished' | 'void' | 'walkover';
          scheduled_at: string | null;
          match_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          phase_id: string;
          round_index?: number;
          leg?: 1 | 2;
          home_club_id: string;
          away_club_id: string;
          aggregate_home_goals?: number | null;
          aggregate_away_goals?: number | null;
          tie_break_home_exp?: string | null;
          tie_break_away_exp?: string | null;
          status?: 'scheduled' | 'live' | 'finished' | 'void' | 'walkover';
          scheduled_at?: string | null;
          match_id?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Omit<Database['public']['Tables']['fixtures']['Insert'], 'id'>>;
      };
    };
  };
}
