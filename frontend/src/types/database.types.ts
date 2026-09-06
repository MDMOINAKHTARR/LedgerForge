export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      agent_versions: {
        Row: {
          id: string
          version_name: string
          parent_version_id: string | null
          configuration: Json
          prompt_version: string | null
          matching_strategy: string | null
          confidence_threshold: number
          escalation_policy: Json
          verification_enabled: boolean
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          version_name: string
          parent_version_id?: string | null
          configuration?: Json
          prompt_version?: string | null
          matching_strategy?: string | null
          confidence_threshold?: number
          escalation_policy?: Json
          verification_enabled?: boolean
          status?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['agent_versions']['Insert']>
      }
      reconciliations: {
        Row: {
          id: string
          name: string
          status: string
          created_at: string
          completed_at: string | null
          agent_version_id: string | null
          total_transactions: number
          auto_reconciled_count: number
          escalated_count: number
          unmatched_count: number
          accuracy: number
          straight_through_rate: number
          false_auto_post_rate: number
          average_latency_ms: number
          estimated_cost: number
        }
        Insert: {
          id?: string
          name: string
          status?: string
          created_at?: string
          completed_at?: string | null
          agent_version_id?: string | null
          total_transactions?: number
          auto_reconciled_count?: number
          escalated_count?: number
          unmatched_count?: number
          accuracy?: number
          straight_through_rate?: number
          false_auto_post_rate?: number
          average_latency_ms?: number
          estimated_cost?: number
        }
        Update: Partial<Database['public']['Tables']['reconciliations']['Insert']>
      }
      bank_transactions: {
        Row: {
          id: string
          reconciliation_id: string
          external_transaction_id: string | null
          transaction_date: string
          amount: number
          currency: string
          description: string | null
          reference: string | null
          counterparty: string | null
          transaction_type: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          reconciliation_id: string
          external_transaction_id?: string | null
          transaction_date: string
          amount: number
          currency?: string
          description?: string | null
          reference?: string | null
          counterparty?: string | null
          transaction_type?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['bank_transactions']['Insert']>
      }
      ledger_transactions: {
        Row: {
          id: string
          reconciliation_id: string
          external_ledger_id: string | null
          invoice_id: string | null
          transaction_date: string
          amount: number
          currency: string
          description: string | null
          reference: string | null
          counterparty: string | null
          account: string | null
          transaction_type: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          reconciliation_id: string
          external_ledger_id?: string | null
          invoice_id?: string | null
          transaction_date: string
          amount: number
          currency?: string
          description?: string | null
          reference?: string | null
          counterparty?: string | null
          account?: string | null
          transaction_type?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['ledger_transactions']['Insert']>
      }
      matches: {
        Row: {
          id: string
          reconciliation_id: string
          bank_transaction_id: string
          ledger_transaction_id: string | null
          match_type: string
          match_score: number
          confidence: number
          evidence: Json
          is_selected: boolean
          created_at: string
        }
        Insert: {
          id?: string
          reconciliation_id: string
          bank_transaction_id: string
          ledger_transaction_id?: string | null
          match_type: string
          match_score?: number
          confidence: number
          evidence?: Json
          is_selected?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['matches']['Insert']>
      }
      decisions: {
        Row: {
          id: string
          reconciliation_id: string
          bank_transaction_id: string
          match_id: string | null
          decision: string
          confidence: number
          reason: string
          evidence: Json
          exception_type: string | null
          policy_checks: Json
          agent_version_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reconciliation_id: string
          bank_transaction_id: string
          match_id?: string | null
          decision: string
          confidence: number
          reason: string
          evidence?: Json
          exception_type?: string | null
          policy_checks?: Json
          agent_version_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['decisions']['Insert']>
      }
      audit_logs: {
        Row: {
          id: string
          reconciliation_id: string
          bank_transaction_id: string | null
          event_type: string
          stage: string
          message: string
          evidence: Json
          metadata: Json
          agent_version_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reconciliation_id: string
          bank_transaction_id?: string | null
          event_type: string
          stage: string
          message: string
          evidence?: Json
          metadata?: Json
          agent_version_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
      }
      agent_runs: {
        Row: {
          id: string
          agent_version_id: string
          reconciliation_id: string | null
          status: string
          started_at: string
          completed_at: string | null
          latency_ms: number
          estimated_cost: number
          metadata: Json
        }
        Insert: {
          id?: string
          agent_version_id: string
          reconciliation_id?: string | null
          status?: string
          started_at?: string
          completed_at?: string | null
          latency_ms?: number
          estimated_cost?: number
          metadata?: Json
        }
        Update: Partial<Database['public']['Tables']['agent_runs']['Insert']>
      }
      evaluation_results: {
        Row: {
          id: string
          agent_version_id: string
          dataset_name: string
          accuracy: number
          precision: number
          recall: number
          false_auto_post_rate: number
          escalation_precision: number
          straight_through_rate: number
          average_latency_ms: number
          estimated_cost: number
          created_at: string
        }
        Insert: {
          id?: string
          agent_version_id: string
          dataset_name: string
          accuracy?: number
          precision?: number
          recall?: number
          false_auto_post_rate?: number
          escalation_precision?: number
          straight_through_rate?: number
          average_latency_ms?: number
          estimated_cost?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['evaluation_results']['Insert']>
      }
      failure_analyses: {
        Row: {
          id: string
          agent_version_id: string
          evaluation_id: string | null
          failure_type: string
          severity: string | null
          root_cause: string | null
          evidence: Json
          recommended_change: string | null
          expected_impact: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agent_version_id: string
          evaluation_id?: string | null
          failure_type: string
          severity?: string | null
          root_cause?: string | null
          evidence?: Json
          recommended_change?: string | null
          expected_impact?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['failure_analyses']['Insert']>
      }
    }
  }
}
