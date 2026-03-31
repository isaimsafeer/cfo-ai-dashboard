export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UUID = string;

// NOTE: This is a minimal schema shape used for typed Supabase queries.
// Update these table/column types to match your actual Supabase schema if needed.
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: UUID;
          name: string;
        };
        Insert: {
          id?: UUID;
          name: string;
        };
        Update: {
          id?: UUID;
          name?: string;
        };
      };
      users: {
        Row: {
          id: UUID;
          organization_id: UUID;
          email: string;
          role: "admin" | "technician" | "manager" | string;
        };
        Insert: {
          id?: UUID;
          organization_id: UUID;
          email: string;
          role?: "admin" | "technician" | "manager" | string;
        };
        Update: {
          id?: UUID;
          organization_id?: UUID;
          email?: string;
          role?: "admin" | "technician" | "manager" | string;
        };
      };
      projects: {
        Row: {
          id: UUID;
          organization_id: UUID;
          name: string;
          start_date: string; // ISO date (yyyy-mm-dd)
          surveys_count: number;
        };
        Insert: {
          id?: UUID;
          organization_id: UUID;
          name: string;
          start_date: string;
          surveys_count: number;
        };
        Update: {
          id?: UUID;
          organization_id?: UUID;
          name?: string;
          start_date?: string;
          surveys_count?: number;
        };
      };
      revenue: {
        Row: {
          id: UUID;
          project_id: UUID;
          amount: number;
          date: string; // ISO date (yyyy-mm-dd) or timestamp
        };
        Insert: {
          id?: UUID;
          project_id: UUID;
          amount: number;
          date: string;
        };
        Update: {
          id?: UUID;
          project_id?: UUID;
          amount?: number;
          date?: string;
        };
      };
      expenses: {
        Row: {
          id: UUID;
          project_id: UUID;
          amount: number;
          date: string; // ISO date (yyyy-mm-dd) or timestamp
          expense_type: string; // e.g. "travel"
          technician_id: UUID | null;
          description: string | null;
        };
        Insert: {
          id?: UUID;
          project_id: UUID;
          amount: number;
          date: string;
          expense_type: string;
          technician_id?: UUID | null;
          description?: string | null;
        };
        Update: {
          id?: UUID;
          project_id?: UUID;
          amount?: number;
          date?: string;
          expense_type?: string;
          technician_id?: UUID | null;
          description?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

