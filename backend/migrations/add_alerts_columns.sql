-- Migration: Add columns for Alerts Tab feature
-- Run this in the Supabase SQL editor before using the Alerts feature

-- Add the immediate action tip column
ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS action_step TEXT;

-- Add the safety checklist column (stores a JSON array of strings)
ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS steps JSONB;

-- Add ai_processed column if it doesn't exist
ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN DEFAULT false;

-- Add external_id column for deduplication
ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Verify columns exist:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'incidents';
