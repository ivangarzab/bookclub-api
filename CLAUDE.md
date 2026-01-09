# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Supabase Edge Functions API for managing book clubs across multiple Discord servers with authentication integration. Built with Deno, TypeScript, and PostgreSQL.

## Common Commands

### Development
```bash
supabase start                    # Start local Supabase (requires Docker)
supabase status                   # Check status and get credentials
supabase functions serve          # Serve functions locally on http://localhost:54321
supabase db reset                 # Reset database with all migrations
```

### Testing
```bash
# Unit tests (mock Supabase client)
deno task test                    # Run all unit tests
deno task test:watch              # Run tests in watch mode
deno task test:server             # Test server endpoint only
deno task test:club               # Test club endpoint only
deno task test:member             # Test member endpoint only
deno task test:session            # Test session endpoint only
deno task test:coverage           # Generate coverage report

# Integration tests (require local Supabase running)
deno task test:integration        # Run all integration tests
deno task test:integration:server # Test server endpoint integration
deno task test:all                # Run both unit and integration tests
```

### Documentation
```bash
deno task docs                    # Serve API documentation at http://localhost:8080
```

### Database
```bash
supabase db pull                  # Pull schema from production
supabase db push                  # Push migrations to production
supabase migration new <name>     # Create new migration file
```

### Code Quality
```bash
deno fmt                          # Format code
deno lint                         # Lint code
deno check supabase/functions/    # Type check TypeScript
```

### Deployment
```bash
supabase functions deploy         # Deploy all functions
supabase functions deploy club    # Deploy specific function
```

## Architecture

### Multi-Server Design

The API supports a **single bot instance serving multiple Discord servers** with complete data isolation:

- **Servers table**: Root entity representing Discord servers (uses Discord snowflake IDs as text)
- **Clubs**: Scoped to servers via `server_id` foreign key, associated with Discord channels
- **Members**: Global entities that can belong to clubs across different servers via `MemberClubs` junction table
- **Sessions**: Reading sessions tied to specific clubs
- **Auth Integration**: Members link to Supabase Auth users via `user_id` for unified web/bot identity

### Edge Functions Structure

Each endpoint (`server/`, `club/`, `member/`, `session/`) follows a **modular pattern**:

```
supabase/functions/<endpoint>/
├── index.ts              # Main routing handler (~70 lines)
├── index.test.ts         # Unit tests with mocked Supabase client
├── handlers/             # Modular CRUD operation handlers
│   ├── get.ts           # GET request handler
│   ├── create.ts        # POST request handler
│   ├── update.ts        # PUT request handler
│   └── delete.ts        # DELETE request handler
├── utils/                # Shared utilities
│   ├── responses.ts     # Response formatting (errorResponse, successResponse, corsHeaders)
│   └── validation.ts    # Validation functions (e.g., validateServer)
└── README.md             # Endpoint-specific API documentation
```

**Common patterns in all endpoints:**
- Main `index.ts` exports `handler(req: Request, supabaseClient?: SupabaseClient)` for testability
- Handler functions are extracted into separate files in `handlers/` directory
- Shared utilities centralized in `utils/` directory
- Use `if (import.meta.main)` guard to prevent server start during imports
- Include CORS headers in all responses
- Return JSON with appropriate HTTP status codes
- Log operations with endpoint-specific prefixes (e.g., `[CLUB-GET]`, `[MEMBER-POST]`)

### Testing Strategy

**Two test levels:**

1. **Unit tests** (`supabase/functions/*/index.test.ts`): Mock Supabase client, test handler logic
2. **Integration tests** (`tests/integration/*.test.ts`): Real Supabase instance, test full request/response cycle

**Shared utilities** in `supabase/functions/_shared/test-utils.ts`:
- `createMockRequest()`: Build test requests
- `assertResponseStatus()`: Validate responses
- `assertCorsHeaders()`: Verify CORS
- Test data generators (`createTestServerId()`, `createTestUUID()`)

## Database Schema

### Core Tables

**Servers** - Discord server registrations
- `id` (text, PK): Discord server snowflake ID
- `name` (text): Server name

**Clubs** - Book clubs within servers
- `id` (text, PK): Unique club identifier
- `name` (text): Club name
- `discord_channel` (text): Discord channel ID for the club
- `server_id` (text, FK → Servers): Parent server

**Members** - Individual users
- `id` (integer, PK): Auto-incrementing internal ID
- `name` (text): Member name
- `points` (integer): Accumulated points
- `books_read` (integer): Total books completed
- `user_id` (uuid, unique): Links to Supabase Auth users
- `role` (text): Member role

**MemberClubs** - Junction table for member-club relationships
- `member_id` (integer, FK → Members): Member reference
- `club_id` (text, FK → Clubs): Club reference
- Composite PK on (member_id, club_id)

**Books** - Shared book information
- `id` (integer, PK): Auto-incrementing book ID
- `title`, `author`, `edition`, `year`, `isbn`: Book metadata

**Sessions** - Reading sessions for clubs
- `id` (text, PK): Session identifier
- `club_id` (text, FK → Clubs): Parent club
- `book_id` (integer, FK → Books): Book being read
- `due_date` (date): Session completion date

**Discussions** - Discussion events for sessions
- `id` (text, PK): Discussion identifier
- `session_id` (text, FK → Sessions): Parent session
- `title` (text): Discussion topic
- `date` (date): Discussion date
- `location` (text): Discussion location/platform

**ShameList** - Club-level tracking of members who didn't complete readings
- `club_id` (text, FK → Clubs): Club reference
- `member_id` (integer, FK → Members): Member reference
- Composite PK on (club_id, member_id)

### Critical Relationships

- Servers → Clubs (1:N via `server_id`)
- Clubs → Sessions (1:N via `club_id`)
- Members ↔ Clubs (N:M via `MemberClubs`)
- Sessions → Books (N:1 via `book_id`, shared books)
- Clubs → ShameList ← Members (club-level shame tracking)

### Important Design Decisions

**Discord snowflake IDs as text**: Recent migrations converted Discord IDs from `bigint` to `text` for better compatibility and flexibility.

**Club-level shame lists**: ShameList was moved from session-level to club-level in earlier migrations, simplifying the data model for club-wide tracking.

**Shared books table**: Books are referenced by multiple sessions to avoid duplication. Orphaned books are cleaned up when sessions are deleted.

**Multi-server isolation**: Clubs with the same name can exist on different servers. Members are global entities that can join clubs across servers.

**Auth integration**: The `user_id` column in Members links Discord bot users to Supabase Auth users for unified web/bot identity.

### Migration History

Migration files are timestamped in `supabase/migrations/`:
- `20250324164339_remote_schema.sql`: Initial schema
- `20250325060346_remote_schema.sql`: Snake_case normalization + club-level shame lists
- `20251029050656_add_multi_server_n_auth.sql`: Multi-server support + auth integration
- `20251030000000_create_clubs_with_server_view.sql`: View for clubs with server info
- `20251105000000_convert_snowflakes_to_text.sql`: Convert Discord snowflakes to text type

See [DATABASE_SCHEMA.md](supabase/migrations/DATABASE_SCHEMA.md) for complete schema documentation, migration patterns, and seeding instructions.

## Development Workflow

### Local Environment Setup

1. Start Supabase: `supabase start`
2. Get credentials: `supabase status` (save API URL and anon key)
3. Reset database: `supabase db reset` (applies all migrations)
4. Serve functions: `supabase functions serve`

**Local URLs:**
- API: `http://localhost:54321/functions/v1/<endpoint>`
- Studio: `http://localhost:54323`
- Database: `postgresql://postgres:postgres@localhost:54322/postgres`

### Making Changes

**When adding new endpoint functionality:**
1. Modify `index.ts` handler functions
2. Add/update unit tests in `index.test.ts`
3. Test with `deno task test:<endpoint>`
4. Add integration tests if needed
5. Update endpoint README.md

**When modifying database schema:**
1. Create migration: `supabase migration new descriptive_name`
2. Write SQL in new file under `supabase/migrations/`
3. Test locally: `supabase db reset`
4. Verify seed data still works
5. Update DATABASE_SCHEMA.md if adding/changing tables

**When writing tests:**
- Unit tests mock the Supabase client and test handler logic
- Integration tests require `supabase start` and test against real database
- Use test utilities from `_shared/test-utils.ts`
- Follow existing patterns in endpoint test files

### Critical Files

- [DATABASE_SCHEMA.md](supabase/migrations/DATABASE_SCHEMA.md): Complete schema reference, relationships, migration guide
- [deno.jsonc](deno.jsonc): Task definitions, test config, linting rules
- Endpoint READMEs in `supabase/functions/*/README.md`: API contracts, examples, error codes
- This CLAUDE.md: Schema reference and development patterns (read this first!)

## Important Conventions

### Code Style
- Use single quotes for strings
- 2-space indentation
- Line width: 100 characters
- Snake_case for database columns, camelCase for TypeScript

### Testing
- Test files: `*.test.ts`
- Mock Supabase client for unit tests via optional `supabaseClient` parameter
- Assert CORS headers in all endpoint tests
- Use descriptive test names: `Deno.test("Server - GET with valid ID returns server data")`

### Database
- Use transactions for multi-step operations
- Always validate server existence before creating clubs
- Clean up orphaned books when deleting sessions (if not referenced elsewhere)
- Discord snowflake IDs are now stored as text (recent migration)

### Error Handling
- Return appropriate HTTP status codes (400, 404, 500)
- Include descriptive error messages in JSON response
- Log errors with endpoint prefix for traceability
- Always include CORS headers, even in error responses

## Environment Variables

Local development uses `.env.local` (gitignored):
```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
```

Production uses `.env.production` (gitignored, linked to Supabase project).

**Note**: Edge Functions use the service role key to bypass RLS since they are trusted server-side code. Get the local service role key by running `supabase status`.

## Branch Strategy

- **main**: Production branch
- **develop**: Active development branch
- Feature branches: Create from develop, merge back via PR

**Current branch**: develop
**Main branch for PRs**: main
