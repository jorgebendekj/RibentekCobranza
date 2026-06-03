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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_agent_configs: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          mcp_url: string | null
          system_prompt: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          mcp_url?: string | null
          system_prompt?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          mcp_url?: string | null
          system_prompt?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          last_interaction: string | null
          name: string
          phone_number: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          last_interaction?: string | null
          name: string
          phone_number?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          last_interaction?: string | null
          name?: string
          phone_number?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_detail_qrs: {
        Row: {
          created_at: string
          created_by: string | null
          debt_detail_id: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          qr_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          debt_detail_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          qr_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          debt_detail_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          qr_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_detail_qrs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_detail_qrs_debt_detail_id_fkey"
            columns: ["debt_detail_id"]
            isOneToOne: false
            referencedRelation: "debt_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_detail_qrs_debt_detail_id_fkey"
            columns: ["debt_detail_id"]
            isOneToOne: false
            referencedRelation: "v_active_debt_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_detail_qrs_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_detail_qrs_qr_id_fkey"
            columns: ["qr_id"]
            isOneToOne: false
            referencedRelation: "qrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_detail_qrs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_details: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          debt_amount: number
          debt_description: string | null
          debt_id: string
          debt_status: Database["public"]["Enums"]["debt_status"]
          deleted_at: string | null
          deleted_by: string | null
          expiration_date: string
          id: string
          penalty_amount: number
          total: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          debt_amount: number
          debt_description?: string | null
          debt_id: string
          debt_status?: Database["public"]["Enums"]["debt_status"]
          deleted_at?: string | null
          deleted_by?: string | null
          expiration_date: string
          id?: string
          penalty_amount?: number
          total: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          debt_amount?: number
          debt_description?: string | null
          debt_id?: string
          debt_status?: Database["public"]["Enums"]["debt_status"]
          deleted_at?: string | null
          deleted_by?: string | null
          expiration_date?: string
          id?: string
          penalty_amount?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_details_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_details_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_details_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_details_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_details_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "v_active_debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_details_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_details_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          debt_count: number
          debt_paid_count: number
          debt_pending_count: number
          debt_status: Database["public"]["Enums"]["debt_status"]
          deleted_at: string | null
          deleted_by: string | null
          id: string
          tenant_id: string
          total_debt: number
          total_paid: number
          total_pending: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          debt_count?: number
          debt_paid_count?: number
          debt_pending_count?: number
          debt_status?: Database["public"]["Enums"]["debt_status"]
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          tenant_id: string
          total_debt?: number
          total_paid?: number
          total_pending?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          debt_count?: number
          debt_paid_count?: number
          debt_pending_count?: number
          debt_status?: Database["public"]["Enums"]["debt_status"]
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          tenant_id?: string
          total_debt?: number
          total_paid?: number
          total_pending?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          payload: Json
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          payload?: Json
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          payload?: Json
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          enabled_email: boolean
          enabled_in_app: boolean
          event_type: string
          id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enabled_email?: boolean
          enabled_in_app?: boolean
          event_type: string
          id?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enabled_email?: boolean
          enabled_in_app?: boolean
          event_type?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          event_id: string | null
          id: string
          is_read: boolean
          read_at: string | null
          severity: string
          tenant_id: string
          title: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          event_id?: string | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          severity?: string
          tenant_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          event_id?: string | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          severity?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      qrs: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          expiration_date: string | null
          external_id: string | null
          id: string
          paid: boolean
          paid_at: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expiration_date?: string | null
          external_id?: string | null
          id?: string
          paid?: boolean
          paid_at?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expiration_date?: string | null
          external_id?: string | null
          id?: string
          paid?: boolean
          paid_at?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qrs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qrs_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qrs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_logs: {
        Row: {
          created_at: string
          created_by: string | null
          debt_detail_id: string
          deleted_at: string | null
          deleted_by: string | null
          error_message: string | null
          id: string
          reminder_program_id: string
          sent_at: string | null
          sent_status: Database["public"]["Enums"]["sent_status"]
          success: boolean
          updated_at: string
          updated_by: string | null
          whatsapp_template_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          debt_detail_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          error_message?: string | null
          id?: string
          reminder_program_id: string
          sent_at?: string | null
          sent_status?: Database["public"]["Enums"]["sent_status"]
          success?: boolean
          updated_at?: string
          updated_by?: string | null
          whatsapp_template_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          debt_detail_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          error_message?: string | null
          id?: string
          reminder_program_id?: string
          sent_at?: string | null
          sent_status?: Database["public"]["Enums"]["sent_status"]
          success?: boolean
          updated_at?: string
          updated_by?: string | null
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_debt_detail_id_fkey"
            columns: ["debt_detail_id"]
            isOneToOne: false
            referencedRelation: "debt_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_debt_detail_id_fkey"
            columns: ["debt_detail_id"]
            isOneToOne: false
            referencedRelation: "v_active_debt_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_reminder_program_id_fkey"
            columns: ["reminder_program_id"]
            isOneToOne: false
            referencedRelation: "reminder_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_whatsapp_template_id_fkey"
            columns: ["whatsapp_template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_programs: {
        Row: {
          created_at: string
          created_by: string | null
          days_ref_debt: number
          deleted_at: string | null
          deleted_by: string | null
          id: string
          reminder_count: number
          reminder_id: string
          reminder_sent_count: number
          reminder_sent_error: number
          reminder_sent_pending: number
          updated_at: string
          updated_by: string | null
          whatsapp_template_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days_ref_debt: number
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          reminder_count?: number
          reminder_id: string
          reminder_sent_count?: number
          reminder_sent_error?: number
          reminder_sent_pending?: number
          updated_at?: string
          updated_by?: string | null
          whatsapp_template_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days_ref_debt?: number
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          reminder_count?: number
          reminder_id?: string
          reminder_sent_count?: number
          reminder_sent_error?: number
          reminder_sent_pending?: number
          updated_at?: string
          updated_by?: string | null
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_programs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_programs_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_programs_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_programs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_programs_whatsapp_template_id_fkey"
            columns: ["whatsapp_template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          action_type: Database["public"]["Enums"]["reminder_action_type"]
          created_at: string
          created_by: string | null
          debt_id: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action_type?: Database["public"]["Enums"]["reminder_action_type"]
          created_at?: string
          created_by?: string | null
          debt_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["reminder_action_type"]
          created_at?: string
          created_by?: string | null
          debt_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "v_active_debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          duration_in_days: number
          id: string
          name: string
          price: number
          renewable: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          duration_in_days?: number
          id?: string
          name: string
          price: number
          renewable?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          duration_in_days?: number
          id?: string
          name?: string
          price?: number
          renewable?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plans_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plans_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_qrs: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          qr_id: string
          subscription_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          qr_id: string
          subscription_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          qr_id?: string
          subscription_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_qrs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_qrs_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_qrs_qr_id_fkey"
            columns: ["qr_id"]
            isOneToOne: false
            referencedRelation: "qrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_qrs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_qrs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          enable: boolean
          expiration_date: string
          id: string
          price: number
          subscription_plan_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enable?: boolean
          expiration_date: string
          id?: string
          price: number
          subscription_plan_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enable?: boolean
          expiration_date?: string
          id?: string
          price?: number
          subscription_plan_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invites: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          expires_at: string
          id: string
          role: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email: string
          expires_at?: string
          id?: string
          role: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          role?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          deleted_at: string | null
          enabled: boolean
          id: string
          role: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          enabled?: boolean
          id?: string
          role: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          enabled?: boolean
          id?: string
          role?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          name: string
          nit: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          name: string
          nit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          name?: string
          nit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          enabled: boolean
          id: string
          last_login: string | null
          name: string
          role: string
          role_description: string | null
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          enabled?: boolean
          id?: string
          last_login?: string | null
          name: string
          role: string
          role_description?: string | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          enabled?: boolean
          id?: string
          last_login?: string | null
          name?: string
          role?: string
          role_description?: string | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_configurations: {
        Row: {
          channel_name: string | null
          created_at: string
          created_by: string | null
          default_template_language: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          meta_id: string
          phone_number_id: string | null
          tenant_id: string
          token: string
          updated_at: string
          updated_by: string | null
          verify_token: string | null
          waba_id: string
        }
        Insert: {
          channel_name?: string | null
          created_at?: string
          created_by?: string | null
          default_template_language?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          meta_id: string
          phone_number_id?: string | null
          tenant_id: string
          token: string
          updated_at?: string
          updated_by?: string | null
          verify_token?: string | null
          waba_id: string
        }
        Update: {
          channel_name?: string | null
          created_at?: string
          created_by?: string | null
          default_template_language?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          meta_id?: string
          phone_number_id?: string | null
          tenant_id?: string
          token?: string
          updated_at?: string
          updated_by?: string | null
          verify_token?: string | null
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_configurations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_configurations_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_configurations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_configurations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mass_send_recipients: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          error_message: string | null
          id: string
          mass_send_id: string
          mass_send_run_id: string
          meta_message_id: string | null
          phone_number: string
          sent_at: string | null
          status: string
          template_name: string
          updated_at: string
          updated_by: string | null
          whatsapp_message_id: string | null
          whatsapp_thread_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          error_message?: string | null
          id?: string
          mass_send_id: string
          mass_send_run_id: string
          meta_message_id?: string | null
          phone_number: string
          sent_at?: string | null
          status: string
          template_name: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_message_id?: string | null
          whatsapp_thread_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          error_message?: string | null
          id?: string
          mass_send_id?: string
          mass_send_run_id?: string
          meta_message_id?: string | null
          phone_number?: string
          sent_at?: string | null
          status?: string
          template_name?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_message_id?: string | null
          whatsapp_thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mass_send_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_recipients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_recipients_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_recipients_mass_send_id_fkey"
            columns: ["mass_send_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mass_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_recipients_mass_send_run_id_fkey"
            columns: ["mass_send_run_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mass_send_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_recipients_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_recipients_whatsapp_message_id_fkey"
            columns: ["whatsapp_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_recipients_whatsapp_thread_id_fkey"
            columns: ["whatsapp_thread_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mass_send_runs: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          error_summary: string | null
          failed_count: number
          finished_at: string | null
          id: string
          mass_send_id: string
          sent_count: number
          skipped_count: number
          started_at: string
          status: string
          tenant_id: string
          total_recipients: number
          trigger_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          error_summary?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          mass_send_id: string
          sent_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
          tenant_id: string
          total_recipients?: number
          trigger_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          error_summary?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          mass_send_id?: string
          sent_count?: number
          skipped_count?: number
          started_at?: string
          status?: string
          tenant_id?: string
          total_recipients?: number
          trigger_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mass_send_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_runs_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_runs_mass_send_id_fkey"
            columns: ["mass_send_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mass_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_runs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mass_send_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          cron_expression: string
          deleted_at: string | null
          deleted_by: string | null
          enabled: boolean
          id: string
          last_run_at: string | null
          mass_send_id: string
          next_run_at: string | null
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cron_expression: string
          deleted_at?: string | null
          deleted_by?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          mass_send_id: string
          next_run_at?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cron_expression?: string
          deleted_at?: string | null
          deleted_by?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          mass_send_id?: string
          next_run_at?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mass_send_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_schedules_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_schedules_mass_send_id_fkey"
            columns: ["mass_send_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mass_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_send_schedules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mass_sends: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          filters: Json
          id: string
          language: string
          mode: string
          name: string
          status: string
          template_name: string
          template_parameters: Json
          tenant_id: string
          updated_at: string
          updated_by: string | null
          whatsapp_template_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          filters?: Json
          id?: string
          language?: string
          mode?: string
          name: string
          status?: string
          template_name: string
          template_parameters?: Json
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_template_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          filters?: Json
          id?: string
          language?: string
          mode?: string
          name?: string
          status?: string
          template_name?: string
          template_parameters?: Json
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mass_sends_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_sends_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_sends_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_sends_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_sends_whatsapp_template_id_fkey"
            columns: ["whatsapp_template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          incoming: boolean
          mass_send_id: string | null
          mass_send_run_id: string | null
          media_url: string | null
          message_text: string | null
          read: boolean
          read_at: string | null
          reminder_log_id: string | null
          sent_at: string | null
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
          whatsapp_thread_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          incoming?: boolean
          mass_send_id?: string | null
          mass_send_run_id?: string | null
          media_url?: string | null
          message_text?: string | null
          read?: boolean
          read_at?: string | null
          reminder_log_id?: string | null
          sent_at?: string | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp_thread_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          incoming?: boolean
          mass_send_id?: string | null
          mass_send_run_id?: string | null
          media_url?: string | null
          message_text?: string | null
          read?: boolean
          read_at?: string | null
          reminder_log_id?: string | null
          sent_at?: string | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          whatsapp_thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_whatsapp_messages_reminder_log"
            columns: ["reminder_log_id"]
            isOneToOne: false
            referencedRelation: "reminder_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_mass_send_id_fkey"
            columns: ["mass_send_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mass_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_mass_send_run_id_fkey"
            columns: ["mass_send_run_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mass_send_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_whatsapp_thread_id_fkey"
            columns: ["whatsapp_thread_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          args: string[] | null
          category: string
          components: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          format_type: Database["public"]["Enums"]["template_format_type"]
          header_format: Database["public"]["Enums"]["whatsapp_template_header_format"]
          id: string
          language: string
          meta_status: string
          meta_template_id: string | null
          quality_score: string | null
          rejection_reason: string | null
          template_name: string
          template_type: Database["public"]["Enums"]["whatsapp_template_type"]
          updated_at: string
          updated_by: string | null
          whatsapp_configuration_id: string
        }
        Insert: {
          args?: string[] | null
          category?: string
          components?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          format_type?: Database["public"]["Enums"]["template_format_type"]
          header_format?: Database["public"]["Enums"]["whatsapp_template_header_format"]
          id?: string
          language?: string
          meta_status?: string
          meta_template_id?: string | null
          quality_score?: string | null
          rejection_reason?: string | null
          template_name: string
          template_type?: Database["public"]["Enums"]["whatsapp_template_type"]
          updated_at?: string
          updated_by?: string | null
          whatsapp_configuration_id: string
        }
        Update: {
          args?: string[] | null
          category?: string
          components?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          format_type?: Database["public"]["Enums"]["template_format_type"]
          header_format?: Database["public"]["Enums"]["whatsapp_template_header_format"]
          id?: string
          language?: string
          meta_status?: string
          meta_template_id?: string | null
          quality_score?: string | null
          rejection_reason?: string | null
          template_name?: string
          template_type?: Database["public"]["Enums"]["whatsapp_template_type"]
          updated_at?: string
          updated_by?: string | null
          whatsapp_configuration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_whatsapp_configuration_id_fkey"
            columns: ["whatsapp_configuration_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_threads: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          last_inbound_at: string | null
          last_interaction: string | null
          last_message: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          window_expires_at: string | null
          window_open: boolean
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          last_inbound_at?: string | null
          last_interaction?: string | null
          last_message?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          window_expires_at?: string | null
          window_open?: boolean
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          last_inbound_at?: string | null
          last_interaction?: string | null
          last_message?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          window_expires_at?: string | null
          window_open?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_threads_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_threads_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_active_contacts: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string | null
          last_interaction: string | null
          name: string | null
          phone_number: string | null
          tenant_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string | null
          last_interaction?: string | null
          name?: string | null
          phone_number?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string | null
          last_interaction?: string | null
          name?: string | null
          phone_number?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      v_active_debt_details: {
        Row: {
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          debt_amount: number | null
          debt_description: string | null
          debt_id: string | null
          debt_status: Database["public"]["Enums"]["debt_status"] | null
          deleted_at: string | null
          deleted_by: string | null
          expiration_date: string | null
          id: string | null
          penalty_amount: number | null
          total: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          debt_amount?: number | null
          debt_description?: string | null
          debt_id?: string | null
          debt_status?: Database["public"]["Enums"]["debt_status"] | null
          deleted_at?: string | null
          deleted_by?: string | null
          expiration_date?: string | null
          id?: string | null
          penalty_amount?: number | null
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          debt_amount?: number | null
          debt_description?: string | null
          debt_id?: string | null
          debt_status?: Database["public"]["Enums"]["debt_status"] | null
          deleted_at?: string | null
          deleted_by?: string | null
          expiration_date?: string | null
          id?: string | null
          penalty_amount?: number | null
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_details_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_details_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_details_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_details_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_details_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "v_active_debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_details_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_details_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      v_active_debts: {
        Row: {
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          debt_count: number | null
          debt_paid_count: number | null
          debt_pending_count: number | null
          debt_status: Database["public"]["Enums"]["debt_status"] | null
          deleted_at: string | null
          deleted_by: string | null
          id: string | null
          tenant_id: string | null
          total_debt: number | null
          total_paid: number | null
          total_pending: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          debt_count?: number | null
          debt_paid_count?: number | null
          debt_pending_count?: number | null
          debt_status?: Database["public"]["Enums"]["debt_status"] | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string | null
          tenant_id?: string | null
          total_debt?: number | null
          total_paid?: number | null
          total_pending?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          debt_count?: number | null
          debt_paid_count?: number | null
          debt_pending_count?: number | null
          debt_status?: Database["public"]["Enums"]["debt_status"] | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string | null
          tenant_id?: string | null
          total_debt?: number | null
          total_paid?: number | null
          total_pending?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_active_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_has_tenant_access: {
        Args: { allowed_roles?: string[]; target_tenant_id: string }
        Returns: boolean
      }
      current_user_role: { Args: never; Returns: string }
      current_user_tenant: { Args: never; Returns: string }
      has_tenant_admin_access: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: boolean
      }
      is_global_superadmin: { Args: never; Returns: boolean }
      recalc_debts_aggregate: {
        Args: { p_contact_id: string; p_tenant_id: string }
        Returns: undefined
      }
    }
    Enums: {
      debt_status: "Pending" | "Active" | "Paid" | "Expired"
      reminder_action_type: "manually" | "automatically"
      sent_status: "Pending" | "Sent"
      template_format_type: "named" | "positional"
      whatsapp_template_header_format:
        | "NONE"
        | "TEXT"
        | "IMAGE"
        | "VIDEO"
        | "DOCUMENT"
      whatsapp_template_type: "STANDARD" | "CAROUSEL" | "FLOW"
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
      debt_status: ["Pending", "Active", "Paid", "Expired"],
      reminder_action_type: ["manually", "automatically"],
      sent_status: ["Pending", "Sent"],
      template_format_type: ["named", "positional"],
      whatsapp_template_header_format: [
        "NONE",
        "TEXT",
        "IMAGE",
        "VIDEO",
        "DOCUMENT",
      ],
      whatsapp_template_type: ["STANDARD", "CAROUSEL", "FLOW"],
    },
  },
} as const
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type DbUser = Database['public']['Tables']['users']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type WhatsappConfiguration = Database['public']['Tables']['whatsapp_configurations']['Row'];
export type WhatsappTemplate = Database['public']['Tables']['whatsapp_templates']['Row'];
export type WhatsappThread = Database['public']['Tables']['whatsapp_threads']['Row'];
export type WhatsappMessage = Database['public']['Tables']['whatsapp_messages']['Row'];
export type Debt = Database['public']['Tables']['debts']['Row'];
export type DebtDetail = Database['public']['Tables']['debt_details']['Row'];
export type Reminder = Database['public']['Tables']['reminders']['Row'];
export type ReminderProgram = Database['public']['Tables']['reminder_programs']['Row'];
export type ReminderLog = Database['public']['Tables']['reminder_logs']['Row'];
export type WhatsappMassSend = Database['public']['Tables']['whatsapp_mass_sends']['Row'];
export type WhatsappMassSendRun = Database['public']['Tables']['whatsapp_mass_send_runs']['Row'];
export type WhatsappMassSendRecipient = Database['public']['Tables']['whatsapp_mass_send_recipients']['Row'];
export type NotificationEvent = Database['public']['Tables']['notification_events']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type NotificationPreference = Database['public']['Tables']['notification_preferences']['Row'];

export type UserRole = Database['public']['Enums']['user_role'];
export type DebtStatus = Database['public']['Enums']['debt_status'];
export type SentStatus = Database['public']['Enums']['sent_status'];
export type ReminderActionType = Database['public']['Enums']['reminder_action_type'];
export type TemplateFormatType = Database['public']['Enums']['template_format_type'];

export const DEBT_STATUS_LABELS: Record<DebtStatus, string> = {
  Pending: 'Pendiente',
  Active: 'En Gestión',
  Paid: 'Pagada',
  Expired: 'Vencida',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  Superadmin: 'Superadmin',
  Admin: 'Admin',
  Agente: 'Agente',
};

export type DebtDetailWithContact = DebtDetail & {
  contacts: Pick<Contact, 'name' | 'phone_number' | 'email'> | null;
  days_overdue?: number;
};

export type ThreadWithContact = WhatsappThread & {
  contacts: Pick<Contact, 'name' | 'phone_number'> | null;
  unread_count?: number;
};
