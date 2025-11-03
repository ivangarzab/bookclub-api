# Database Changes Guide

Quick reference for making database schema changes safely.

## Golden Rules

### ✅ DO
- Make all schema changes through migration files
- Use `IF NOT EXISTS` for tables, columns, indexes
- Test migrations locally with `supabase db reset` (run twice!)
- Use Supabase Dashboard to view/edit **data** (rows in tables)
- Commit migrations to git before deploying

### ❌ DON'T
- Never run schema changes in Supabase Dashboard SQL Editor
- Never use `ALTER TABLE ADD CONSTRAINT` without a DO block
- Never manually edit production database structure
- Never skip the migration file and go straight to production

## Making Schema Changes

### 1. Create Migration File

```bash
# Create new migration
supabase migration new add_description_column

# This creates: supabase/migrations/YYYYMMDDHHMMSS_add_description_column.sql
```

### 2. Write Idempotent SQL

Always use patterns that can be run multiple times safely:

```sql
-- ✅ Tables
CREATE TABLE IF NOT EXISTS "public"."new_table" (
    "id" bigint NOT NULL,
    "name" text NOT NULL
);

-- ✅ Columns
ALTER TABLE "public"."clubs"
ADD COLUMN IF NOT EXISTS "description" text;

-- ✅ Indexes
CREATE INDEX IF NOT EXISTS "idx_clubs_server_id"
ON "public"."clubs" ("server_id");

-- ✅ Constraints (requires DO block)
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

-- ✅ Functions
CREATE OR REPLACE FUNCTION my_function() RETURNS void AS $$
BEGIN
    -- function body
END;
$$ LANGUAGE plpgsql;
```

### 3. Test Locally

```bash
# Apply migrations locally
supabase db reset

# Run again to verify idempotency (should succeed with no changes)
supabase db reset

# If second run fails, migration is not idempotent!
```

### 4. Deploy

```bash
# Commit migration
git add supabase/migrations/*.sql
git commit -m "feat: add description column to clubs"
git push origin feature-branch

# Create PR, merge to develop

# Run release process
./scripts/release-process.sh

# CI/CD (deploy.yml) will:
# - Apply migrations with `supabase db push`
# - Deploy functions with `supabase functions deploy`
```

## Using Supabase Dashboard

### ✅ Safe Dashboard Uses (Data Operations)

```sql
-- View data
SELECT * FROM clubs WHERE server_id = 123;

-- Insert data
INSERT INTO clubs (name, discord_channel) VALUES ('New Club', '123456');

-- Update data
UPDATE members SET points = 100 WHERE id = 5;

-- Delete data
DELETE FROM sessions WHERE id = 'old-session';
```

You can also use the **Table Editor UI** to manually add/edit/delete rows.

### ❌ Never in Dashboard (Schema Operations)

```sql
-- ❌ NO! Use migration files instead
ALTER TABLE clubs ADD COLUMN description text;
CREATE TABLE new_table (...);
DROP COLUMN old_field;
ADD CONSTRAINT ...;
CREATE INDEX ...;
```

## Emergency Hotfix Recovery

If you had to make a manual schema change in production (emergency only):

```bash
# 1. Pull current production schema
supabase db pull

# 2. This creates a migration with the difference
# 3. Commit it immediately
git add supabase/migrations/*.sql
git commit -m "chore: sync emergency hotfix to migrations"
git push

# 4. This keeps your migration history in sync with reality
```

## Common Mistakes

### Mistake 1: Non-idempotent Constraint
```sql
-- ❌ BAD - fails if constraint exists
ALTER TABLE clubs ADD CONSTRAINT clubs_server_id_fkey ...

-- ✅ GOOD - checks first
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clubs_server_id_fkey') THEN
        ALTER TABLE clubs ADD CONSTRAINT clubs_server_id_fkey ...
    END IF;
END $$;
```

### Mistake 2: Forgetting IF NOT EXISTS
```sql
-- ❌ BAD
ALTER TABLE clubs ADD COLUMN description text;

-- ✅ GOOD
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS description text;
```

### Mistake 3: Manual Production Changes
```sql
-- ❌ BAD - Running this in Supabase Dashboard SQL Editor
ALTER TABLE clubs ADD COLUMN status text;

-- ✅ GOOD - Create migration file, test locally, deploy via CI/CD
```

## Quick Checklist

Before deploying schema changes:

- [ ] Migration file created with `supabase migration new`
- [ ] SQL uses `IF NOT EXISTS` / `CREATE OR REPLACE` / DO blocks
- [ ] Tested locally with `supabase db reset` (twice)
- [ ] Migration committed to git
- [ ] PR reviewed and merged
- [ ] Deployed via release process + CI/CD

## Summary

**Simple mental model:**
- **Schema** (structure) = Migration files only
- **Data** (content) = Dashboard is fine

Follow this workflow and your database will always be in sync! 🎯
