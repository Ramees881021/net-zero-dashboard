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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_report_config: {
        Row: {
          boundary_approach: string
          created_at: string
          exclusions_log: string | null
          id: string
          methodology_notes: string | null
          reporting_year: number
          updated_at: string
          user_id: string
          verification_status: string
        }
        Insert: {
          boundary_approach?: string
          created_at?: string
          exclusions_log?: string | null
          id?: string
          methodology_notes?: string | null
          reporting_year: number
          updated_at?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          boundary_approach?: string
          created_at?: string
          exclusions_log?: string | null
          id?: string
          methodology_notes?: string | null
          reporting_year?: number
          updated_at?: string
          user_id?: string
          verification_status?: string
        }
        Relationships: []
      }
      business_units: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
          parent_bu_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          parent_bu_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          parent_bu_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_units_parent_bu_id_fkey"
            columns: ["parent_bu_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      carbon_audit_log: {
        Row: {
          action: string
          created_at: string
          entry_id: string
          id: string
          new_values: Json | null
          old_values: Json | null
          reason: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entry_id: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entry_id?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      carbon_budgets: {
        Row: {
          created_at: string
          discount_rate: number | null
          id: string
          organization_id: string | null
          scope_1_carbon_cost: number | null
          scope_2_carbon_cost: number | null
          scope_3_carbon_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_rate?: number | null
          id?: string
          organization_id?: string | null
          scope_1_carbon_cost?: number | null
          scope_2_carbon_cost?: number | null
          scope_3_carbon_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discount_rate?: number | null
          id?: string
          organization_id?: string | null
          scope_1_carbon_cost?: number | null
          scope_2_carbon_cost?: number | null
          scope_3_carbon_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carbon_budgets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      carbon_calc_entries: {
        Row: {
          activity_data: Json | null
          amount_tco2e: number
          business_unit_id: string | null
          category: string
          confidence_score: number | null
          created_at: string
          data_quality: string | null
          description: string | null
          emission_factor: number | null
          emission_factor_source: string | null
          id: string
          reporting_year: number
          scope: number
          site_id: string | null
          sub_category: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_data?: Json | null
          amount_tco2e?: number
          business_unit_id?: string | null
          category: string
          confidence_score?: number | null
          created_at?: string
          data_quality?: string | null
          description?: string | null
          emission_factor?: number | null
          emission_factor_source?: string | null
          id?: string
          reporting_year: number
          scope: number
          site_id?: string | null
          sub_category?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_data?: Json | null
          amount_tco2e?: number
          business_unit_id?: string | null
          category?: string
          confidence_score?: number | null
          created_at?: string
          data_quality?: string | null
          description?: string | null
          emission_factor?: number | null
          emission_factor_source?: string | null
          id?: string
          reporting_year?: number
          scope?: number
          site_id?: string | null
          sub_category?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carbon_calc_entries_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carbon_calc_entries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      carbon_entry_documents: {
        Row: {
          document_type: string
          entry_id: string
          file_name: string
          file_url: string
          id: string
          notes: string | null
          uploaded_at: string
          user_id: string
        }
        Insert: {
          document_type?: string
          entry_id: string
          file_name: string
          file_url: string
          id?: string
          notes?: string | null
          uploaded_at?: string
          user_id: string
        }
        Update: {
          document_type?: string
          entry_id?: string
          file_name?: string
          file_url?: string
          id?: string
          notes?: string | null
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          apportioned_emissions: number | null
          company_name: string
          country: string
          created_at: string
          id: string
          organization_id: string | null
          reporting_year: number
          revenue: number
          updated_at: string
          user_id: string
        }
        Insert: {
          apportioned_emissions?: number | null
          company_name: string
          country: string
          created_at?: string
          id?: string
          organization_id?: string | null
          reporting_year: number
          revenue?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          apportioned_emissions?: number | null
          company_name?: string
          country?: string
          created_at?: string
          id?: string
          organization_id?: string | null
          reporting_year?: number
          revenue?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_type_logos: {
        Row: {
          created_at: string
          credential_type: string
          id: string
          logo_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_type: string
          id?: string
          logo_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credential_type?: string
          id?: string
          logo_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emission_reduction_projects: {
        Row: {
          annual_emission_savings: number | null
          created_at: string
          description: string | null
          end_year: number | null
          id: string
          name: string
          organization_id: string | null
          project_cost: number | null
          scope_type: string
          start_year: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_emission_savings?: number | null
          created_at?: string
          description?: string | null
          end_year?: number | null
          id?: string
          name: string
          organization_id?: string | null
          project_cost?: number | null
          scope_type?: string
          start_year?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_emission_savings?: number | null
          created_at?: string
          description?: string | null
          end_year?: number | null
          id?: string
          name?: string
          organization_id?: string | null
          project_cost?: number | null
          scope_type?: string
          start_year?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emission_reduction_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      emissions_data: {
        Row: {
          cdp_score: string | null
          created_at: string
          ecovadis_score: number | null
          id: string
          organization_id: string | null
          reporting_year: number
          revenue: number | null
          sbti_target_status: string | null
          scope_1_emissions: number | null
          scope_2_emissions: number | null
          scope_2_location_based: number | null
          scope_3_emissions: number | null
          scope3_breakdown: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cdp_score?: string | null
          created_at?: string
          ecovadis_score?: number | null
          id?: string
          organization_id?: string | null
          reporting_year: number
          revenue?: number | null
          sbti_target_status?: string | null
          scope_1_emissions?: number | null
          scope_2_emissions?: number | null
          scope_2_location_based?: number | null
          scope_3_emissions?: number | null
          scope3_breakdown?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cdp_score?: string | null
          created_at?: string
          ecovadis_score?: number | null
          id?: string
          organization_id?: string | null
          reporting_year?: number
          revenue?: number | null
          sbti_target_status?: string | null
          scope_1_emissions?: number | null
          scope_2_emissions?: number | null
          scope_2_location_based?: number | null
          scope_3_emissions?: number | null
          scope3_breakdown?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emissions_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      industry_benchmarks: {
        Row: {
          avg_cdp_score: string | null
          avg_ecovadis_score: number | null
          avg_scope_1_intensity: number | null
          avg_scope_2_intensity: number | null
          avg_scope_3_intensity: number | null
          company_name: string
          created_at: string
          id: string
          industry: string
          is_leader: boolean | null
          sbti_adoption_rate: number | null
          year: number
        }
        Insert: {
          avg_cdp_score?: string | null
          avg_ecovadis_score?: number | null
          avg_scope_1_intensity?: number | null
          avg_scope_2_intensity?: number | null
          avg_scope_3_intensity?: number | null
          company_name: string
          created_at?: string
          id?: string
          industry: string
          is_leader?: boolean | null
          sbti_adoption_rate?: number | null
          year: number
        }
        Update: {
          avg_cdp_score?: string | null
          avg_ecovadis_score?: number | null
          avg_scope_1_intensity?: number | null
          avg_scope_2_intensity?: number | null
          avg_scope_3_intensity?: number | null
          company_name?: string
          created_at?: string
          id?: string
          industry?: string
          is_leader?: boolean | null
          sbti_adoption_rate?: number | null
          year?: number
        }
        Relationships: []
      }
      netzero_targets: {
        Row: {
          base_year: number
          created_at: string
          id: string
          near_term_target_year: number
          netzero_target_year: number
          organization_id: string | null
          scope_1_2_reduction_percent: number
          scope_3_reduction_percent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_year: number
          created_at?: string
          id?: string
          near_term_target_year: number
          netzero_target_year: number
          organization_id?: string | null
          scope_1_2_reduction_percent: number
          scope_3_reduction_percent: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_year?: number
          created_at?: string
          id?: string
          near_term_target_year?: number
          netzero_target_year?: number
          organization_id?: string | null
          scope_1_2_reduction_percent?: number
          scope_3_reduction_percent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "netzero_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          base_year: number | null
          company_size: string | null
          created_at: string
          currency: string
          id: string
          industry: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          base_year?: number | null
          company_size?: string | null
          created_at?: string
          currency?: string
          id?: string
          industry?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          base_year?: number | null
          company_size?: string | null
          created_at?: string
          currency?: string
          id?: string
          industry?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          banner_url: string | null
          base_year: number | null
          company_name: string
          company_size: string | null
          created_at: string
          currency: string
          email: string | null
          id: string
          industry: string | null
          is_approved: boolean
          logo_url: string | null
          organization_id: string | null
          period_end_day: number
          period_end_month: number
          period_start_day: number
          period_start_month: number
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          banner_url?: string | null
          base_year?: number | null
          company_name: string
          company_size?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          industry?: string | null
          is_approved?: boolean
          logo_url?: string | null
          organization_id?: string | null
          period_end_day?: number
          period_end_month?: number
          period_start_day?: number
          period_start_month?: number
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          banner_url?: string | null
          base_year?: number | null
          company_name?: string
          company_size?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          industry?: string | null
          is_approved?: boolean
          logo_url?: string | null
          organization_id?: string | null
          period_end_day?: number
          period_end_month?: number
          period_start_day?: number
          period_start_month?: number
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scope3_config: {
        Row: {
          category_code: string
          collection_method: string | null
          created_at: string
          id: string
          is_relevant: boolean | null
          notes: string | null
          reporting_year: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_code: string
          collection_method?: string | null
          created_at?: string
          id?: string
          is_relevant?: boolean | null
          notes?: string | null
          reporting_year: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_code?: string
          collection_method?: string | null
          created_at?: string
          id?: string
          is_relevant?: boolean | null
          notes?: string | null
          reporting_year?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          area_sqm: number | null
          business_unit_id: string | null
          country: string | null
          created_at: string
          employee_count: number | null
          grid_region: string | null
          id: string
          location: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_sqm?: number | null
          business_unit_id?: string | null
          country?: string | null
          created_at?: string
          employee_count?: number | null
          grid_region?: string | null
          id?: string
          location?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area_sqm?: number | null
          business_unit_id?: string | null
          country?: string | null
          created_at?: string
          employee_count?: number | null
          grid_region?: string | null
          id?: string
          location?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_data_cg: {
        Row: {
          asset_value_usd: number | null
          emission_factor_id: string | null
          id: string
          imported_at: string
          lifespan_years: number | null
          purchase_date: string | null
          reporting_year: number
          supplier_id: string
          tco2e: number | null
          user_id: string
        }
        Insert: {
          asset_value_usd?: number | null
          emission_factor_id?: string | null
          id?: string
          imported_at?: string
          lifespan_years?: number | null
          purchase_date?: string | null
          reporting_year: number
          supplier_id: string
          tco2e?: number | null
          user_id: string
        }
        Update: {
          asset_value_usd?: number | null
          emission_factor_id?: string | null
          id?: string
          imported_at?: string
          lifespan_years?: number | null
          purchase_date?: string | null
          reporting_year?: number
          supplier_id?: string
          tco2e?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_data_cg_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_master"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_data_pg: {
        Row: {
          emission_factor_id: string | null
          id: string
          imported_at: string
          quantity: number | null
          reporting_year: number
          spend_usd: number | null
          supplier_id: string
          tco2e: number | null
          unit: string | null
          user_id: string
        }
        Insert: {
          emission_factor_id?: string | null
          id?: string
          imported_at?: string
          quantity?: number | null
          reporting_year: number
          spend_usd?: number | null
          supplier_id: string
          tco2e?: number | null
          unit?: string | null
          user_id: string
        }
        Update: {
          emission_factor_id?: string | null
          id?: string
          imported_at?: string
          quantity?: number | null
          reporting_year?: number
          spend_usd?: number | null
          supplier_id?: string
          tco2e?: number | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_data_pg_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_master"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers_master: {
        Row: {
          ai_category: string | null
          ai_confidence: number | null
          created_at: string
          current_category: string
          description: string | null
          id: string
          last_classified_at: string | null
          name_display: string
          name_normalized: string
          user_id: string
          user_override_category: string | null
        }
        Insert: {
          ai_category?: string | null
          ai_confidence?: number | null
          created_at?: string
          current_category?: string
          description?: string | null
          id?: string
          last_classified_at?: string | null
          name_display: string
          name_normalized: string
          user_id: string
          user_override_category?: string | null
        }
        Update: {
          ai_category?: string | null
          ai_confidence?: number | null
          created_at?: string
          current_category?: string
          description?: string | null
          id?: string
          last_classified_at?: string | null
          name_display?: string
          name_normalized?: string
          user_id?: string
          user_override_category?: string | null
        }
        Relationships: []
      }
      sustainability_credentials: {
        Row: {
          attachment_url: string | null
          certificate_url: string | null
          created_at: string
          credential_name: string
          credential_type: string
          display_order: number | null
          id: string
          logo_url: string | null
          organization_id: string | null
          score_or_level: string | null
          status: string | null
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          attachment_url?: string | null
          certificate_url?: string | null
          created_at?: string
          credential_name: string
          credential_type: string
          display_order?: number | null
          id?: string
          logo_url?: string | null
          organization_id?: string | null
          score_or_level?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          attachment_url?: string | null
          certificate_url?: string | null
          created_at?: string
          credential_name?: string
          credential_type?: string
          display_order?: number | null
          id?: string
          logo_url?: string | null
          organization_id?: string | null
          score_or_level?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sustainability_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_org_role: {
        Args: {
          _role: Database["public"]["Enums"]["org_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin_or_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      org_role: "owner" | "admin" | "member"
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
      app_role: ["admin", "user"],
      org_role: ["owner", "admin", "member"],
    },
  },
} as const
