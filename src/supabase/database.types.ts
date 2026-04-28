export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academy_managers: {
        Row: {
          art_request_id: string
          club_id: string
          created_at: string
          game_player_id: string
          id: string
          listed_at: string
          listed_on_market: boolean
          listing_id: string
          mint_overall: number
          player_snapshot: Json
          portrait_public_url: string | null
          portrait_token_public_url: string | null
          price_exp: number
        }
        Insert: {
          art_request_id: string
          club_id: string
          created_at?: string
          game_player_id: string
          id?: string
          listed_at?: string
          listed_on_market?: boolean
          listing_id: string
          mint_overall: number
          player_snapshot: Json
          portrait_public_url?: string | null
          portrait_token_public_url?: string | null
          price_exp: number
        }
        Update: {
          art_request_id?: string
          club_id?: string
          created_at?: string
          game_player_id?: string
          id?: string
          listed_at?: string
          listed_on_market?: boolean
          listing_id?: string
          mint_overall?: number
          player_snapshot?: Json
          portrait_public_url?: string | null
          portrait_token_public_url?: string | null
          price_exp?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_managers_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_action_log: {
        Row: {
          action: string
          admin_email: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_resource: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_email: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_resource?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_email?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_resource?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_allowed_ips: {
        Row: {
          active: boolean
          added_at: string
          added_by: string | null
          id: string
          ip_cidr: unknown
          note: string | null
        }
        Insert: {
          active?: boolean
          added_at?: string
          added_by?: string | null
          id?: string
          ip_cidr: unknown
          note?: string | null
        }
        Update: {
          active?: boolean
          added_at?: string
          added_by?: string | null
          id?: string
          ip_cidr?: unknown
          note?: string | null
        }
        Relationships: []
      }
      admin_banners: {
        Row: {
          audience: Json
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          link_url: string | null
          position: string
          priority: number
          starts_at: string | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Json
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          position?: string
          priority?: number
          starts_at?: string | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Json
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          position?: string
          priority?: number
          starts_at?: string | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_broadcasts: {
        Row: {
          active: boolean
          audience: string
          body: string
          category: string
          created_at: string
          created_by: string | null
          deep_link: string | null
          expires_at: string | null
          id: string
          title: string
        }
        Insert: {
          active?: boolean
          audience?: string
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          deep_link?: string | null
          expires_at?: string | null
          id?: string
          title: string
        }
        Update: {
          active?: boolean
          audience?: string
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          deep_link?: string | null
          expires_at?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      admin_csrf_tokens: {
        Row: {
          admin_email: string
          created_at: string
          expires_at: string
          token: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          admin_email: string
          created_at?: string
          expires_at?: string
          token: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          admin_email?: string
          created_at?: string
          expires_at?: string
          token?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: []
      }
      admin_login_attempts: {
        Row: {
          attempted_at: string
          email: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_login_notifications: {
        Row: {
          admin_email: string
          created_at: string
          id: string
          ip_address: string | null
          location_estimate: string | null
          login_at: string
          notification_sent: boolean
          notification_sent_at: string | null
          user_agent: string | null
        }
        Insert: {
          admin_email: string
          created_at?: string
          id?: string
          ip_address?: string | null
          location_estimate?: string | null
          login_at: string
          notification_sent?: boolean
          notification_sent_at?: string | null
          user_agent?: string | null
        }
        Update: {
          admin_email?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          location_estimate?: string | null
          login_at?: string
          notification_sent?: boolean
          notification_sent_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_panel_users: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          email: string
          id: string
          last_login_at: string | null
          password_hash: string
          role: string
          two_factor_backup_codes: string[] | null
          two_factor_enabled: boolean
          two_factor_enabled_at: string | null
          two_factor_secret: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          last_login_at?: string | null
          password_hash: string
          role?: string
          two_factor_backup_codes?: string[] | null
          two_factor_enabled?: boolean
          two_factor_enabled_at?: string | null
          two_factor_secret?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          password_hash?: string
          role?: string
          two_factor_backup_codes?: string[] | null
          two_factor_enabled?: boolean
          two_factor_enabled_at?: string | null
          two_factor_secret?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          added_at: string
          added_by: string | null
          note: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          note?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: number
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          operation: string
          row_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          id?: never
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          operation: string
          row_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          id?: never
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          operation?: string
          row_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      beta_testers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          id: string
          invite_code: string | null
          invited_by: string | null
          metadata: Json | null
          notes: string | null
          source: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          id?: string
          invite_code?: string | null
          invited_by?: string | null
          metadata?: Json | null
          notes?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          id?: string
          invite_code?: string | null
          invited_by?: string | null
          metadata?: Json | null
          notes?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      broadcast_deliveries: {
        Row: {
          broadcast_id: string
          delivered_at: string
          user_id: string
        }
        Insert: {
          broadcast_id: string
          delivered_at?: string
          user_id: string
        }
        Update: {
          broadcast_id?: string
          delivered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_deliveries_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "admin_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          admin_notes: string | null
          app_version: string | null
          attachments: Json | null
          category: string
          created_at: string
          description: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          screenshot_url: string | null
          severity: string
          status: string
          title: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          app_version?: string | null
          attachments?: Json | null
          category?: string
          created_at?: string
          description: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          screenshot_url?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          app_version?: string | null
          attachments?: Json | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          screenshot_url?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clubs: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          short_name: string | null
          stadium: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          short_name?: string | null
          stadium?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          short_name?: string | null
          stadium?: string | null
        }
        Relationships: []
      }
      coach_skills_catalog: {
        Row: {
          active: boolean
          created_at: string
          id: string
          level: number
          name: string
          payload: Json
          role: string
          schema_version: number
          tier: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          level: number
          name: string
          payload: Json
          role: string
          schema_version?: number
          tier: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          level?: number
          name?: string
          payload?: Json
          role?: string
          schema_version?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      competition_participants: {
        Row: {
          club_id: string
          competition_id: string
          created_at: string
          eliminated_at: string | null
          exp_snapshot: number | null
          id: string
          metadata: Json
          seed: number | null
        }
        Insert: {
          club_id: string
          competition_id: string
          created_at?: string
          eliminated_at?: string | null
          exp_snapshot?: number | null
          id?: string
          metadata?: Json
          seed?: number | null
        }
        Update: {
          club_id?: string
          competition_id?: string
          created_at?: string
          eliminated_at?: string | null
          exp_snapshot?: number | null
          id?: string
          metadata?: Json
          seed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_participants_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_participants_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_phases: {
        Row: {
          competition_id: string
          created_at: string
          ends_at: string | null
          id: string
          metadata: Json
          name: string | null
          phase_kind: string
          phase_order: number
          starts_at: string | null
        }
        Insert: {
          competition_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          phase_kind: string
          phase_order: number
          starts_at?: string | null
        }
        Update: {
          competition_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          phase_kind?: string
          phase_order?: number
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_phases_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_rewards: {
        Row: {
          competition_id: string
          created_at: string
          from_rank: number
          id: string
          reward: Json
          to_rank: number
        }
        Insert: {
          competition_id: string
          created_at?: string
          from_rank: number
          id?: string
          reward?: Json
          to_rank: number
        }
        Update: {
          competition_id?: string
          created_at?: string
          from_rank?: number
          id?: string
          reward?: Json
          to_rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "competition_rewards_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_standings: {
        Row: {
          club_id: string
          competition_id: string
          draws: number
          goals_against: number
          goals_for: number
          id: string
          losses: number
          phase_id: string
          played: number
          points: number
          standing_rank: number | null
          tie_break: Json | null
          updated_at: string
          wins: number
        }
        Insert: {
          club_id: string
          competition_id: string
          draws?: number
          goals_against?: number
          goals_for?: number
          id?: string
          losses?: number
          phase_id: string
          played?: number
          points?: number
          standing_rank?: number | null
          tie_break?: Json | null
          updated_at?: string
          wins?: number
        }
        Update: {
          club_id?: string
          competition_id?: string
          draws?: number
          goals_against?: number
          goals_for?: number
          id?: string
          losses?: number
          phase_id?: string
          played?: number
          points?: number
          standing_rank?: number | null
          tie_break?: Json | null
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "competition_standings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_standings_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_standings_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "competition_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          code: string | null
          created_at: string
          duration_unit: string
          duration_value: number
          id: string
          kind: string
          knockout_advance_count: number | null
          league_subtype: string | null
          metadata: Json
          name: string
          relegation_config: Json | null
          rewards: Json | null
          season_division_id: string | null
          season_id: string | null
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          duration_unit: string
          duration_value: number
          id?: string
          kind: string
          knockout_advance_count?: number | null
          league_subtype?: string | null
          metadata?: Json
          name: string
          relegation_config?: Json | null
          rewards?: Json | null
          season_division_id?: string | null
          season_id?: string | null
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          duration_unit?: string
          duration_value?: number
          id?: string
          kind?: string
          knockout_advance_count?: number | null
          league_subtype?: string | null
          metadata?: Json
          name?: string
          relegation_config?: Json | null
          rewards?: Json | null
          season_division_id?: string | null
          season_id?: string | null
          status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_season_division_id_fkey"
            columns: ["season_division_id"]
            isOneToOne: false
            referencedRelation: "season_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_ledger_entries: {
        Row: {
          bro_cents_delta: number
          created_by: string | null
          currency_note: string | null
          exp_delta: number
          failure_reason: string | null
          flow_status: string | null
          id: string
          kind: string
          metadata: Json
          posted_at: string
          target_ref: string | null
          user_id: string | null
        }
        Insert: {
          bro_cents_delta?: number
          created_by?: string | null
          currency_note?: string | null
          exp_delta?: number
          failure_reason?: string | null
          flow_status?: string | null
          id?: string
          kind: string
          metadata?: Json
          posted_at?: string
          target_ref?: string | null
          user_id?: string | null
        }
        Update: {
          bro_cents_delta?: number
          created_by?: string | null
          currency_note?: string | null
          exp_delta?: number
          failure_reason?: string | null
          flow_status?: string | null
          id?: string
          kind?: string
          metadata?: Json
          posted_at?: string
          target_ref?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fixtures: {
        Row: {
          aggregate_away_goals: number | null
          aggregate_home_goals: number | null
          away_club_id: string
          competition_id: string
          created_at: string
          home_club_id: string
          id: string
          leg: number
          match_id: string | null
          metadata: Json
          phase_id: string
          round_index: number
          scheduled_at: string | null
          status: string
          tie_break_away_exp: number | null
          tie_break_home_exp: number | null
          updated_at: string
        }
        Insert: {
          aggregate_away_goals?: number | null
          aggregate_home_goals?: number | null
          away_club_id: string
          competition_id: string
          created_at?: string
          home_club_id: string
          id?: string
          leg?: number
          match_id?: string | null
          metadata?: Json
          phase_id: string
          round_index?: number
          scheduled_at?: string | null
          status?: string
          tie_break_away_exp?: number | null
          tie_break_home_exp?: number | null
          updated_at?: string
        }
        Update: {
          aggregate_away_goals?: number | null
          aggregate_home_goals?: number | null
          away_club_id?: string
          competition_id?: string
          created_at?: string
          home_club_id?: string
          id?: string
          leg?: number
          match_id?: string | null
          metadata?: Json
          phase_id?: string
          round_index?: number
          scheduled_at?: string | null
          status?: string
          tie_break_away_exp?: number | null
          tie_break_home_exp?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_club_id_fkey"
            columns: ["away_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_club_id_fkey"
            columns: ["home_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "competition_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      football_vocabulary: {
        Row: {
          canonical_phrase: string
          confirm_count: number
          context: string | null
          created_at: string | null
          formality_level: number | null
          id: string
          intent: string
          is_active: boolean | null
          language_type: string | null
          phrase: string
          region: string | null
          stem: string
          updated_at: string | null
        }
        Insert: {
          canonical_phrase: string
          confirm_count?: number
          context?: string | null
          created_at?: string | null
          formality_level?: number | null
          id?: string
          intent: string
          is_active?: boolean | null
          language_type?: string | null
          phrase: string
          region?: string | null
          stem: string
          updated_at?: string | null
        }
        Update: {
          canonical_phrase?: string
          confirm_count?: number
          context?: string | null
          created_at?: string | null
          formality_level?: number | null
          id?: string
          intent?: string
          is_active?: boolean | null
          language_type?: string | null
          phrase?: string
          region?: string | null
          stem?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fraud_alerts: {
        Row: {
          amount_cents: number | null
          blocked: boolean
          created_at: string
          id: string
          metadata: Json | null
          operation_type: string
          reason: string
          risk_level: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          blocked?: boolean
          created_at?: string
          id?: string
          metadata?: Json | null
          operation_type: string
          reason: string
          risk_level: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          blocked?: boolean
          created_at?: string
          id?: string
          metadata?: Json | null
          operation_type?: string
          reason?: string
          risk_level?: string
          user_id?: string
        }
        Relationships: []
      }
      friendly_challenges: {
        Row: {
          accepted_at: string | null
          bet_bro_cents: number | null
          bet_currency: string
          bet_exp: number | null
          challenged_club_id: string
          challenged_club_name: string
          challenger_club_id: string
          challenger_club_name: string
          created_at: string
          expires_at: string
          id: string
          mode: string
          simulation_seed: number | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          bet_bro_cents?: number | null
          bet_currency: string
          bet_exp?: number | null
          challenged_club_id: string
          challenged_club_name: string
          challenger_club_id: string
          challenger_club_name: string
          created_at?: string
          expires_at: string
          id?: string
          mode: string
          simulation_seed?: number | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          bet_bro_cents?: number | null
          bet_currency?: string
          bet_exp?: number | null
          challenged_club_id?: string
          challenged_club_name?: string
          challenger_club_id?: string
          challenger_club_name?: string
          created_at?: string
          expires_at?: string
          id?: string
          mode?: string
          simulation_seed?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendly_challenges_challenged_club_id_fkey"
            columns: ["challenged_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendly_challenges_challenger_club_id_fkey"
            columns: ["challenger_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      game_saves: {
        Row: {
          checksum: string | null
          created_at: string
          id: string
          name: string
          schema_version: string
          slot_index: number
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          id?: string
          name?: string
          schema_version?: string
          slot_index: number
          state: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          id?: string
          name?: string
          schema_version?: string
          slot_index?: number
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      game_spirit_ai_logs: {
        Row: {
          club_id: string | null
          created_at: string
          error: string | null
          id: string
          input_summary: Json
          latency_ms: number | null
          match_id: string | null
          model: string | null
          output_json: Json
          provider: string
          request_fingerprint: string
          source: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input_summary?: Json
          latency_ms?: number | null
          match_id?: string | null
          model?: string | null
          output_json?: Json
          provider?: string
          request_fingerprint: string
          source?: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input_summary?: Json
          latency_ms?: number | null
          match_id?: string | null
          model?: string | null
          output_json?: Json
          provider?: string
          request_fingerprint?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_spirit_ai_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_spirit_ai_logs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      game_spirit_knowledge: {
        Row: {
          content: Json
          domain: string
          id: string
          key: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          content?: Json
          domain?: string
          id?: string
          key: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          content?: Json
          domain?: string
          id?: string
          key?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_spirit_knowledge_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "game_spirit_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_spirit_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          metadata: Json
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          metadata?: Json
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          metadata?: Json
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_spirit_rules: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          payload: Json
          profile_id: string
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          payload?: Json
          profile_id: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          payload?: Json
          profile_id?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_spirit_rules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "game_spirit_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_spirit_snapshots: {
        Row: {
          created_at: string
          id: string
          label: string
          payload: Json
          profile_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          payload: Json
          profile_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          payload?: Json
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_spirit_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "game_spirit_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_spirit_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          locale: string
          profile_id: string
          sort_order: number
          template_key: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          locale?: string
          profile_id: string
          sort_order?: number
          template_key: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          locale?: string
          profile_id?: string
          sort_order?: number
          template_key?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "game_spirit_templates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "game_spirit_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_market_players: {
        Row: {
          admin_market_tag: string | null
          age: number | null
          archetype: string
          attributes: Json
          behavior: string
          beneficiary_user_id: string | null
          bio: string | null
          card_supply: number | null
          collection_id: string | null
          contract_is_lifetime: boolean
          contract_matches_included: number
          country: string | null
          created_at: string
          creator_label: string | null
          evolution_rate: number | null
          evolution_xp: number
          fatigue: number
          id: string
          injury_risk: number
          kit_number: number
          listed_on_market: boolean
          market_value_bro_cents: number
          market_value_exp: number
          mint_overall: number | null
          name: string
          out_for_matches: number
          payment_split: Json | null
          portrait_media_refs: Json | null
          portrait_public_url: string | null
          portrait_storage_path: string | null
          portrait_token_public_url: string | null
          pos: string
          pos_original: string | null
          price_bro_cents: number
          price_exp: number
          rarity_label: string | null
          spirit_notes: string | null
          strong_foot: string | null
          updated_at: string
          zone: string
        }
        Insert: {
          admin_market_tag?: string | null
          age?: number | null
          archetype: string
          attributes?: Json
          behavior: string
          beneficiary_user_id?: string | null
          bio?: string | null
          card_supply?: number | null
          collection_id?: string | null
          contract_is_lifetime?: boolean
          contract_matches_included?: number
          country?: string | null
          created_at?: string
          creator_label?: string | null
          evolution_rate?: number | null
          evolution_xp?: number
          fatigue?: number
          id: string
          injury_risk?: number
          kit_number: number
          listed_on_market?: boolean
          market_value_bro_cents?: number
          market_value_exp?: number
          mint_overall?: number | null
          name: string
          out_for_matches?: number
          payment_split?: Json | null
          portrait_media_refs?: Json | null
          portrait_public_url?: string | null
          portrait_storage_path?: string | null
          portrait_token_public_url?: string | null
          pos: string
          pos_original?: string | null
          price_bro_cents?: number
          price_exp?: number
          rarity_label?: string | null
          spirit_notes?: string | null
          strong_foot?: string | null
          updated_at?: string
          zone: string
        }
        Update: {
          admin_market_tag?: string | null
          age?: number | null
          archetype?: string
          attributes?: Json
          behavior?: string
          beneficiary_user_id?: string | null
          bio?: string | null
          card_supply?: number | null
          collection_id?: string | null
          contract_is_lifetime?: boolean
          contract_matches_included?: number
          country?: string | null
          created_at?: string
          creator_label?: string | null
          evolution_rate?: number | null
          evolution_xp?: number
          fatigue?: number
          id?: string
          injury_risk?: number
          kit_number?: number
          listed_on_market?: boolean
          market_value_bro_cents?: number
          market_value_exp?: number
          mint_overall?: number | null
          name?: string
          out_for_matches?: number
          payment_split?: Json | null
          portrait_media_refs?: Json | null
          portrait_public_url?: string | null
          portrait_storage_path?: string | null
          portrait_token_public_url?: string | null
          pos?: string
          pos_original?: string | null
          price_bro_cents?: number
          price_exp?: number
          rarity_label?: string | null
          spirit_notes?: string | null
          strong_foot?: string | null
          updated_at?: string
          zone?: string
        }
        Relationships: []
      }
      global_league_events: {
        Row: {
          created_at: string | null
          event_type: string
          fixture_id: string
          highlight: boolean | null
          id: string
          minute: number
          player_id: string | null
          player_name: string | null
          side: string
          text: string
          timestamp_ms: number
        }
        Insert: {
          created_at?: string | null
          event_type: string
          fixture_id: string
          highlight?: boolean | null
          id: string
          minute: number
          player_id?: string | null
          player_name?: string | null
          side: string
          text: string
          timestamp_ms: number
        }
        Update: {
          created_at?: string | null
          event_type?: string
          fixture_id?: string
          highlight?: boolean | null
          id?: string
          minute?: number
          player_id?: string | null
          player_name?: string | null
          side?: string
          text?: string
          timestamp_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "global_league_events_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "global_league_fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      global_league_fixtures: {
        Row: {
          away_overall: number
          away_team_id: string
          away_team_name: string
          created_at: string | null
          current_minute: number | null
          division: string
          finished_at_ms: number | null
          home_overall: number
          home_team_id: string
          home_team_name: string
          id: string
          kickoff_ms: number | null
          round_id: string
          score_away: number | null
          score_home: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          away_overall: number
          away_team_id: string
          away_team_name: string
          created_at?: string | null
          current_minute?: number | null
          division: string
          finished_at_ms?: number | null
          home_overall: number
          home_team_id: string
          home_team_name: string
          id: string
          kickoff_ms?: number | null
          round_id: string
          score_away?: number | null
          score_home?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          away_overall?: number
          away_team_id?: string
          away_team_name?: string
          created_at?: string | null
          current_minute?: number | null
          division?: string
          finished_at_ms?: number | null
          home_overall?: number
          home_team_id?: string
          home_team_name?: string
          id?: string
          kickoff_ms?: number | null
          round_id?: string
          score_away?: number | null
          score_home?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_league_fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "global_league_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_league_fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "v_division_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_league_fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "v_playoff_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_league_fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "global_league_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_league_fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "v_division_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_league_fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "v_playoff_standings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_league_fixtures_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "global_league_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_league_fixtures_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      global_league_rounds: {
        Row: {
          actual_kickoff_ms: number | null
          created_at: string | null
          finished_at_ms: number | null
          id: string
          is_returning: boolean | null
          phase: string | null
          round_number: number
          round_type: string
          scheduled_kickoff_ms: number
          season_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          actual_kickoff_ms?: number | null
          created_at?: string | null
          finished_at_ms?: number | null
          id: string
          is_returning?: boolean | null
          phase?: string | null
          round_number: number
          round_type: string
          scheduled_kickoff_ms: number
          season_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          actual_kickoff_ms?: number | null
          created_at?: string | null
          finished_at_ms?: number | null
          id?: string
          is_returning?: boolean | null
          phase?: string | null
          round_number?: number
          round_type?: string
          scheduled_kickoff_ms?: number
          season_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      global_league_state: {
        Row: {
          created_at: string | null
          current_league_round: number | null
          current_playoff_round: number | null
          id: string
          min_teams_required: number | null
          promotion_percentage: number | null
          relegation_percentage: number | null
          season_id: string
          season_name: string
          status: string
          teams_per_division: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_league_round?: number | null
          current_playoff_round?: number | null
          id?: string
          min_teams_required?: number | null
          promotion_percentage?: number | null
          relegation_percentage?: number | null
          season_id: string
          season_name: string
          status?: string
          teams_per_division?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_league_round?: number | null
          current_playoff_round?: number | null
          id?: string
          min_teams_required?: number | null
          promotion_percentage?: number | null
          relegation_percentage?: number | null
          season_id?: string
          season_name?: string
          status?: string
          teams_per_division?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      global_league_teams: {
        Row: {
          club_name: string
          club_short: string
          division: number | null
          draws: number | null
          goal_difference: number | null
          goals_against: number | null
          goals_for: number | null
          id: string
          injury_modifier: number
          injury_rounds_remaining: number
          losses: number | null
          manager_id: string
          matches_played: number | null
          overall: number
          playoff_draws: number | null
          playoff_goals_against: number | null
          playoff_goals_for: number | null
          playoff_losses: number | null
          playoff_matches_played: number | null
          playoff_points: number | null
          playoff_wins: number | null
          points: number | null
          position: number | null
          previous_position: number | null
          recent_form: Json | null
          registered_at: string | null
          updated_at: string | null
          wins: number | null
        }
        Insert: {
          club_name: string
          club_short: string
          division?: number | null
          draws?: number | null
          goal_difference?: number | null
          goals_against?: number | null
          goals_for?: number | null
          id: string
          injury_modifier?: number
          injury_rounds_remaining?: number
          losses?: number | null
          manager_id: string
          matches_played?: number | null
          overall: number
          playoff_draws?: number | null
          playoff_goals_against?: number | null
          playoff_goals_for?: number | null
          playoff_losses?: number | null
          playoff_matches_played?: number | null
          playoff_points?: number | null
          playoff_wins?: number | null
          points?: number | null
          position?: number | null
          previous_position?: number | null
          recent_form?: Json | null
          registered_at?: string | null
          updated_at?: string | null
          wins?: number | null
        }
        Update: {
          club_name?: string
          club_short?: string
          division?: number | null
          draws?: number | null
          goal_difference?: number | null
          goals_against?: number | null
          goals_for?: number | null
          id?: string
          injury_modifier?: number
          injury_rounds_remaining?: number
          losses?: number | null
          manager_id?: string
          matches_played?: number | null
          overall?: number
          playoff_draws?: number | null
          playoff_goals_against?: number | null
          playoff_goals_for?: number | null
          playoff_losses?: number | null
          playoff_matches_played?: number | null
          playoff_points?: number | null
          playoff_wins?: number | null
          points?: number | null
          position?: number | null
          previous_position?: number | null
          recent_form?: Json | null
          registered_at?: string | null
          updated_at?: string | null
          wins?: number | null
        }
        Relationships: []
      }
      launch_counters: {
        Row: {
          id: number
          total_managers: number
          updated_at: string
          welcome_packs_claimed: number
          welcome_packs_limit: number
        }
        Insert: {
          id?: number
          total_managers?: number
          updated_at?: string
          welcome_packs_claimed?: number
          welcome_packs_limit?: number
        }
        Update: {
          id?: number
          total_managers?: number
          updated_at?: string
          welcome_packs_claimed?: number
          welcome_packs_limit?: number
        }
        Relationships: []
      }
      legacy_mentorships: {
        Row: {
          last_tick_at: string
          learned_attributes: Json
          legacy_id: string
          manager_id: string
          started_at: string
          student_player_id: string
          updated_at: string
        }
        Insert: {
          last_tick_at?: string
          learned_attributes?: Json
          legacy_id: string
          manager_id: string
          started_at?: string
          student_player_id: string
          updated_at?: string
        }
        Update: {
          last_tick_at?: string
          learned_attributes?: Json
          legacy_id?: string
          manager_id?: string
          started_at?: string
          student_player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_mentorships_legacy_id_fkey"
            columns: ["legacy_id"]
            isOneToOne: false
            referencedRelation: "legacy_players"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_players: {
        Row: {
          age: number | null
          attributes: Json
          beneficiary_user_id: string | null
          bio: string | null
          card_supply: number | null
          country: string | null
          created_at: string
          creator_label: string | null
          id: string
          listed_on_market: boolean
          name: string
          payment_split: Json | null
          portrait_public_url: string | null
          portrait_storage_path: string | null
          pos: string
          pos_original: string | null
          price_bro_cents: number
          rarity_label: string | null
          strong_foot: string | null
          taught_attributes: string[]
          team_booster: Json
          updated_at: string
        }
        Insert: {
          age?: number | null
          attributes?: Json
          beneficiary_user_id?: string | null
          bio?: string | null
          card_supply?: number | null
          country?: string | null
          created_at?: string
          creator_label?: string | null
          id: string
          listed_on_market?: boolean
          name: string
          payment_split?: Json | null
          portrait_public_url?: string | null
          portrait_storage_path?: string | null
          pos: string
          pos_original?: string | null
          price_bro_cents?: number
          rarity_label?: string | null
          strong_foot?: string | null
          taught_attributes?: string[]
          team_booster?: Json
          updated_at?: string
        }
        Update: {
          age?: number | null
          attributes?: Json
          beneficiary_user_id?: string | null
          bio?: string | null
          card_supply?: number | null
          country?: string | null
          created_at?: string
          creator_label?: string | null
          id?: string
          listed_on_market?: boolean
          name?: string
          payment_split?: Json | null
          portrait_public_url?: string | null
          portrait_storage_path?: string | null
          pos?: string
          pos_original?: string | null
          price_bro_cents?: number
          rarity_label?: string | null
          strong_foot?: string | null
          taught_attributes?: string[]
          team_booster?: Json
          updated_at?: string
        }
        Relationships: []
      }
      manager_friendships: {
        Row: {
          addressee_club_name: string | null
          addressee_id: string
          created_at: string
          id: string
          message: string | null
          requester_club_name: string | null
          requester_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          addressee_club_name?: string | null
          addressee_id: string
          created_at?: string
          id?: string
          message?: string | null
          requester_club_name?: string | null
          requester_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_club_name?: string | null
          addressee_id?: string
          created_at?: string
          id?: string
          message?: string | null
          requester_club_name?: string | null
          requester_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      manager_learned_phrases: {
        Row: {
          canonical_phrase: string
          confirm_count: number
          created_at: string
          id: string
          intent: string
          manager_id: string
          phrase: string
          stem: string
          updated_at: string
        }
        Insert: {
          canonical_phrase: string
          confirm_count?: number
          created_at?: string
          id?: string
          intent: string
          manager_id: string
          phrase: string
          stem: string
          updated_at?: string
        }
        Update: {
          canonical_phrase?: string
          confirm_count?: number
          created_at?: string
          id?: string
          intent?: string
          manager_id?: string
          phrase?: string
          stem?: string
          updated_at?: string
        }
        Relationships: []
      }
      manager_owned_skills: {
        Row: {
          acquired_at: string
          acquired_via: string
          skill_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          acquired_via: string
          skill_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          acquired_via?: string
          skill_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_owned_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "coach_skills_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_skill_assignments: {
        Row: {
          assigned_at: string
          player_entity_id: string
          skill_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          player_entity_id: string
          skill_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          player_entity_id?: string
          skill_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_skill_assignments_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "coach_skills_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_squad: {
        Row: {
          formation_scheme: string | null
          lineup: Json
          players: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          formation_scheme?: string | null
          lineup?: Json
          players?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          formation_scheme?: string | null
          lineup?: Json
          players?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      manager_voice_commands: {
        Row: {
          assistant: string | null
          created_at: string
          effective_obedience: number | null
          id: string
          individual_obedience: number | null
          intent: string
          manager_id: string
          match_id: string | null
          minute: number | null
          raw_text: string | null
          target_player_id: string | null
          team_obedience_at_time: number | null
          tier: string | null
        }
        Insert: {
          assistant?: string | null
          created_at?: string
          effective_obedience?: number | null
          id?: string
          individual_obedience?: number | null
          intent: string
          manager_id: string
          match_id?: string | null
          minute?: number | null
          raw_text?: string | null
          target_player_id?: string | null
          team_obedience_at_time?: number | null
          tier?: string | null
        }
        Update: {
          assistant?: string | null
          created_at?: string
          effective_obedience?: number | null
          id?: string
          individual_obedience?: number | null
          intent?: string
          manager_id?: string
          match_id?: string | null
          minute?: number | null
          raw_text?: string | null
          target_player_id?: string | null
          team_obedience_at_time?: number | null
          tier?: string | null
        }
        Relationships: []
      }
      market_purchases: {
        Row: {
          genesis_id: string
          id: string
          mint_overall: number
          price_exp: number
          purchased_at: string
          user_id: string
        }
        Insert: {
          genesis_id: string
          id?: string
          mint_overall: number
          price_exp: number
          purchased_at?: string
          user_id: string
        }
        Update: {
          genesis_id?: string
          id?: string
          mint_overall?: number
          price_exp?: number
          purchased_at?: string
          user_id?: string
        }
        Relationships: []
      }
      match_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          match_id: string
          minute: number
          payload: Json
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          match_id: string
          minute?: number
          payload?: Json
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          match_id?: string
          minute?: number
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_club_id: string | null
          away_name: string | null
          competition_id: string | null
          created_at: string
          ended_at: string | null
          fixture_id: string | null
          home_club_id: string
          id: string
          mode: string
          post_match_data: Json | null
          score_away: number
          score_home: number
          simulation_seed: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          away_club_id?: string | null
          away_name?: string | null
          competition_id?: string | null
          created_at?: string
          ended_at?: string | null
          fixture_id?: string | null
          home_club_id: string
          id?: string
          mode: string
          post_match_data?: Json | null
          score_away?: number
          score_home?: number
          simulation_seed?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          away_club_id?: string | null
          away_name?: string | null
          competition_id?: string | null
          created_at?: string
          ended_at?: string | null
          fixture_id?: string | null
          home_club_id?: string
          id?: string
          mode?: string
          post_match_data?: Json | null
          score_away?: number
          score_home?: number
          simulation_seed?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_club_id_fkey"
            columns: ["away_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_club_id_fkey"
            columns: ["home_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_templates: {
        Row: {
          active: boolean
          batch_id: string | null
          category: string
          context_tags: string[] | null
          generated_at: string
          id: string
          intensity: string
          persona_vibe: string | null
          quality_rating: number
          template: string
          usage_count: number
          variables: Json | null
        }
        Insert: {
          active?: boolean
          batch_id?: string | null
          category: string
          context_tags?: string[] | null
          generated_at?: string
          id?: string
          intensity: string
          persona_vibe?: string | null
          quality_rating?: number
          template: string
          usage_count?: number
          variables?: Json | null
        }
        Update: {
          active?: boolean
          batch_id?: string | null
          category?: string
          context_tags?: string[] | null
          generated_at?: string
          id?: string
          intensity?: string
          persona_vibe?: string | null
          quality_rating?: number
          template?: string
          usage_count?: number
          variables?: Json | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          expires_at: string | null
          id: string
          link: string | null
          message: string | null
          payload: Json | null
          read: boolean
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          expires_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          payload?: Json | null
          read?: boolean
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          payload?: Json | null
          read?: boolean
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_accounts: {
        Row: {
          auth_user_id: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      player_blueprints: {
        Row: {
          archetype: string | null
          attrs: Json
          created_at: string
          created_by: string | null
          creator_type: string | null
          display_name: string | null
          id: string
          metadata: Json
          name: string
          portrait_url: string | null
          rarity: string | null
          schema_version: string
          status: string
          updated_at: string
        }
        Insert: {
          archetype?: string | null
          attrs?: Json
          created_at?: string
          created_by?: string | null
          creator_type?: string | null
          display_name?: string | null
          id?: string
          metadata?: Json
          name: string
          portrait_url?: string | null
          rarity?: string | null
          schema_version?: string
          status?: string
          updated_at?: string
        }
        Update: {
          archetype?: string | null
          attrs?: Json
          created_at?: string
          created_by?: string | null
          creator_type?: string | null
          display_name?: string | null
          id?: string
          metadata?: Json
          name?: string
          portrait_url?: string | null
          rarity?: string | null
          schema_version?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          archetype: string
          attributes: Json
          behavior: string
          club_id: string
          created_at: string
          display_name: string | null
          evolution_xp: number
          fatigue: number
          id: string
          injury_risk: number
          name: string
          num: number
          out_for_matches: number
          pos: string
          schema_version: string
          updated_at: string
          zone: string
        }
        Insert: {
          archetype?: string
          attributes?: Json
          behavior?: string
          club_id: string
          created_at?: string
          display_name?: string | null
          evolution_xp?: number
          fatigue?: number
          id?: string
          injury_risk?: number
          name?: string
          num?: number
          out_for_matches?: number
          pos?: string
          schema_version?: string
          updated_at?: string
          zone?: string
        }
        Update: {
          archetype?: string
          attributes?: Json
          behavior?: string
          club_id?: string
          created_at?: string
          display_name?: string | null
          evolution_xp?: number
          fatigue?: number
          id?: string
          injury_risk?: number
          name?: string
          num?: number
          out_for_matches?: number
          pos?: string
          schema_version?: string
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_payouts: {
        Row: {
          amount_exp: number
          created_at: string
          id: number
          percent: number
          player_id: string
          player_name: string | null
          purchase_id: string | null
          split_kind: string
          user_id: string
        }
        Insert: {
          amount_exp: number
          created_at?: string
          id?: number
          percent: number
          player_id: string
          player_name?: string | null
          purchase_id?: string | null
          split_kind: string
          user_id: string
        }
        Update: {
          amount_exp?: number
          created_at?: string
          id?: number
          percent?: number
          player_id?: string
          player_name?: string | null
          purchase_id?: string | null
          split_kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_payouts_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "market_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      profanity_words: {
        Row: {
          active: boolean
          added_at: string
          added_by: string | null
          word: string
        }
        Insert: {
          active?: boolean
          added_at?: string
          added_by?: string | null
          word: string
        }
        Update: {
          active?: boolean
          added_at?: string
          added_by?: string | null
          word?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          club_id: string | null
          club_name: string | null
          club_short: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_data: Json | null
          onboarding_status: string
          referral_code: string
          referred_by_code: string | null
          sports_club_id: string | null
          status: string
          updated_at: string
          verification_data: Json | null
          verification_rejection_reason: string | null
          verification_reviewed_at: string | null
          verification_status: string
          verification_submitted_at: string | null
          verified: boolean
        }
        Insert: {
          club_id?: string | null
          club_name?: string | null
          club_short?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_data?: Json | null
          onboarding_status?: string
          referral_code: string
          referred_by_code?: string | null
          sports_club_id?: string | null
          status?: string
          updated_at?: string
          verification_data?: Json | null
          verification_rejection_reason?: string | null
          verification_reviewed_at?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          verified?: boolean
        }
        Update: {
          club_id?: string | null
          club_name?: string | null
          club_short?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_data?: Json | null
          onboarding_status?: string
          referral_code?: string
          referred_by_code?: string | null
          sports_club_id?: string | null
          status?: string
          updated_at?: string
          verification_data?: Json | null
          verification_rejection_reason?: string | null
          verification_reviewed_at?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_sports_club_id_fkey"
            columns: ["sports_club_id"]
            isOneToOne: false
            referencedRelation: "sports_clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      season_division_memberships: {
        Row: {
          club_id: string
          id: string
          joined_at: string
          metadata: Json
          season_division_id: string
        }
        Insert: {
          club_id: string
          id?: string
          joined_at?: string
          metadata?: Json
          season_division_id: string
        }
        Update: {
          club_id?: string
          id?: string
          joined_at?: string
          metadata?: Json
          season_division_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_division_memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_division_memberships_season_division_id_fkey"
            columns: ["season_division_id"]
            isOneToOne: false
            referencedRelation: "season_divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      season_divisions: {
        Row: {
          created_at: string
          id: string
          max_clubs: number
          metadata: Json
          name: string
          season_id: string
          tier: number
        }
        Insert: {
          created_at?: string
          id?: string
          max_clubs?: number
          metadata?: Json
          name: string
          season_id: string
          tier: number
        }
        Update: {
          created_at?: string
          id?: string
          max_clubs?: number
          metadata?: Json
          name?: string
          season_id?: string
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_divisions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          code: string | null
          created_at: string
          ends_at: string
          id: string
          metadata: Json
          name: string
          promotion_count: number
          relegation_count: number
          starts_at: string
          tie_break_order: Json
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          ends_at: string
          id?: string
          metadata?: Json
          name: string
          promotion_count?: number
          relegation_count?: number
          starts_at: string
          tie_break_order?: Json
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          metadata?: Json
          name?: string
          promotion_count?: number
          relegation_count?: number
          starts_at?: string
          tie_break_order?: Json
          updated_at?: string
        }
        Relationships: []
      }
      sports_clubs: {
        Row: {
          city: string
          colors: Json
          country: string
          created_at: string
          external_id: string
          id: string
          is_active: boolean
          league_id: string
          logo_url: string | null
          metadata: Json
          name: string
          short_name: string
          updated_at: string
        }
        Insert: {
          city?: string
          colors?: Json
          country?: string
          created_at?: string
          external_id: string
          id?: string
          is_active?: boolean
          league_id: string
          logo_url?: string | null
          metadata?: Json
          name: string
          short_name?: string
          updated_at?: string
        }
        Update: {
          city?: string
          colors?: Json
          country?: string
          created_at?: string
          external_id?: string
          id?: string
          is_active?: boolean
          league_id?: string
          logo_url?: string | null
          metadata?: Json
          name?: string
          short_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_clubs_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "sports_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_data_imports: {
        Row: {
          clubs_touched: number
          created_at: string
          errors: Json
          id: string
          imported_by: string | null
          leagues_touched: number
          raw_checksum: string | null
          source: string
        }
        Insert: {
          clubs_touched?: number
          created_at?: string
          errors?: Json
          id?: string
          imported_by?: string | null
          leagues_touched?: number
          raw_checksum?: string | null
          source?: string
        }
        Update: {
          clubs_touched?: number
          created_at?: string
          errors?: Json
          id?: string
          imported_by?: string | null
          leagues_touched?: number
          raw_checksum?: string | null
          source?: string
        }
        Relationships: []
      }
      sports_leagues: {
        Row: {
          country: string
          created_at: string
          external_id: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          season_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          external_id: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          season_label?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          external_id?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          season_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_2fa_config: {
        Row: {
          backup_codes: string[] | null
          created_at: string
          enabled: boolean
          enabled_at: string | null
          last_used_at: string | null
          secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes?: string[] | null
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          last_used_at?: string | null
          secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes?: string[] | null
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          last_used_at?: string | null
          secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_backups: {
        Row: {
          checksum: string
          created_at: string
          id: string
          user_id: string
          wallet_snapshot: Json
        }
        Insert: {
          checksum: string
          created_at?: string
          id?: string
          user_id: string
          wallet_snapshot: Json
        }
        Update: {
          checksum?: string
          created_at?: string
          id?: string
          user_id?: string
          wallet_snapshot?: Json
        }
        Relationships: []
      }
      wallet_credits: {
        Row: {
          applied_at: string | null
          bro_cents: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          bro_cents: number
          created_at?: string
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          bro_cents?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_division_standings: {
        Row: {
          calculated_position: number | null
          club_name: string | null
          club_short: string | null
          division: number | null
          draws: number | null
          goal_difference: number | null
          goals_against: number | null
          goals_for: number | null
          id: string | null
          losses: number | null
          manager_id: string | null
          matches_played: number | null
          overall: number | null
          points: number | null
          position: number | null
          previous_position: number | null
          recent_form: Json | null
          wins: number | null
        }
        Relationships: []
      }
      v_playoff_standings: {
        Row: {
          club_name: string | null
          club_short: string | null
          id: string | null
          manager_id: string | null
          overall: number | null
          playoff_draws: number | null
          playoff_goal_difference: number | null
          playoff_goals_against: number | null
          playoff_goals_for: number | null
          playoff_losses: number | null
          playoff_matches_played: number | null
          playoff_points: number | null
          playoff_position: number | null
          playoff_wins: number | null
        }
        Relationships: []
      }
      v_upcoming_rounds: {
        Row: {
          finished_fixtures: number | null
          id: string | null
          round_number: number | null
          round_type: string | null
          scheduled_kickoff_ms: number | null
          season_id: string | null
          status: string | null
          total_fixtures: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_add_profanity: { Args: { p_word: string }; Returns: boolean }
      admin_approve_beta_tester: {
        Args: { p_notes?: string; p_tester_id: string }
        Returns: {
          email: string
          id: string
          invite_code: string
          status: string
        }[]
      }
      admin_broadcast_stats: {
        Args: { p_limit?: number }
        Returns: {
          active: boolean
          category: string
          created_at: string
          deliveries: number
          id: string
          title: string
        }[]
      }
      admin_delete_learned_phrase: {
        Args: { p_phrase: string }
        Returns: number
      }
      admin_insert_narrative_batch: {
        Args: { p_templates: Json }
        Returns: string
      }
      admin_invite_beta_tester: {
        Args: { p_email: string; p_notes?: string; p_source?: string }
        Returns: {
          email: string
          id: string
          invite_code: string
        }[]
      }
      admin_list_profiles: {
        Args: never
        Returns: {
          club_name: string
          club_short: string
          created_at: string
          display_name: string
          id: string
          onboarding_data: Json
          referred_by_code: string
          updated_at: string
        }[]
      }
      admin_list_top_referrers: {
        Args: { p_limit?: number }
        Returns: {
          first_referral_at: string
          last_referral_at: string
          referred_by_code: string
          referred_count: number
        }[]
      }
      admin_list_verifications: {
        Args: { p_status?: string }
        Returns: {
          club_name: string
          display_name: string
          id: string
          verification_data: Json
          verification_rejection_reason: string
          verification_reviewed_at: string
          verification_status: string
          verification_submitted_at: string
        }[]
      }
      admin_narrative_stats: {
        Args: never
        Returns: {
          avg_quality: number
          category: string
          intensity: string
          last_batch: string
          total: number
          total_usage: number
        }[]
      }
      admin_panel_disable_2fa: {
        Args: { p_email: string; p_verification_code: string }
        Returns: boolean
      }
      admin_panel_enable_2fa: {
        Args: { p_backup_codes: string[]; p_email: string; p_secret: string }
        Returns: boolean
      }
      admin_panel_login:
        | {
            Args: { p_email: string; p_password: string }
            Returns: {
              display_name: string
              email: string
              role: string
            }[]
          }
        | {
            Args: {
              p_email: string
              p_ip_address?: string
              p_password: string
              p_user_agent?: string
            }
            Returns: {
              display_name: string
              email: string
              role: string
            }[]
          }
        | {
            Args: {
              p_email: string
              p_ip_address?: string
              p_password: string
              p_two_factor_code?: string
              p_user_agent?: string
            }
            Returns: {
              display_name: string
              email: string
              role: string
              two_factor_enabled: boolean
            }[]
          }
      admin_panel_set_password: {
        Args: {
          p_display_name?: string
          p_email: string
          p_new_password: string
        }
        Returns: undefined
      }
      admin_read_audit_log: {
        Args: { p_limit?: number; p_table?: string }
        Returns: {
          id: number
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          operation: string
          row_id: string
          table_name: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "audit_log"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_remove_profanity: { Args: { p_word: string }; Returns: boolean }
      admin_revoke_beta_access: {
        Args: { p_reason?: string; p_tester_id: string }
        Returns: boolean
      }
      admin_send_broadcast: {
        Args: {
          p_body: string
          p_category?: string
          p_deep_link?: string
          p_expires_at?: string
          p_title: string
        }
        Returns: {
          active: boolean
          audience: string
          body: string
          category: string
          created_at: string
          created_by: string | null
          deep_link: string | null
          expires_at: string | null
          id: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "admin_broadcasts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_platform_config: {
        Args: { p_key: string; p_value: Json }
        Returns: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        SetofOptions: {
          from: "*"
          to: "platform_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_user_status:
        | { Args: { p_status: string; p_user_id: string }; Returns: boolean }
        | {
            Args: {
              p_admin_email?: string
              p_ip_address?: string
              p_status: string
              p_user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_admin_email?: string
              p_csrf_token?: string
              p_ip_address?: string
              p_status: string
              p_user_id: string
            }
            Returns: boolean
          }
      admin_set_verification: {
        Args: { p_approved: boolean; p_reason?: string; p_user_id: string }
        Returns: undefined
      }
      admin_top_learned_phrases: {
        Args: { p_intent?: string; p_limit?: number }
        Returns: {
          canonical_phrase: string
          distinct_managers: number
          intent: string
          last_confirmed_at: string
          phrase: string
          stem: string
          total_confirms: number
        }[]
      }
      admin_update_player_link: {
        Args: {
          p_beneficiary_user_id: string
          p_payment_split: Json
          p_player_id: string
          p_table: string
        }
        Returns: undefined
      }
      bump_narrative_usage: { Args: { p_ids: string[] }; Returns: undefined }
      check_admin_ip_allowed: {
        Args: { p_ip_address: string }
        Returns: boolean
      }
      check_admin_login_rate_limit: {
        Args: { p_email: string; p_ip_address?: string }
        Returns: {
          blocked: boolean
          reason: string
          retry_after_seconds: number
        }[]
      }
      check_email_exists: { Args: { p_email: string }; Returns: boolean }
      claim_welcome_pack: {
        Args: { p_manager_id: string }
        Returns: {
          claimed: boolean
          queue_position: number
          remaining: number
          welcome_packs_claimed: number
          welcome_packs_limit: number
        }[]
      }
      cleanup_expired_csrf_tokens: { Args: never; Returns: number }
      cleanup_old_admin_logs: { Args: never; Returns: undefined }
      cleanup_old_wallet_backups: { Args: never; Returns: undefined }
      consume_broadcasts: {
        Args: never
        Returns: {
          active: boolean
          audience: string
          body: string
          category: string
          created_at: string
          created_by: string | null
          deep_link: string | null
          expires_at: string | null
          id: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "admin_broadcasts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      distribute_player_sale: {
        Args: {
          p_player_id: string
          p_price_exp: number
          p_purchase_id: string
        }
        Returns: undefined
      }
      generate_beta_invite_code: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_division_teams: {
        Args: { div: number }
        Returns: {
          club_name: string
          id: string
          points: number
          team_position: number
        }[]
      }
      get_league_stats: {
        Args: never
        Returns: {
          teams_in_league: number
          teams_in_playoffs: number
          total_goals: number
          total_matches: number
          total_teams: number
        }[]
      }
      get_manager_learned_phrases: {
        Args: { p_limit?: number; p_user_id?: string }
        Returns: {
          canonical_phrase: string
          confirm_count: number
          created_at: string
          id: string
          intent: string
          manager_id: string
          phrase: string
          stem: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "manager_learned_phrases"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_manager_persona: {
        Args: { p_user_id?: string }
        Returns: {
          accepted_count: number
          avg_effective_obedience: number
          first_command_at: string
          last_command_at: string
          refused_count: number
          top_assistant: string
          top_assistant_count: number
          top_intent: string
          top_intent_count: number
          total_commands: number
        }[]
      }
      get_my_linked_cards: {
        Args: never
        Returns: {
          beneficiary_user_id: string
          id: string
          listed_on_market: boolean
          name: string
          payment_split: Json
          portrait_public_url: string
          pos: string
          price_bro_cents: number
          rarity_label: string
          source: string
        }[]
      }
      get_my_onboarding_profile: {
        Args: never
        Returns: {
          club_name: string
          club_short: string
          display_name: string
          onboarding_data: Json
        }[]
      }
      get_my_owned_skills: {
        Args: never
        Returns: {
          acquired_at: string
          acquired_via: string
          payload: Json
          skill_id: string
        }[]
      }
      get_my_pro_payouts: {
        Args: { p_limit?: number }
        Returns: {
          amount_exp: number
          created_at: string
          id: number
          percent: number
          player_id: string
          player_name: string
          split_kind: string
        }[]
      }
      get_my_pro_summary: {
        Args: never
        Returns: {
          balance_exp: number
          last_sale_at: string
          total_sales: number
        }[]
      }
      get_my_referral_code: { Args: never; Returns: string }
      get_my_referrals: {
        Args: never
        Returns: {
          club_name: string
          club_short: string
          created_at: string
          display_name: string
          id: string
        }[]
      }
      get_my_status: { Args: never; Returns: string }
      get_my_verification: {
        Args: never
        Returns: {
          verification_data: Json
          verification_rejection_reason: string
          verification_reviewed_at: string
          verification_status: string
          verification_submitted_at: string
          verified: boolean
        }[]
      }
      get_narrative_templates: {
        Args: { p_category?: string; p_limit?: number }
        Returns: {
          active: boolean
          batch_id: string | null
          category: string
          context_tags: string[] | null
          generated_at: string
          id: string
          intensity: string
          persona_vibe: string | null
          quality_rating: number
          template: string
          usage_count: number
          variables: Json | null
        }[]
        SetofOptions: {
          from: "*"
          to: "narrative_templates"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_skills_catalog: {
        Args: never
        Returns: {
          active: boolean
          created_at: string
          id: string
          level: number
          name: string
          payload: Json
          role: string
          schema_version: number
          tier: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "coach_skills_catalog"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      increment_vocabulary_usage: {
        Args: { p_phrase_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action: string
          p_admin_email: string
          p_details?: Json
          p_ip_address?: string
          p_target_resource?: string
          p_target_user_id?: string
          p_user_agent?: string
        }
        Returns: string
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      my_club_id: { Args: never; Returns: string }
      process_admin_login_notifications: { Args: never; Returns: number }
      purchase_skill: {
        Args: { p_currency: string; p_skill_id: string }
        Returns: {
          acquired_at: string
          acquired_via: string
          skill_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "manager_owned_skills"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rate_narrative_template: {
        Args: { p_id: string; p_positive: boolean }
        Returns: undefined
      }
      record_learned_phrase: {
        Args: {
          p_canonical_phrase: string
          p_intent: string
          p_phrase: string
          p_stem: string
        }
        Returns: string
      }
      record_voice_command: {
        Args: {
          p_assistant: string
          p_effective_obedience: number
          p_individual_obedience: number
          p_intent: string
          p_match_id: string
          p_minute: number
          p_raw_text: string
          p_target_player_id: string
          p_team_obedience_at_time: number
          p_tier: string
        }
        Returns: string
      }
      redeem_beta_invite: { Args: { p_invite_code: string }; Returns: boolean }
      save_onboarding_profile: {
        Args: {
          p_club_name: string
          p_club_short: string
          p_display_name: string
          p_onboarding_data: Json
          p_referred_by_code?: string
        }
        Returns: undefined
      }
      search_clubs_for_friendly: {
        Args: { max_results?: number; search: string }
        Returns: {
          club_id: string
          name: string
          short_name: string
        }[]
      }
      set_legacy_mentor: {
        Args: { p_legacy_id: string; p_student_player_id: string }
        Returns: {
          last_tick_at: string
          learned_attributes: Json
          legacy_id: string
          manager_id: string
          started_at: string
          student_player_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "legacy_mentorships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_verification: { Args: { p_data: Json }; Returns: undefined }
      tick_legacy_mentorships: {
        Args: { p_manager_id?: string }
        Returns: {
          learned_attributes: Json
          legacy_id: string
          student_player_id: string
          ticks_applied: number
        }[]
      }
      validate_admin_csrf_token: {
        Args: { p_admin_email: string; p_token: string }
        Returns: boolean
      }
      validate_payment_split: { Args: { p_split: Json }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
