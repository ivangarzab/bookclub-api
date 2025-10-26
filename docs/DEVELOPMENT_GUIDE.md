# Development Guide

Complete guide for developing, testing, and troubleshooting the Book Club API.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Daily Development Workflow](#daily-development-workflow)
- [Testing](#testing)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Deployment](#deployment)

---

## Prerequisites

### Required Tools

**Docker Desktop**
- Required for local Supabase instance
- [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
- Ensure it's running before starting Supabase

**Supabase CLI**
```bash
# Install via npm
npm install -g supabase

# Or via Homebrew (macOS)
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

**Node.js & npm**
- Required for TypeScript support and CLI installation
- [Download Node.js](https://nodejs.org/) (LTS version recommended)

**PostgreSQL Client (Optional)**
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows
# Download from https://www.postgresql.org/download/windows/
```

**Git**
- For version control
- [Download Git](https://git-scm.com/downloads)

### Recommended Tools

**Code Editor:**
- VS Code with extensions:
  - Deno for Deno
  - PostgreSQL by Chris Kolkman
  - REST Client (for testing APIs)

**API Testing:**
- Postman or Insomnia
- curl (command line)
- VS Code REST Client extension

---

## Initial Setup

### 1. Clone and Initialize

```bash
# Clone repository
git clone https://github.com/ivangarzab/bookclub-api.git
cd bookclub-api

# Initialize Supabase in this directory
supabase init
```

This creates:
- `.supabase/` directory (local Supabase data)
- `supabase/config.toml` (configuration file)

### 2. Start Local Supabase

```bash
# Start all Supabase services
supabase start
```

**First run takes 2-5 minutes** (downloads Docker images)

You'll see output like:
```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
        anon key: eyJhbG...
service_role key: eyJhbG...
```

**Save these credentials!** You'll need the anon key for testing.

### 3. Link to Production (Optional)

```bash
# Link to your production Supabase project
supabase link --project-ref your-production-project-ref

# Pull production schema
supabase db pull
```

**Note:** You can skip this if you don't have production set up yet. The seed data will create a functional local database.

### 4. Apply Schema and Seed Data

```bash
# Reset database with migrations
supabase db reset

# Manually apply seed data (if not auto-applied)
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f seed.sql
```

### 5. Verify Setup

```bash
# Check Supabase status
supabase status

# Access Studio (web UI)
open http://localhost:54323

# Check database
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT * FROM servers;"
```

---

## Daily Development Workflow

### Starting Your Day

```bash
# 1. Ensure Docker is running
docker ps

# 2. Start Supabase (if not running)
supabase start

# 3. Check status
supabase status

# 4. Serve Edge Functions
supabase functions serve
```

Now your API is running at `http://localhost:54321/functions/v1/`

### Making Changes

#### Modifying Edge Functions

```bash
# 1. Edit function code
vim supabase/functions/club/index.ts

# 2. Functions auto-reload (if serving)
# No restart needed!

# 3. Test your changes
curl http://localhost:54321/functions/v1/club?id=club-1&server_id=1039326367428395038 \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

#### Modifying Database Schema

```bash
# 1. Create new migration
supabase migration new add_member_role

# 2. Edit the generated SQL file
vim supabase/migrations/[timestamp]_add_member_role.sql

# 3. Apply migration
supabase db reset

# 4. Verify changes
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -c "\d members"
```

### Ending Your Day

```bash
# Stop Supabase (optional - can leave running)
supabase stop

# Or stop and clean up volumes
supabase stop --no-backup
```

---

## Testing

### Manual Testing with curl

#### Test GET Request

```bash
# Get club by ID
curl --request GET \
  --url "http://localhost:54321/functions/v1/club?id=club-1&server_id=1039326367428395038" \
  --header "Authorization: Bearer YOUR_ANON_KEY" \
  --header "Content-Type: application/json"
```

#### Test POST Request

```bash
# Create new club
curl --request POST \
  --url "http://localhost:54321/functions/v1/club" \
  --header "Authorization: Bearer YOUR_ANON_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "name": "New Club",
    "server_id": 1039326367428395038,
    "discord_channel": 111222333444555666
  }'
```

#### Test PUT Request

```bash
# Update club
curl --request PUT \
  --url "http://localhost:54321/functions/v1/club" \
  --header "Authorization: Bearer YOUR_ANON_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "id": "club-1",
    "server_id": 1039326367428395038,
    "name": "Updated Name"
  }'
```

#### Test DELETE Request

```bash
# Delete club
curl --request DELETE \
  --url "http://localhost:54321/functions/v1/club?id=club-1&server_id=1039326367428395038" \
  --header "Authorization: Bearer YOUR_ANON_KEY"
```

### Testing with Postman

1. **Import Collection:**
   - Create collection: "Book Club API"
   - Set base URL: `http://localhost:54321/functions/v1`
   - Set auth header: `Authorization: Bearer {{anon_key}}`

2. **Create Environment:**
   - Variable: `anon_key`
   - Value: Your local anon key from `supabase status`

3. **Test Endpoints:**
   - Create requests for each endpoint
   - Save responses for documentation

### Database Testing

```bash
# Connect to local database
psql "postgresql://postgres:postgres@localhost:54322/postgres"

# Run test queries
SELECT * FROM clubs WHERE server_id = 1039326367428395038;

# Check foreign key relationships
SELECT c.name as club, m.name as member
FROM clubs c
JOIN memberclubs mc ON c.id = mc.club_id
JOIN members m ON mc.member_id = m.id;

# Exit
\q
```

### Reset Test Environment

```bash
# Complete reset with seed data
supabase db reset

# This will:
# 1. Drop all tables
# 2. Apply all migrations
# 3. Run seed.sql (if configured)
```

---

## Debugging

### Function Logs

**View logs in real-time:**
```bash
# Logs appear in terminal where functions are served
supabase functions serve

# Look for your console.log statements
[CLUB-GET] === New GET request received ===
[CLUB-GET] Request parameters: { clubId: 'club-1', serverId: '1039326367428395038' }
```

**Add debug logging:**
```typescript
console.log(`[CLUB-GET] Debug info:`, {
  clubId,
  serverId,
  timestamp: new Date().toISOString()
});
```

### Database Debugging

**Check table contents:**
```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres"

# List all tables
\dt

# Describe table structure
\d clubs

# View data
SELECT * FROM clubs;

# Check foreign key violations
SELECT * FROM clubs WHERE server_id NOT IN (SELECT id FROM servers);
```

**Query performance:**
```sql
-- Enable timing
\timing

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM clubs WHERE server_id = 1039326367428395038;
```

### Common Debug Scenarios

**"Server not found" errors:**
```bash
# Check if server exists
psql -c "SELECT * FROM servers WHERE id = 1039326367428395038;"

# If missing, insert it
psql -c "INSERT INTO servers (id, name) VALUES (1039326367428395038, 'Test Server');"
```

**"Foreign key violation" errors:**
```bash
# Check parent record exists
psql -c "SELECT * FROM clubs WHERE id = 'club-1';"

# Check all foreign keys
psql -c "
SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS foreign_table
FROM pg_constraint
WHERE contype = 'f';
"
```

### Supabase Studio Debugging

1. Open Studio: `http://localhost:54323`
2. Navigate to Table Editor
3. View/edit data visually
4. Check logs in Logs section
5. View API docs in API section

---

## Common Tasks

### Quick Environment Refresh

Use the provided script:

```bash
# Run refresh script
./local-env-refresh.sh
```

Or manually:
```bash
supabase link --project-ref your-production-project-ref
supabase db pull
supabase stop
supabase start
supabase db reset
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f seed.sql
```

### Add New Edge Function

```bash
# Create new function
mkdir -p supabase/functions/newfunction
touch supabase/functions/newfunction/index.ts

# Add boilerplate
cat > supabase/functions/newfunction/index.ts << 'EOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Your logic here

    return new Response(
      JSON.stringify({ message: 'Success' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
EOF

# Test locally
supabase functions serve newfunction
```

### Create Database Migration

```bash
# Generate migration file
supabase migration new description_of_change

# Example: Add column
supabase migration new add_member_avatar

# Edit the file
vim supabase/migrations/[timestamp]_add_member_avatar.sql

# Add SQL
ALTER TABLE members ADD COLUMN avatar_url TEXT;

# Apply migration
supabase db reset

# Verify
psql -c "\d members"
```

### Update Seed Data

```bash
# Edit seed.sql
vim seed.sql

# Add new test data
INSERT INTO servers (id, name) VALUES
(9999999999999999999, 'New Test Server');

# Apply changes
supabase db reset
```

### Export Production Data

```bash
# Connect to production
supabase link --project-ref your-production-project-ref

# Export specific table
pg_dump "$(supabase db remote --url)" \
  --table=clubs \
  --data-only > clubs_backup.sql

# Export entire schema
supabase db dump -f backup.sql
```

---

## Troubleshooting

### Supabase Won't Start

**Problem:** `supabase start` fails

**Solutions:**

1. **Check Docker:**
```bash
# Ensure Docker is running
docker ps

# If not, start Docker Desktop
```

2. **Port conflicts:**
```bash
# Check if ports are in use
lsof -i :54321
lsof -i :54322
lsof -i :54323

# Kill conflicting processes or change ports in supabase/config.toml
```

3. **Clean restart:**
```bash
supabase stop --no-backup
docker system prune -f
supabase start
```

### Migration Errors

**Problem:** Migration fails when running `supabase db reset`

**Solutions:**

1. **Check migration SQL syntax:**
```bash
# Validate SQL
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/migrations/[timestamp]_migration.sql
```

2. **Mark migration as reverted:**
```bash
supabase migration list
supabase migration repair --status reverted [migration-id]
```

3. **Start fresh:**
```bash
# WARNING: Deletes all local data
supabase db reset --debug
```

### Function Not Found

**Problem:** 404 when calling function

**Solutions:**

1. **Check function is serving:**
```bash
# Should see your function listed
supabase functions serve
```

2. **Verify URL:**
```bash
# Correct format
http://localhost:54321/functions/v1/club

# NOT
http://localhost:54321/club
```

3. **Check function name matches directory:**
```
supabase/functions/club/index.ts → /functions/v1/club
```

### CORS Errors

**Problem:** CORS error in browser

**Solutions:**

1. **Add CORS headers to function:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders })
}

// Add to all responses
return new Response(json, {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
})
```

### Connection Refused

**Problem:** Can't connect to database

**Solutions:**

1. **Check Supabase is running:**
```bash
supabase status
```

2. **Verify connection string:**
```bash
# Should be
postgresql://postgres:postgres@localhost:54322/postgres

# NOT
postgresql://postgres:postgres@localhost:5432/postgres
```

3. **Check firewall:**
```bash
# Allow connections on port 54322
```

### Seed Data Not Loading

**Problem:** Database is empty after reset

**Solutions:**

1. **Check config.toml:**
```toml
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
```

2. **Manual seed:**
```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f seed.sql
```

3. **Check seed.sql syntax:**
```bash
# Test SQL file
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f seed.sql --echo-errors
```

---

## Best Practices

### Code Organization

**Function structure:**
```typescript
// 1. Imports
import { serve } from "..."

// 2. Constants
const corsHeaders = {...}

// 3. Main handler
serve(async (req) => {
  // CORS preflight
  // Error handling
  // Route to handlers
})

// 4. Handler functions
async function handleGetResource() {}
async function handlePostResource() {}

// 5. Helper functions
function validateInput() {}
```

### Error Handling

**Always include:**
- Clear error messages
- Appropriate HTTP status codes
- CORS headers in error responses
- Logging for debugging

```typescript
try {
  // Logic
} catch (error) {
  console.log(`[FUNCTION-METHOD] ERROR: ${error.message}`);
  return new Response(
    JSON.stringify({ error: error.message }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    }
  )
}
```

### Logging

**Use structured logging:**
```typescript
console.log(`[CLUB-GET] === New request received ===`);
console.log(`[CLUB-GET] Parameters:`, { clubId, serverId });
console.log(`[CLUB-GET] Query result:`, { found: !!data, count: data?.length });
```

**Prefix format:** `[FUNCTION-METHOD]`
- Makes logs searchable
- Clear context
- Easy to filter

### Database Queries

**Use parameterized queries:**
```typescript
// Good
.eq("id", userId)
.in("member_id", memberIds)

// Avoid string concatenation (SQL injection risk)
```

**Minimize queries:**
```typescript
// Bad: N+1 query problem
for (const club of clubs) {
  const members = await getMembers(club.id)
}

// Good: Single query with JOIN
const clubsWithMembers = await getClubsWithMembers()
```

### Testing Before Deployment

```bash
# 1. Reset environment
supabase db reset

# 2. Test all endpoints
./test-all-endpoints.sh

# 3. Check logs for errors
# Review function serve output

# 4. Verify database state
psql -c "SELECT * FROM clubs;"

# 5. Only then deploy
supabase functions deploy
```

---

## Deployment

### Deploy Functions to Production

```bash
# Link to production
supabase link --project-ref your-production-project-ref

# Deploy all functions
supabase functions deploy

# Or deploy specific function
supabase functions deploy club

# Verify deployment
curl https://your-project-ref.supabase.co/functions/v1/club?id=test \
  -H "Authorization: Bearer YOUR_PROD_ANON_KEY"
```

### Deploy Database Changes

```bash
# Push migrations to production
supabase db push

# WARNING: This applies migrations to production!
# Always test locally first
```

### Production Checklist

- [ ] Test all endpoints locally
- [ ] Run `supabase db reset` successfully
- [ ] Update environment variables if needed
- [ ] Review migration SQL carefully
- [ ] Backup production database
- [ ] Deploy during low-traffic period
- [ ] Monitor logs after deployment
- [ ] Test production endpoints
- [ ] Have rollback plan ready

### Rollback Strategy

**If deployment fails:**

```bash
# 1. Revert function deployment
supabase functions deploy previous-working-version

# 2. Revert database migration
supabase migration repair --status reverted [migration-id]

# 3. Restore from backup if needed
pg_restore -d production backup.sql
```

---

## Additional Resources

**Supabase Documentation:**
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Local Development](https://supabase.com/docs/guides/local-development)
- [CLI Reference](https://supabase.com/docs/reference/cli)

**Deno Documentation:**
- [Deno Manual](https://deno.land/manual)
- [Standard Library](https://deno.land/std)

**PostgreSQL:**
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [psql Commands](https://www.postgresql.org/docs/current/app-psql.html)

---

## Getting Help

**Issues with setup?**
1. Check this guide's troubleshooting section
2. Review Supabase documentation
3. Check Supabase Discord/GitHub issues

**Found a bug?**
1. Create detailed reproduction steps
2. Check database state
3. Review function logs
4. Open issue with all information

**Want to contribute?**
1. Review documentation
2. Test changes locally
3. Follow code organization patterns
4. Submit PR with clear description