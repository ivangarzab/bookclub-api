-- Migration: Convert Discord Snowflake IDs from bigint to text
-- This migration converts:
-- 1. servers.id: bigint -> text
-- 2. clubs.server_id: bigint -> text
-- 3. clubs.discord_channel: bigint -> text
--
-- Reason: Discord Snowflake IDs lose precision when represented as JSON numbers
-- in JavaScript/mobile clients. Storing as text preserves exact values.

-- Step 1: Drop the clubs_with_server view (created in 20251030000000_create_clubs_with_server_view.sql)
-- It will be recreated after type conversion to work with text columns
DROP VIEW IF EXISTS "public"."clubs_with_server";

-- Step 2: Drop the foreign key constraint (will be recreated after conversion)
ALTER TABLE "public"."clubs"
DROP CONSTRAINT IF EXISTS "clubs_server_id_fkey";

-- Step 3: Convert servers.id from bigint to text
ALTER TABLE "public"."servers"
ALTER COLUMN "id" TYPE text USING "id"::text;

-- Step 4: Convert clubs.server_id from bigint to text
ALTER TABLE "public"."clubs"
ALTER COLUMN "server_id" TYPE text USING "server_id"::text;

-- Step 5: Convert clubs.discord_channel from bigint to text
ALTER TABLE "public"."clubs"
ALTER COLUMN "discord_channel" TYPE text USING "discord_channel"::text;

-- Step 6: Recreate the foreign key constraint with text types
ALTER TABLE "public"."clubs"
ADD CONSTRAINT "clubs_server_id_fkey"
FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id")
ON DELETE CASCADE;

-- Step 7: Recreate the clubs_with_server view with text types
CREATE OR REPLACE VIEW "public"."clubs_with_server" AS
SELECT
    c.id,
    c.name,
    c.discord_channel,
    c.server_id,
    s.name AS server_name
FROM clubs c
JOIN servers s ON c.server_id = s.id;

-- Note: No rollback provided as this is a one-way conversion
-- (text can represent all bigint values, but not vice versa due to precision limits)
