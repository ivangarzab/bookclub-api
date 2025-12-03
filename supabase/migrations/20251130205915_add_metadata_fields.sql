-- Migration: Add metadata fields to clubs, books, and members tables
-- Created: 2025-11-30
-- Description: Adds founded_date to clubs, page_count to books, and created_at to members

-- Add founded_date to clubs table
ALTER TABLE clubs
ADD COLUMN founded_date DATE;

-- Add page_count to books table
ALTER TABLE books
ADD COLUMN page_count INTEGER;

-- Add created_at to members table
ALTER TABLE members
ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add handle to members table
ALTER TABLE members
ADD COLUMN handle TEXT;

-- Add comments for documentation
COMMENT ON COLUMN clubs.founded_date IS 'Date when the club was established';
COMMENT ON COLUMN books.page_count IS 'Number of pages in the book';
COMMENT ON COLUMN members.created_at IS 'Timestamp when the member account was created';
COMMENT ON COLUMN members.handle IS 'User handle or username for display';
