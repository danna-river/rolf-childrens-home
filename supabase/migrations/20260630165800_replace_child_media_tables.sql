-- Migration: Replace child_media tracking and provision administrative deletion tables
-- Created: 2026-06-30

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

COMMIT; -- Break out of transactional initialization if needed

BEGIN;

-- 1. Safely drop the existing table (and any dependent views/constraints)
DROP TABLE IF EXISTS public.child_media CASCADE;

-- 2. Create the clean, production-ready media tracking catalog
CREATE TABLE public.child_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL,            -- Links to your existing children table
    gdrive_file_id VARCHAR(255) NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    media_type VARCHAR(20) NOT NULL,   -- 'photo' | 'video'
    usage_type VARCHAR(20) NOT NULL,   -- 'profile_picture' | 'profile_video' | 'library'
    source VARCHAR(30) NOT NULL,       -- 'direct_upload' | 'intake_form'
    uploaded_by UUID NOT NULL,         -- Links to your profiles/users table
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create the administrative manual cleanup queue (if not already existing)
CREATE TABLE IF NOT EXISTS public.media_deletion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gdrive_file_id VARCHAR(255) NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,    -- Critical for admins to match files inside Google Drive's SYSTEM_TRASH
    child_id UUID NOT NULL,
    deleted_by_user_id UUID NOT NULL,  -- Traces which Admin triggered the soft-delete
    soft_deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending_manual_gdrive_deletion' -- 'pending_manual_gdrive_deletion' | 'permanently_purged'
);

-- 4. Re-establish performance optimization indexes
CREATE INDEX IF NOT EXISTS idx_child_media_child_id ON public.child_media(child_id);
CREATE INDEX IF NOT EXISTS idx_media_deletion_status ON public.media_deletion(status);

-- 5. Enable Row Level Security (RLS) to protect human-centered operations
ALTER TABLE public.child_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_deletion ENABLE ROW LEVEL SECURITY;

COMMIT;