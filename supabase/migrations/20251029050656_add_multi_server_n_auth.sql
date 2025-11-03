-- Migration: Add multi-server support with authentication
-- This migration adds:
-- 1. servers table
-- 2. server_id to clubs table
-- 3. user_id and role columns to members table

-- Create servers table
CREATE TABLE IF NOT EXISTS "public"."servers" (
    "id" bigint NOT NULL,
    "name" text NOT NULL,
    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- Add server_id column to clubs table
ALTER TABLE "public"."clubs" 
ADD COLUMN IF NOT EXISTS "server_id" bigint;

-- Add user_id and role columns to members table
ALTER TABLE "public"."members" 
ADD COLUMN IF NOT EXISTS "user_id" uuid;

ALTER TABLE "public"."members" 
ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'member';

-- Add foreign key constraint for clubs -> servers (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'clubs_server_id_fkey'
    ) THEN
        ALTER TABLE "public"."clubs"
        ADD CONSTRAINT "clubs_server_id_fkey"
        FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id")
        ON DELETE CASCADE;
    END IF;
END $$;

-- Grant permissions on servers table
GRANT ALL ON TABLE "public"."servers" TO "anon";
GRANT ALL ON TABLE "public"."servers" TO "authenticated";
GRANT ALL ON TABLE "public"."servers" TO "service_role";