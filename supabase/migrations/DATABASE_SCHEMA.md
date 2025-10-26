# Database Schema

Complete database schema documentation for the Book Club API, including table structures, relationships, and migration process.

## Schema Version

**Current Version:** Multi-Server Architecture (PR #2)  
**Last Updated:** October 2025

## Quick Reference

The database consists of 7 main tables:
- **Servers** - Discord server registrations
- **Clubs** - Book clubs within servers
- **Members** - Individual users/members
- **MemberClubs** - Many-to-many relationship between members and clubs
- **Books** - Book information
- **Sessions** - Reading sessions for clubs
- **Discussions** - Discussion events for sessions
- **ShameList** - Club-wide tracking of members who didn't complete readings

---

## Tables

### Servers

Stores registered Discord servers that can host multiple book clubs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigint | PRIMARY KEY | Discord server ID (snowflake) |
| `name` | text | NOT NULL | Server name |

**Indexes:**
- Primary key on `id`

**Relationships:**
- One server has many clubs

**Notes:**
- Server IDs are Discord snowflake IDs (64-bit integers)
- Servers must be deleted before their clubs are removed (deletion protection)

---

### Clubs

Book clubs that exist within Discord servers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PRIMARY KEY | Unique club identifier (UUID or custom) |
| `name` | text | NOT NULL | Club name |
| `discord_channel` | bigint | | Discord channel ID for the club |
| `server_id` | bigint | FOREIGN KEY → Servers(id), NOT NULL | Parent Discord server |

**Indexes:**
- Primary key on `id`

**Relationships:**
- Belongs to one server
- Has many members (through MemberClubs)
- Has many sessions
- Has shame list entries

**Notes:**
- `discord_channel` moved from sessions to clubs (club-level association)
- `server_id` added for multi-server support
- Clubs with same name can exist on different servers

---

### Members

Individual members who can join multiple clubs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, AUTO INCREMENT | Internal member ID |
| `name` | text | NOT NULL | Member name |
| `points` | integer | DEFAULT 0 | Accumulated points |
| `books_read` | integer | DEFAULT 0 | Total books completed |
| `user_id` | uuid | UNIQUE | Supabase auth user ID (optional) |
| `role` | text | | Member role (e.g., "admin", "member") |

**Indexes:**
- Primary key on `id`
- Unique index on `user_id`

**Relationships:**
- Has many club memberships (through MemberClubs)
- Can appear on multiple shame lists

**Notes:**
- `user_id` links Discord members to Supabase authenticated users
- `books_read` renamed from `numberofbooksread` (snake_case convention)
- Auto-incrementing ID managed by sequence

---

### MemberClubs

Junction table for the many-to-many relationship between members and clubs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `member_id` | integer | FOREIGN KEY → Members(id), NOT NULL | Member reference |
| `club_id` | text | FOREIGN KEY → Clubs(id), NOT NULL | Club reference |

**Indexes:**
- Composite primary key on `(member_id, club_id)`

**Relationships:**
- Links members to clubs

**Notes:**
- A member can belong to clubs across different servers
- Prevents duplicate club memberships

---

### Books

Book information shared across sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, AUTO INCREMENT | Book ID |
| `title` | text | NOT NULL | Book title |
| `author` | text | NOT NULL | Book author |
| `edition` | text | | Book edition |
| `year` | integer | | Publication year (can be negative for BCE) |
| `isbn` | text | | ISBN number |

**Indexes:**
- Primary key on `id`

**Relationships:**
- Used by multiple sessions

**Notes:**
- Books are shared resources - one book can be used by multiple sessions
- Deleting a session attempts to delete the book if not used elsewhere
- Auto-incrementing ID managed by sequence

---

### Sessions

Reading sessions for clubs with assigned books.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PRIMARY KEY | Session identifier (UUID or custom) |
| `club_id` | text | FOREIGN KEY → Clubs(id), NOT NULL | Club this session belongs to |
| `book_id` | integer | FOREIGN KEY → Books(id) | Book being read |
| `due_date` | date | | Session completion date |

**Indexes:**
- Primary key on `id`

**Relationships:**
- Belongs to one club
- References one book
- Has many discussions

**Notes:**
- `due_date` renamed from `duedate` (snake_case convention)
- `defaultchannel` removed (now at club level as `discord_channel`)
- Sessions inherit server context through their parent club

---

### Discussions

Discussion events associated with reading sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PRIMARY KEY | Discussion identifier (UUID or custom) |
| `session_id` | text | FOREIGN KEY → Sessions(id), NOT NULL | Parent session |
| `title` | text | NOT NULL | Discussion topic |
| `date` | date | | Discussion date |
| `location` | text | | Discussion location/platform |

**Indexes:**
- Primary key on `id`

**Relationships:**
- Belongs to one session

**Notes:**
- Multiple discussions can be planned for a single session
- `date` column type changed to proper `date` type (was text)
- `date` is optional (can be NULL)

---

### ShameList

Club-wide tracking of members who didn't complete readings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `club_id` | text | FOREIGN KEY → Clubs(id), NOT NULL | Club reference |
| `member_id` | integer | FOREIGN KEY → Members(id), NOT NULL | Member reference |

**Indexes:**
- Composite primary key on `(club_id, member_id)`

**Relationships:**
- Links members to clubs where they're on the shame list

**Notes:**
- **BREAKING CHANGE:** Shame list moved from session-level to club-level
- `session_id` replaced with `club_id`
- Prevents duplicate shame list entries per club

---

## Entity Relationship Diagram

```
┌─────────────┐
│   Servers   │
│             │
│ id (PK)     │
│ name        │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────┐         ┌─────────────┐
│    Clubs    │         │   Members   │
│             │         │             │
│ id (PK)     │         │ id (PK)     │
│ name        │    N:M  │ name        │
│ discord_ch  │◄────────┤ points      │
│ server_id   │         │ books_read  │
└──────┬──────┘         │ user_id     │
       │                │ role        │
       │ 1:N            └──────┬──────┘
       │                       │
┌──────▼──────┐         ┌──────▼──────┐
│  Sessions   │         │ MemberClubs │
│             │         │             │
│ id (PK)     │         │ member_id   │
│ club_id     │         │ club_id     │
│ book_id     │         └─────────────┘
│ due_date    │
└──────┬──────┘
       │
       │ 1:N           ┌─────────────┐
       ▼               │    Books    │
┌─────────────┐        │             │
│ Discussions │        │ id (PK)     │
│             │        │ title       │
│ id (PK)     │        │ author      │
│ session_id  │        │ edition     │
│ title       │◄───N:1─┤ year        │
│ date        │        │ isbn        │
│ location    │        └─────────────┘
└─────────────┘
       
       ┌─────────────┐
       │  ShameList  │
       │             │
       │ club_id     │
       │ member_id   │
       └─────────────┘
```

---

## Migration Process

### Overview

The database schema is managed through Supabase migrations. Migrations are version-controlled SQL files that describe schema changes.

### Migration Files

Migrations are stored in `supabase/migrations/` with timestamps:
- `20250324164339_remote_schema.sql` - Initial schema
- `20250325060346_remote_schema.sql` - Schema normalization (snake_case, club-level shame list)
- `[PENDING]_multi_server_support.sql` - Server table and foreign keys

### Key Schema Changes

#### Migration 1: Initial Schema (20250324164339)
- Created all base tables
- Established foreign key relationships
- Set up sequences for auto-increment fields

#### Migration 2: Schema Normalization (20250325060346)
**Changes:**
1. Added `discord_channel` to Clubs table
2. Changed Discussions.date from text to date type
3. Renamed Members.numberofbooksread → books_read
4. Renamed Sessions.duedate → due_date
5. Removed Sessions.defaultchannel
6. **BREAKING:** Changed ShameList from session-based to club-based
   - Dropped `session_id` column
   - Added `club_id` column
   - Updated foreign key constraints

#### Migration 3: Multi-Server Support [PENDING]
**Changes:**
1. Create Servers table with id and name
2. Add `server_id` column to Clubs table
3. Add foreign key constraint: Clubs.server_id → Servers.id
4. Add `user_id` column to Members table
5. Add unique constraint on Members.user_id

### Migration Commands

#### Pull Latest Schema from Production
```bash
# Link to production
supabase link --project-ref your-production-project-ref

# Pull current schema
supabase db pull

# This creates a new migration file in supabase/migrations/
```

#### Apply Migrations Locally
```bash
# Reset local database with all migrations
supabase db reset

# This will:
# 1. Drop the local database
# 2. Recreate it
# 3. Apply all migrations in order
# 4. Run seed.sql if configured
```

#### Push Migrations to Production
```bash
# Deploy migrations to production
supabase db push

# WARNING: This applies migrations to production!
# Always test locally first
```

#### Create New Migration
```bash
# Generate a new empty migration file
supabase migration new migration_name

# Example:
supabase migration new add_member_role_column
```

### Manual Migration Creation

If you need to create a migration manually:

1. **Create the SQL file:**
```bash
# File: supabase/migrations/[timestamp]_description.sql
```

2. **Write the migration:**
```sql
-- Add server support
CREATE TABLE IF NOT EXISTS servers (
    id bigint PRIMARY KEY,
    name text NOT NULL
);

ALTER TABLE clubs ADD COLUMN server_id bigint;
ALTER TABLE clubs ADD CONSTRAINT clubs_server_id_fkey 
    FOREIGN KEY (server_id) REFERENCES servers(id);
```

3. **Test locally:**
```bash
supabase db reset
```

4. **Deploy to production:**
```bash
supabase db push
```

### Migration Best Practices

1. **Always test locally first** - Use `supabase db reset` to test migrations
2. **Make migrations incremental** - Small, focused changes are easier to debug
3. **Include rollback logic** - Document how to revert changes if needed
4. **Back up production** - Before major migrations, backup the database
5. **Use transactions** - Wrap related changes in BEGIN/COMMIT blocks
6. **Handle data carefully** - Plan for data migration when changing schemas

### Rollback Strategy

If a migration fails or needs to be reverted:

```bash
# 1. Identify the problematic migration
supabase migration list

# 2. Mark it as reverted
supabase migration repair --status reverted [migration-id]

# 3. Create a new migration to undo changes
supabase migration new rollback_description

# 4. Write SQL to reverse the changes
```

### Common Migration Patterns

**Adding a column:**
```sql
ALTER TABLE table_name ADD COLUMN column_name type DEFAULT value;
```

**Renaming a column:**
```sql
ALTER TABLE table_name RENAME COLUMN old_name TO new_name;
```

**Adding a foreign key:**
```sql
ALTER TABLE child_table 
ADD CONSTRAINT fk_name 
FOREIGN KEY (column) REFERENCES parent_table(column);
```

**Changing column type:**
```sql
ALTER TABLE table_name 
ALTER COLUMN column_name TYPE new_type 
USING column_name::new_type;
```

---

## Seeding Data

### Seed File Location
`supabase/seed.sql` (project root)

### Running Seed Data
```bash
# Option 1: Via db reset (automatic if configured)
supabase db reset

# Option 2: Manual execution
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f seed.sql
```

### Seed Data Structure

The seed file includes:
1. **Servers** - 3 test Discord servers
2. **Clubs** - 5 clubs across different servers
3. **Members** - 8 test members
4. **MemberClubs** - Member-club associations
5. **Books** - 8 sample books
6. **Sessions** - 8 reading sessions
7. **Discussions** - 8 discussion events
8. **ShameList** - Club-based shame list entries

### Customizing Seed Data

Edit `supabase/seed.sql` to:
- Add your own test data
- Use real Discord server/channel IDs
- Create specific test scenarios

---

## Schema Design Decisions

### Why Multi-Server Architecture?

**Problem:** Single-tenant design couldn't support bot deployment to multiple Discord servers.

**Solution:** Added Servers table with `server_id` foreign key in Clubs.

**Benefits:**
- Bot can serve multiple Discord communities
- Data isolation between servers
- Clubs with same names can coexist on different servers

### Why Club-Level Shame Lists?

**Problem:** Session-level shame lists were too granular and hard to manage.

**Solution:** Moved shame list association from Sessions to Clubs.

**Benefits:**
- Simplified data model
- Easier club-wide tracking
- Better reflects real-world usage

### Why Shared Books Table?

**Problem:** Duplicating book information for each session wastes storage.

**Solution:** Separate Books table referenced by multiple sessions.

**Benefits:**
- Reduces data duplication
- Easier to update book information
- Consistent book data across sessions

### Why Text IDs for Some Tables?

**Decision:** Clubs, Sessions, and Discussions use text IDs instead of auto-increment.

**Rationale:**
- Flexibility for custom IDs (UUIDs or semantic IDs)
- Easier integration with external systems
- More readable in logs and URLs

### Why Supabase Auth Integration?

**Problem:** Need to link Discord bot members with web application users.

**Solution:** Added `user_id` column to Members table.

**Benefits:**
- Unified identity across platforms
- Single source of truth for member data
- Enables auth-based permissions

---

## Local Development

### Environment Setup
```bash
# Start Supabase locally
supabase start

# Check connection info
supabase status

# Access local database
psql "postgresql://postgres:postgres@localhost:54322/postgres"
```

### Quick Refresh Script

Use `local-env-refresh.sh` for fast environment reset:
```bash
#!/bin/bash
supabase link --project-ref your-project-ref
supabase db pull
supabase stop
supabase start
supabase db reset
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f seed.sql
```

### Useful Commands

```bash
# View all tables
\dt

# Describe a table
\d table_name

# Run a query
SELECT * FROM clubs WHERE server_id = 1039326367428395038;

# Exit psql
\q
```

---

## Production Considerations

### Backups
- Enable Supabase automated backups
- Test restore procedures periodically
- Keep local backups before major migrations

### Performance
- Monitor query performance via Supabase dashboard
- Add indexes for frequently queried columns
- Use `EXPLAIN ANALYZE` for slow queries

### Security
- Use Row Level Security (RLS) policies in production
- Limit API key permissions appropriately
- Audit access logs regularly

### Monitoring
- Set up alerts for database errors
- Monitor connection pool usage
- Track slow query logs