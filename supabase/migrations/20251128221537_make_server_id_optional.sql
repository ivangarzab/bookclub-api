-- ================================================================
-- MIGRATION: Make server_id optional in clubs table
-- Purpose: Allow clubs to exist independently of Discord servers
-- ================================================================

-- Step 1: Make server_id nullable
ALTER TABLE clubs
ALTER COLUMN server_id DROP NOT NULL;

-- Step 2: Add index for server_id queries (Discord bot performance)
CREATE INDEX IF NOT EXISTS idx_clubs_server_id
ON clubs(server_id)
WHERE server_id IS NOT NULL;

-- Step 3: Prevent duplicate Discord channels per server
-- Uses partial unique index to allow NULL discord_channel (mobile clubs)
-- but enforce uniqueness when discord_channel is provided
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_discord_channel_per_server
ON clubs(discord_channel, server_id)
WHERE discord_channel IS NOT NULL;

-- Step 4: Update clubs_with_server view to handle nullable server_id
-- Change INNER JOIN to LEFT JOIN to include mobile-only clubs
CREATE OR REPLACE VIEW clubs_with_server AS
SELECT
    c.id,
    c.name,
    c.discord_channel,
    c.server_id,
    s.name as server_name  -- Will be NULL for mobile-only clubs
FROM clubs c
LEFT JOIN servers s ON c.server_id = s.id;

-- Step 5: Add comment explaining the field
COMMENT ON COLUMN clubs.server_id IS 'Optional Discord server ID. NULL for mobile-only clubs.';

-- Step 6: Verify existing data (all existing clubs should have server_id)
-- This is just a validation query, not a change
DO $$
BEGIN
  RAISE NOTICE 'Clubs with server_id: %', (SELECT COUNT(*) FROM clubs WHERE server_id IS NOT NULL);
  RAISE NOTICE 'Clubs without server_id: %', (SELECT COUNT(*) FROM clubs WHERE server_id IS NULL);
END $$;
