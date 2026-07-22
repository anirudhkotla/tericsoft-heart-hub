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
      agent_sessions: {
        Row: {
          cache_cleared_at: string
          created_at: string
          enabled_datasource_ids: string[]
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cache_cleared_at?: string
          created_at?: string
          enabled_datasource_ids?: string[]
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          cache_cleared_at?: string
          created_at?: string
          enabled_datasource_ids?: string[]
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          content: Json
          created_at: string
          id: string
          role: string
          session_id: string
          step_type: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          role: string
          session_id: string
          step_type?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          step_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          created_at: string
          created_by: string
          description: string | null
          end_at: string | null
          event_type: string
          id: string
          location: string | null
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          end_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          end_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          created_at: string
          created_by: string
          cv_summary: string | null
          email: string | null
          full_name: string
          id: string
          job_request_id: string
          notes: string | null
          phone: string | null
          rating: number | null
          source: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          cv_summary?: string | null
          email?: string | null
          full_name: string
          id?: string
          job_request_id: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          cv_summary?: string | null
          email?: string | null
          full_name?: string
          id?: string
          job_request_id?: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_request_id_fkey"
            columns: ["job_request_id"]
            isOneToOne: false
            referencedRelation: "job_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          config: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      datasources: {
        Row: {
          config: Json
          created_at: string
          created_by: string
          id: string
          name: string
          provider: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string
          id?: string
          name: string
          provider?: string
          type?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          provider?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      datasource_secrets: {
        Row: {
          created_at: string
          datasource_id: string
          secret: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          datasource_id: string
          secret?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          datasource_id?: string
          secret?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "datasource_secrets_datasource_id_fkey"
            columns: ["datasource_id"]
            isOneToOne: true
            referencedRelation: "datasources"
            referencedColumns: ["id"]
          },
        ]
      }
      datasource_tool_cache: {
        Row: {
          cached_at: string
          datasource_id: string
          tools: Json
        }
        Insert: {
          cached_at?: string
          datasource_id: string
          tools?: Json
        }
        Update: {
          cached_at?: string
          datasource_id?: string
          tools?: Json
        }
        Relationships: [
          {
            foreignKeyName: "datasource_tool_cache_datasource_id_fkey"
            columns: ["datasource_id"]
            isOneToOne: true
            referencedRelation: "datasources"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_pending: {
        Row: {
          client_id: string
          client_secret: string | null
          code_verifier: string
          created_at: string
          ds_name: string
          provider: string
          redirect_uri: string
          resource: string | null
          server_url: string
          state: string
          token_endpoint: string
          token_endpoint_auth_method: string
          user_id: string
        }
        Insert: {
          client_id: string
          client_secret?: string | null
          code_verifier: string
          created_at?: string
          ds_name: string
          provider: string
          redirect_uri: string
          resource?: string | null
          server_url: string
          state: string
          token_endpoint: string
          token_endpoint_auth_method?: string
          user_id: string
        }
        Update: {
          client_id?: string
          client_secret?: string | null
          code_verifier?: string
          created_at?: string
          ds_name?: string
          provider?: string
          redirect_uri?: string
          resource?: string | null
          server_url?: string
          state?: string
          token_endpoint?: string
          token_endpoint_auth_method?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          amount_inr: number | null
          category: string
          created_at: string
          currency: string
          id: string
          notes: string | null
          receipt_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          spent_on: string
          status: string
          submitted_by: string
          title: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          amount_inr?: number | null
          category?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spent_on?: string
          status?: string
          submitted_by?: string
          title: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          amount_inr?: number | null
          category?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spent_on?: string
          status?: string
          submitted_by?: string
          title?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      job_requests: {
        Row: {
          created_at: string
          created_by: string
          department: string | null
          description: string | null
          employment_type: string
          id: string
          location: string | null
          openings: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          department?: string | null
          description?: string | null
          employment_type?: string
          id?: string
          location?: string | null
          openings?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department?: string | null
          description?: string | null
          employment_type?: string
          id?: string
          location?: string | null
          openings?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      offer_letters: {
        Row: {
          candidate_id: string
          content: string
          created_at: string
          created_by: string
          details: Json
          id: string
          job_request_id: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          content?: string
          created_at?: string
          created_by: string
          details?: Json
          id?: string
          job_request_id?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          content?: string
          created_at?: string
          created_by?: string
          details?: Json
          id?: string
          job_request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_letters_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_letters_job_request_id_fkey"
            columns: ["job_request_id"]
            isOneToOne: false
            referencedRelation: "job_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          full_name: string | null
          id: string
          job_title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "hr" | "team_lead" | "evaluator"
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
    Enums: {
      app_role: ["admin", "hr", "team_lead", "evaluator"],
    },
  },
} as const
