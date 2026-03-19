-- Migration: Add article_url and image_url columns for news articles
-- Run this in Supabase SQL editor before deploying the news fetcher

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS article_url TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN incidents.article_url IS 'Original article URL for news items';
COMMENT ON COLUMN incidents.image_url IS 'Thumbnail image URL for news items';
