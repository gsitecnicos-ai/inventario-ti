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
    };
    CompositeTypes: Record<string, never>;
  };
};
