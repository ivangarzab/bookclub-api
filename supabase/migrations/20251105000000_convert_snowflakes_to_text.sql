-- Migration: Convert Discord Snowflake IDs from bigint to text
-- This migration converts:
-- 1. servers.id: bigint -> text
-- 2. clubs.server_id: bigint -> text
-- 3. clubs.discord_channel: bigint -> text
--
-- Reason: Discord Snowflake IDs lose precision when represented as JSON numbers
-- in JavaScript/mobile clients. Storing as text preserves exact values.

-- Step 1: Drop the foreign key constraint (will be recreated after conversion)
ALTER TABLE "public"."clubs"
DROP CONSTRAINT IF EXISTS "clubs_server_id_fkey";

-- Step 2: Convert servers.id from bigint to text
ALTER TABLE "public"."servers"
ALTER COLUMN "id" TYPE text USING "id"::text;

-- Step 3: Convert clubs.server_id from bigint to text
ALTER TABLE "public"."clubs"
ALTER COLUMN "server_id" TYPE text USING "server_id"::text;

-- Step 4: Convert clubs.discord_channel from bigint to text
ALTER TABLE "public"."clubs"
ALTER COLUMN "discord_channel" TYPE text USING "discord_channel"::text;

-- Step 5: Recreate the foreign key constraint with text types
ALTER TABLE "public"."clubs"
ADD CONSTRAINT "clubs_server_id_fkey"
FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id")
ON DELETE CASCADE;

-- Note: No rollback provided as this is a one-way conversion
-- (text can represent all bigint values, but not vice versa due to precision limits)
