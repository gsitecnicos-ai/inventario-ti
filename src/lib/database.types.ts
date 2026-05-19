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
      global_admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      activities: {
        Row: {
          asset_id: string | null;
          created_at: string;
          description: string;
          id: string;
          occurred_at: string;
          tenant_id: string;
          title: string;
        };
        Insert: {
          asset_id?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          occurred_at?: string;
          tenant_id: string;
          title: string;
        };
        Update: {
          asset_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          occurred_at?: string;
          tenant_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          created_at: string;
          criticality: Database["public"]["Enums"]["asset_criticality"];
          id: string;
          location: string;
          model: string;
          owner: string;
          status: Database["public"]["Enums"]["asset_status"];
          tag: string;
          tenant_id: string;
          type: string;
          unit_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          criticality?: Database["public"]["Enums"]["asset_criticality"];
          id?: string;
          location: string;
          model: string;
          owner: string;
          status?: Database["public"]["Enums"]["asset_status"];
          tag: string;
          tenant_id: string;
          type: string;
          unit_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          criticality?: Database["public"]["Enums"]["asset_criticality"];
          id?: string;
          location?: string;
          model?: string;
          owner?: string;
          status?: Database["public"]["Enums"]["asset_status"];
          tag?: string;
          tenant_id?: string;
          type?: string;
          unit_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assets_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      software_inventory: {
        Row: {
          created_at: string;
          first_seen: string;
          id: string;
          last_seen: string;
          name: string;
          publisher: string;
          tenant_id: string;
          updated_at: string;
          version: string;
        };
        Insert: {
          created_at?: string;
          first_seen?: string;
          id?: string;
          last_seen?: string;
          name: string;
          publisher?: string;
          tenant_id: string;
          updated_at?: string;
          version?: string;
        };
        Update: {
          created_at?: string;
          first_seen?: string;
          id?: string;
          last_seen?: string;
          name?: string;
          publisher?: string;
          tenant_id?: string;
          updated_at?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "software_inventory_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_software: {
        Row: {
          asset_id: string;
          created_at: string;
          id: string;
          installed_at: string;
          software_inventory_id: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          id?: string;
          installed_at?: string;
          software_inventory_id: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          id?: string;
          installed_at?: string;
          software_inventory_id?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_software_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_software_software_inventory_id_fkey";
            columns: ["software_inventory_id"];
            isOneToOne: false;
            referencedRelation: "software_inventory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_software_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      hardware_history: {
        Row: {
          asset_id: string;
          created_at: string;
          event_type: Database["public"]["Enums"]["hardware_history_event"];
          hardware_key: "ram" | "storage" | "os";
          id: string;
          metadata: Json;
          new_value: string;
          observed_at: string;
          old_value: string | null;
          source: string;
          tenant_id: string;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          event_type: Database["public"]["Enums"]["hardware_history_event"];
          hardware_key: "ram" | "storage" | "os";
          id?: string;
          metadata?: Json;
          new_value: string;
          observed_at?: string;
          old_value?: string | null;
          source?: string;
          tenant_id: string;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          event_type?: Database["public"]["Enums"]["hardware_history_event"];
          hardware_key?: "ram" | "storage" | "os";
          id?: string;
          metadata?: Json;
          new_value?: string;
          observed_at?: string;
          old_value?: string | null;
          source?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hardware_history_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hardware_history_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_heartbeats: {
        Row: {
          asset_id: string;
          created_at: string;
          cpu_usage_percent: number | null;
          device_id: string;
          hostname: string;
          id: string;
          ip_address: string | null;
          last_heartbeat_at: string;
          last_seen_at: string;
          memory_usage_percent: number | null;
          status: string;
          tenant_id: string;
          updated_at: string;
          uptime_seconds: number | null;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          cpu_usage_percent?: number | null;
          device_id: string;
          hostname: string;
          id?: string;
          ip_address?: string | null;
          last_heartbeat_at?: string;
          last_seen_at?: string;
          memory_usage_percent?: number | null;
          status?: string;
          tenant_id: string;
          updated_at?: string;
          uptime_seconds?: number | null;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          cpu_usage_percent?: number | null;
          device_id?: string;
          hostname?: string;
          id?: string;
          ip_address?: string | null;
          last_heartbeat_at?: string;
          last_seen_at?: string;
          memory_usage_percent?: number | null;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
          uptime_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_heartbeats_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_heartbeats_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_members: {
        Row: {
          created_at: string;
          role: "owner" | "admin" | "operator" | "viewer";
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role: "owner" | "admin" | "operator" | "viewer";
          tenant_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: "owner" | "admin" | "operator" | "viewer";
          tenant_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          address_line: string | null;
          agent_api_key: string | null;
          agent_api_key_hash: string | null;
          city: string | null;
          cnpj: string | null;
          compliance: number;
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          id: string;
          logo_url: string | null;
          name: string;
          postal_code: string | null;
          segment: string;
          slug: string;
          state: string | null;
          updated_at: string;
        };
        Insert: {
          address_line?: string | null;
          agent_api_key?: string | null;
          agent_api_key_hash?: string | null;
          city?: string | null;
          cnpj?: string | null;
          compliance?: number;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name: string;
          postal_code?: string | null;
          segment: string;
          slug: string;
          state?: string | null;
          updated_at?: string;
        };
        Update: {
          address_line?: string | null;
          agent_api_key?: string | null;
          agent_api_key_hash?: string | null;
          city?: string | null;
          cnpj?: string | null;
          compliance?: number;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          postal_code?: string | null;
          segment?: string;
          slug?: string;
          state?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      units: {
        Row: {
          city: string | null;
          created_at: string;
          id: string;
          name: string;
          tenant_id: string;
        };
        Insert: {
          city?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          tenant_id: string;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "units_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      alerts: {
        Row: {
          id: string;
          tenant_id: string;
          asset_id: string | null;
          alert_type: string;
          severity: string;
          title: string;
          description: string | null;
          device_id: string | null;
          hostname: string | null;
          detected_at: string;
          resolved_at: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          asset_id?: string | null;
          alert_type: string;
          severity?: string;
          title: string;
          description?: string | null;
          device_id?: string | null;
          hostname?: string | null;
          detected_at?: string;
          resolved_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          asset_id?: string | null;
          alert_type?: string;
          severity?: string;
          title?: string;
          description?: string | null;
          device_id?: string | null;
          hostname?: string | null;
          detected_at?: string;
          resolved_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      compliance_rules: {
        Row: {
          id: string;
          tenant_id: string;
          rule_type: string;
          name: string;
          description: string | null;
          enabled: boolean;
          severity: string;
          parameters: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          rule_type: string;
          name: string;
          description?: string | null;
          enabled?: boolean;
          severity?: string;
          parameters?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          rule_type?: string;
          name?: string;
          description?: string | null;
          enabled?: boolean;
          severity?: string;
          parameters?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      device_compliance_status: {
        Row: {
          id: string;
          tenant_id: string;
          asset_id: string;
          compliance_score: number;
          violations_count: number;
          critical_violations: number;
          has_antivirus: boolean;
          windows_updated: boolean | null;
          forbidden_software_found: string[] | null;
          last_check_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          asset_id: string;
          compliance_score?: number;
          violations_count?: number;
          critical_violations?: number;
          has_antivirus?: boolean;
          windows_updated?: boolean | null;
          forbidden_software_found?: string[] | null;
          last_check_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          asset_id?: string;
          compliance_score?: number;
          violations_count?: number;
          critical_violations?: number;
          has_antivirus?: boolean;
          windows_updated?: boolean | null;
          forbidden_software_found?: string[] | null;
          last_check_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      can_manage_assets: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_tenant_summaries: {
        Args: Record<PropertyKey, never>;
        Returns: {
          assets: number;
          pending: number;
          tenant_id: string;
          units: number;
        }[];
      };
      is_tenant_admin: {
        Args: { target_tenant_id: string };
        Returns: boolean;
      };
      is_global_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_tenant_member: {
        Args: { target_tenant_id: string };
        Returns: boolean;
      };
      is_tenant_operator: {
        Args: { target_tenant_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      asset_criticality: "Baixa" | "Media" | "Alta";
      asset_status: "Em uso" | "Atencao" | "Manutencao" | "Estoque";
      hardware_history_event:
        | "initial_snapshot"
        | "ram_upgrade"
        | "storage_change"
        | "os_change";
    };
    CompositeTypes: Record<string, never>;
  };
};
