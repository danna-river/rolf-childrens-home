// Shared TypeScript types mirroring the Supabase schema.
// Keep in sync with supabase/schema.sql.

import type { UserRole } from '@/lib/profiles'
import type { Locale } from '@/i18n/config'

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

// ⚡ UPDATE: Matches your live schema's naming configurations
export type MediaType = 'photo' | 'video'

export interface EditLogChange {
  field: string
  from: unknown
  to: unknown
}

export interface EditLogEntry {
  timestamp: string
  profile?: {
    id?: string
    full_name?: string
    role?: string
    country?: string | string[] | null
  }
  changes?: EditLogChange[]
  /** Legacy fields present on some historical entries. */
  edited_by?: string
  edited_at?: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  country: string[] | null   // staff only; null for admins and donors
  ui_locale?: Locale
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
  profile_photo: string | null // Kept as string because our server actions flatten the relational joins to text URLs
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
  sync_version: number
  edit_log: EditLogEntry[]
}

export type MobileOperationStatus =
  | 'processing'
  | 'applied'
  | 'conflict'
  | 'rejected'
  | 'failed'

export interface MobileDevice {
  id: string
  user_id: string
  installation_id: string
  device_label: string
  app_version: string
  registered_at: string
  last_seen_at: string
  offline_access_expires_at: string
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export interface RolfIdReservation {
  id: string
  device_id: string
  user_id: string
  country: string
  id_rolf: string
  sequence: number
  reserved_at: string
  expires_at: string
  claimed_at: string | null
  child_id: string | null
}

export interface MobileSyncOperation {
  operation_id: string
  device_id: string
  user_id: string
  operation_type: 'create_child' | 'update_child'
  payload_hash: string
  status: MobileOperationStatus
  result: Record<string, unknown> | null
  attempt_started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface MobileMediaUpload {
  id: string
  device_id: string
  user_id: string
  child_id: string
  filename: string
  mime_type: string
  media_type: MediaType
  usage_type: 'profile_picture' | 'profile_video' | 'library'
  total_bytes: number
  uploaded_bytes: number
  drive_upload_url: string
  gdrive_file_id: string | null
  child_media_id: string | null
  status: 'uploading' | 'uploaded' | 'completed' | 'failed'
  expires_at: string
  created_at: string
  updated_at: string
}

/** Embedded ref returned when a children row is selected with the child_media FK joins
 *  (`profile_photo:child_media!fk_children_profile_photo(id, url)`). */
export interface ChildMediaRef {
  id: string
  url: string
}

/** `children` row as returned by those joined selects — the media columns come back
 *  as embedded refs (or null) instead of the flattened URL strings on `Child`. */
export type ChildWithMediaRefs = Omit<Child, 'profile_photo' | 'profile_video'> & {
  profile_photo: ChildMediaRef | null
  profile_video: ChildMediaRef | null
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

// ⚡ UPDATE: Fully rebuilt to match your true information_schema table structure
export interface ChildMedia {
  id: string
  child_id: string
  gdrive_file_id: string
  filename: string
  url: string
  media_type: string
  usage_type: string
  source: string
  uploaded_by: string
  created_at: string | null
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

// --- Pen Pal Letters (moderated donor <-> child correspondence) ---

export type PenPalThreadStatus = 'active' | 'closed'
export type PenPalDirection = 'donor_to_child' | 'child_to_donor'
export type PenPalMessageStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'delivered'
  | 'published'
  | 'rejected'

export interface PenPalThread {
  id: string
  sponsorship_id: string
  sponsor_id: string
  child_id: string
  status: PenPalThreadStatus
  closed_reason: string | null
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface PenPalMessage {
  id: string
  thread_id: string
  direction: PenPalDirection
  status: PenPalMessageStatus
  raw_body: string
  approved_body: string | null
  author_profile_id: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  delivered_by: string | null
  delivered_at: string | null
  published_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface PenPalEvent {
  id: string
  thread_id: string
  message_id: string | null
  actor_profile_id: string | null
  event_type: string
  notes: string | null
  created_at: string
}

// Minimal Supabase Database type for the typed client.
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
        Insert: Omit<Child, 'id' | 'created_at' | 'updated_at' | 'sync_version'> & { id?: string; sync_version?: number }
        Update: Partial<Omit<Child, 'id' | 'created_at'>>
        Relationships: []
      }
      mobile_devices: {
        Row: DatabaseRow<MobileDevice>
        Insert: Omit<MobileDevice, 'id' | 'registered_at' | 'last_seen_at' | 'offline_access_expires_at' | 'revoked_at' | 'created_at' | 'updated_at'> & Partial<Pick<MobileDevice, 'last_seen_at' | 'offline_access_expires_at' | 'revoked_at' | 'updated_at'>>
        Update: Partial<Omit<MobileDevice, 'id' | 'user_id' | 'installation_id' | 'registered_at' | 'created_at'>>
        Relationships: []
      }
      rolf_id_reservations: {
        Row: DatabaseRow<RolfIdReservation>
        Insert: Omit<RolfIdReservation, 'id' | 'reserved_at' | 'claimed_at' | 'child_id'> & Partial<Pick<RolfIdReservation, 'claimed_at' | 'child_id'>>
        Update: Partial<Omit<RolfIdReservation, 'id' | 'device_id' | 'user_id' | 'country' | 'id_rolf' | 'sequence' | 'reserved_at'>>
        Relationships: []
      }
      mobile_sync_operations: {
        Row: DatabaseRow<MobileSyncOperation>
        Insert: Omit<MobileSyncOperation, 'attempt_started_at' | 'completed_at' | 'created_at' | 'updated_at'> & Partial<Pick<MobileSyncOperation, 'attempt_started_at' | 'completed_at'>>
        Update: Partial<Omit<MobileSyncOperation, 'operation_id' | 'device_id' | 'user_id' | 'operation_type' | 'payload_hash' | 'created_at'>>
        Relationships: []
      }
      mobile_media_uploads: {
        Row: DatabaseRow<MobileMediaUpload>
        Insert: Omit<MobileMediaUpload, 'id' | 'uploaded_bytes' | 'gdrive_file_id' | 'child_media_id' | 'expires_at' | 'created_at' | 'updated_at'> & Partial<Pick<MobileMediaUpload, 'uploaded_bytes' | 'gdrive_file_id' | 'child_media_id' | 'expires_at'>>
        Update: Partial<Omit<MobileMediaUpload, 'id' | 'device_id' | 'user_id' | 'child_id' | 'filename' | 'mime_type' | 'media_type' | 'usage_type' | 'total_bytes' | 'created_at'>>
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
      pen_pal_threads: {
        Row: DatabaseRow<PenPalThread>
        Insert: {
          id?: string
          sponsorship_id: string
          sponsor_id: string
          child_id: string
          status?: PenPalThreadStatus
          closed_reason?: string | null
          last_message_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<PenPalThread, 'id' | 'created_at'>>
        Relationships: []
      }
      pen_pal_messages: {
        Row: DatabaseRow<PenPalMessage>
        Insert: {
          id?: string
          thread_id: string
          direction: PenPalDirection
          status?: PenPalMessageStatus
          raw_body: string
          approved_body?: string | null
          author_profile_id?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          delivered_by?: string | null
          delivered_at?: string | null
          published_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<PenPalMessage, 'id' | 'created_at'>>
        Relationships: []
      }
      pen_pal_events: {
        Row: DatabaseRow<PenPalEvent>
        Insert: {
          id?: string
          thread_id: string
          message_id?: string | null
          actor_profile_id?: string | null
          event_type: string
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Omit<PenPalEvent, 'id' | 'created_at'>>
        Relationships: []
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
    Functions: {
      /** Face lookup RPCs (see supabase/migrations/20260709120000_create_face_lookup.sql).
       *  All are SECURITY DEFINER and re-check the caller's role and country
       *  scope internally; embeddings are write-only from the app's side. */
      match_child_face: {
        Args: { query_embedding: number[]; query_model_version: string }
        Returns: { child_id: string; distance: number }[]
      }
      upsert_child_face_template: {
        Args: {
          target_child_id: string
          target_media_id: string
          face_embedding: number[] | null
          face_model_version: string
        }
        Returns: undefined
      }
      get_face_enrollment_queue: {
        Args: { expected_model_version: string }
        Returns: { child_id: string; media_id: string; display_name: string }[]
      }
      get_face_template_stats: {
        Args: { expected_model_version: string }
        Returns: {
          children_with_photo: number
          templates_active: number
          templates_unsearchable: number
        }[]
      }
      reserve_mobile_rolf_ids: {
        Args: { p_device_id: string; p_user_id: string; p_country: string; p_count?: number }
        Returns: { id_rolf: string; expires_at: string }[]
      }
    }
  }
}
