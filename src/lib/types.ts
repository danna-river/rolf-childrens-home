// Shared TypeScript types mirroring the Supabase schema.
// Keep in sync with supabase/schema.sql.

import type { UserRole } from '@/lib/profiles'

export type Role = UserRole

export type ChildStatus = 'active' | 'inactive'

export type SponsorshipStatus = 'active' | 'ended'

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
  age: number | null
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
  donor_id: string
  child_id: string
  status: SponsorshipStatus
  start_date: string
  end_date: string | null
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

// Minimal Supabase Database type for the typed client.
// Extend as needed — or replace with generated types from `supabase gen types`.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      children: {
        Row: Child
        Insert: Omit<Child, 'id' | 'created_at' | 'updated_at' | 'edit_log'>
        Update: Partial<Omit<Child, 'id' | 'created_at' | 'edit_log'>>
      }
      sponsorships: {
        Row: Sponsorship
        Insert: Omit<Sponsorship, 'id' | 'created_at'>
        Update: Partial<Omit<Sponsorship, 'id' | 'created_at'>>
      }
      child_media: {
        Row: ChildMedia
        Insert: Omit<ChildMedia, 'id' | 'created_at'>
        Update: Partial<Omit<ChildMedia, 'id' | 'created_at'>>
      }
      child_updates: {
        Row: ChildUpdate
        Insert: Omit<ChildUpdate, 'id' | 'created_at'>
        Update: Partial<Omit<ChildUpdate, 'id' | 'created_at'>>
      }
    }
  }
}
