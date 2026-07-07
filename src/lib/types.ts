// Shared TypeScript types mirroring the Supabase schema.
// Keep in sync with supabase/schema.sql.

import type { UserRole } from '@/lib/profiles'

type DatabaseRow<T> = { [Key in keyof T]: T[Key] }

export type Role = UserRole

export type ChildStatus = 'active' | 'inactive'

export type SponsorshipStatus = 'active' | 'ended'

export type SponsorshipFrequency =
  | 'one_time'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'

export type SponsorshipPaymentMethod =
  | 'square'
  | 'pushpay'
  | 'check'
  | 'stock'
  | 'fidelity'
  | 'charity_account'
  | 'other'

export type SponsorContactType = 'sponsor' | 'donor_only' | 'prospect'

export type ReceiptPreference = 'unknown' | 'requested' | 'not_needed'

export type MediaType = 'photo' | 'video'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  country: string[] | null   // staff only; null for admins and donors
  created_at: string
}

export interface Child {
  id: string
  id_rolf: string | null
  display_name: string
  first_name: string | null
  last_name: string | null
  birth_year: number | null
  birth_month: number | null
  birth_day: number | null
  profile_photo: string | null
  profile_video: string | null
  country: string | null
  year_joined: number | null
  date_joined: string | null
  career_aspiration: string | null
  favorite_subject: string | null
  hobby: string | null
  bio: string | null
  notes: string | null
  status: ChildStatus
  created_by: string | null
  created_at: string
  updated_at: string
  edit_log: Array<{ edited_by: string; edited_at: string }>
}

export interface Sponsorship {
  id: string
  sponsor_id: string | null
  /** Null for a standalone donation that is not earmarked for a child. */
  child_id: string | null
  status: SponsorshipStatus
  start_date: string
  end_date: string | null
  amount: number | null
  frequency: SponsorshipFrequency | null
  payment_method: SponsorshipPaymentMethod | null
  notes: string | null
  assigned_by: string | null
  created_at: string
}

/** External event sponsor. A login account can be linked later through profile_id. */
export interface Sponsor {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  contact_type: SponsorContactType
  receipt_preference: ReceiptPreference
  notes: string | null
  profile_id: string | null
  created_at: string
}

export interface ChildMedia {
  id: string
  child_id: string
  type: MediaType
  s3_key: string
  filename: string | null
  content_type: string | null
  file_size_mb: number | null
  caption: string | null
  approved: boolean
  uploaded_by: string | null
  created_at: string
}

export interface ChildUpdate {
  id: string
  child_id: string
  title: string
  body: string
  visible_to_donor: boolean
  created_by: string | null
  created_at: string
}

export interface AppSettings {
  id: number
  countries: string[]
  updated_at: string
}

export interface Country {
  id: number
  name: string
  iso_code: string
  created_at: string
}

// Minimal Supabase Database type for the typed client.
// Extend as needed — or replace with generated types from `supabase gen types`.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: DatabaseRow<Profile>
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
        Relationships: []
      }
      heartbeat: {
        Row: { id: number; beat_at: string }
        Insert: { id?: number; beat_at?: string }
        Update: { id?: number; beat_at?: string }
        Relationships: []
      }
      children: {
        Row: DatabaseRow<Child>
        Insert: Omit<Child, 'id' | 'created_at' | 'updated_at' | 'edit_log'>
        Update: Partial<Omit<Child, 'id' | 'created_at' | 'edit_log'>>
        Relationships: []
      }
      sponsors: {
        Row: DatabaseRow<Sponsor>
        Insert: {
          id?: string
          full_name: string
          email?: string | null
          phone?: string | null
          contact_type?: SponsorContactType
          receipt_preference?: ReceiptPreference
          notes?: string | null
          profile_id?: string | null
          created_at?: string
        }
        Update: Partial<Omit<Sponsor, 'id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: 'sponsors_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sponsorships: {
        Row: DatabaseRow<Sponsorship>
        Insert: {
          id?: string
          sponsor_id?: string | null
          child_id?: string | null
          status?: SponsorshipStatus
          start_date?: string
          end_date?: string | null
          amount?: number | null
          frequency?: SponsorshipFrequency | null
          payment_method?: SponsorshipPaymentMethod | null
          notes?: string | null
          assigned_by?: string | null
          created_at?: string
        }
        Update: Partial<Omit<Sponsorship, 'id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: 'sponsorships_sponsor_id_fkey'
            columns: ['sponsor_id']
            isOneToOne: false
            referencedRelation: 'sponsors'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sponsorships_child_id_fkey'
            columns: ['child_id']
            isOneToOne: false
            referencedRelation: 'children'
            referencedColumns: ['id']
          },
        ]
      }
      child_media: {
        Row: DatabaseRow<ChildMedia>
        Insert: Omit<ChildMedia, 'id' | 'created_at'>
        Update: Partial<Omit<ChildMedia, 'id' | 'created_at'>>
        Relationships: []
      }
      child_updates: {
        Row: DatabaseRow<ChildUpdate>
        Insert: Omit<ChildUpdate, 'id' | 'created_at'>
        Update: Partial<Omit<ChildUpdate, 'id' | 'created_at'>>
        Relationships: []
      }
      app_settings: {
        Row: DatabaseRow<AppSettings>
        Insert: {
          id?: number
          countries?: string[]
          updated_at?: string
        }
        Update: Partial<Omit<AppSettings, 'id'>>
        Relationships: []
      }
      countries: {
        Row: DatabaseRow<Country>
        Insert: {
          id?: number
          name: string
          iso_code: string
          created_at?: string
        }
        Update: Partial<Omit<Country, 'id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
