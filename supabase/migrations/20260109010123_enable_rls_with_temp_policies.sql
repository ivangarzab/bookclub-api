-- Migration: Enable RLS with Temporary Wide-Open Policies
-- Created: 2026-01-08
-- Description: Enables Row Level Security on all tables and adds temporary
--              policies that allow authenticated users full access.
--              These policies should be replaced with proper granular policies
--              before production deployment.
--
-- WARNING: These are TEMPORARY policies for development!
--          Replace with proper permission logic before production.

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE "public"."servers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."memberclubs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."books" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."discussions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shamelist" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TEMPORARY WIDE-OPEN POLICIES FOR AUTHENTICATED USERS
-- =============================================================================

-- Servers policies
CREATE POLICY "temp_servers_select" ON "public"."servers"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "temp_servers_insert" ON "public"."servers"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "temp_servers_update" ON "public"."servers"
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "temp_servers_delete" ON "public"."servers"
    FOR DELETE
    TO authenticated
    USING (true);

-- Clubs policies
CREATE POLICY "temp_clubs_select" ON "public"."clubs"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "temp_clubs_insert" ON "public"."clubs"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "temp_clubs_update" ON "public"."clubs"
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "temp_clubs_delete" ON "public"."clubs"
    FOR DELETE
    TO authenticated
    USING (true);

-- Members policies
CREATE POLICY "temp_members_select" ON "public"."members"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "temp_members_insert" ON "public"."members"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "temp_members_update" ON "public"."members"
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "temp_members_delete" ON "public"."members"
    FOR DELETE
    TO authenticated
    USING (true);

-- MemberClubs policies
CREATE POLICY "temp_memberclubs_select" ON "public"."memberclubs"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "temp_memberclubs_insert" ON "public"."memberclubs"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "temp_memberclubs_update" ON "public"."memberclubs"
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "temp_memberclubs_delete" ON "public"."memberclubs"
    FOR DELETE
    TO authenticated
    USING (true);

-- Books policies
CREATE POLICY "temp_books_select" ON "public"."books"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "temp_books_insert" ON "public"."books"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "temp_books_update" ON "public"."books"
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "temp_books_delete" ON "public"."books"
    FOR DELETE
    TO authenticated
    USING (true);

-- Sessions policies
CREATE POLICY "temp_sessions_select" ON "public"."sessions"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "temp_sessions_insert" ON "public"."sessions"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "temp_sessions_update" ON "public"."sessions"
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "temp_sessions_delete" ON "public"."sessions"
    FOR DELETE
    TO authenticated
    USING (true);

-- Discussions policies
CREATE POLICY "temp_discussions_select" ON "public"."discussions"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "temp_discussions_insert" ON "public"."discussions"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "temp_discussions_update" ON "public"."discussions"
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "temp_discussions_delete" ON "public"."discussions"
    FOR DELETE
    TO authenticated
    USING (true);

-- ShameList policies
CREATE POLICY "temp_shamelist_select" ON "public"."shamelist"
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "temp_shamelist_insert" ON "public"."shamelist"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "temp_shamelist_update" ON "public"."shamelist"
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "temp_shamelist_delete" ON "public"."shamelist"
    FOR DELETE
    TO authenticated
    USING (true);

-- =============================================================================
-- NOTES
-- =============================================================================
--
-- These policies grant full CRUD access to any authenticated user.
-- This is a TEMPORARY solution for development/testing.
--
-- Before production deployment, you should:
-- 1. Review each table's access requirements
-- 2. Implement proper granular policies based on business logic
-- 3. Consider implementing policies based on:
--    - Server membership (users can only see data for their servers)
--    - Club membership (users can only modify clubs they belong to)
--    - Admin roles (stored in members.role)
--    - User ownership (via members.user_id)
-- 4. Drop these temporary policies once proper ones are in place
--
-- Example of a proper policy (replace temp policies with similar):
-- CREATE POLICY "members_select_own_data" ON "public"."members"
--     FOR SELECT
--     TO authenticated
--     USING (auth.uid() = user_id);
--
