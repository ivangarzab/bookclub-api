# Architecture Overview

This document explains the system design, architecture decisions, and how all components of the Book Club API work together.

**Related Documentation:**
- [Security Guide](./SECURITY.md) - Detailed documentation of the API Gateway Pattern, security model, and authorization best practices

## Table of Contents

- [System Overview](#system-overview)
- [Component Architecture](#component-architecture)
- [Multi-Server Architecture](#multi-server-architecture)
- [Authentication Flow](#authentication-flow)
- [Data Flow](#data-flow)
- [Design Decisions](#design-decisions)
- [Scalability Considerations](#scalability-considerations)

---

## System Overview

The Book Club API is a serverless backend built on Supabase Edge Functions that manages book clubs across multiple Discord servers. It provides a unified API for all clients: Discord bot, web application, and mobile apps (iOS/Android).

### High-Level Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │          CLIENT APPLICATIONS                │
                    │                                             │
                    │  ┌──────────────┐   ┌──────────────┐        │
                    │  │ Discord Bot  │   │   Web App    │        │
                    │  │   (Python)   │   │   (React)    │        │
                    │  └──────┬───────┘   └──────┬───────┘        │
                    │         │                  │                │
                    │         │     ┌────────────▼──────────┐     │
                    │         │     │  Mobile Apps (KMP)    │     │
                    │         │     │  • iOS                │     │
                    │         │     │  • Android            │     │
                    │         │     └────────────┬──────────┘     │
                    └─────────┼──────────────────┼────────────────┘
                              │                  │
                              │      HTTPS       │
                              │   (Auth JWT)     │
                              │                  │
                    ┌─────────▼──────────────────▼────────────────┐
                    │      SUPABASE EDGE FUNCTIONS                │
                    │         (API Gateway Layer)                 │
                    │                                             │
                    │  ┌──────┐  ┌──────┐  ┌─────────┐ ┌───────┐  │
                    │  │Server│  │ Club │  │ Member  │ │Session│  │
                    │  └──────┘  └──────┘  └─────────┘ └───────┘  │
                    │                                             │
                    │  • TypeScript authorization                 │
                    │  • Service role key (bypasses RLS)          │
                    │  • Validation & business logic              │
                    └─────────────────┬───────────────────────────┘
                                      │
                                      │ SQL
                                      │
                    ┌─────────────────▼───────────────────────────┐
                    │         POSTGRESQL DATABASE                 │
                    │          (Supabase)                         │
                    │                                             │
                    │  • RLS enabled (inactive)                   │
                    │  • Multi-server data isolation              │
                    │  • 8 tables (servers, clubs, members, etc)  │
                    └─────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- **Supabase Edge Functions** - Deno-based serverless functions (API Gateway)
- **PostgreSQL** - Relational database via Supabase
- **TypeScript** - Type-safe API development with authorization logic
- **Supabase Auth** - JWT-based authentication

**Clients:**
- **Discord Bot** - Python-based bot using discord.py
- **Web Application** - React frontend at kluvs.com
- **Mobile Apps** - Kotlin Multiplatform (KMP) for iOS and Android (in development)

---

## Component Architecture

### Edge Functions (API Layer)

The API consists of four independent Edge Functions, each handling a specific domain:

```
supabase/functions/
├── club/index.ts      - Club management (GET, POST, PUT, DELETE)
├── member/index.ts    - Member management (GET, POST, PUT, DELETE)
├── session/index.ts   - Reading session management (GET, POST, PUT, DELETE)
└── server/index.ts    - Discord server registration (GET, POST, PUT, DELETE)
```

#### Function Characteristics

**Stateless:**
- No session state stored in functions
- Each request is independent
- Authentication via JWT tokens

**RESTful:**
- Standard HTTP methods (GET, POST, PUT, DELETE)
- Resource-oriented URLs
- JSON request/response format

**CORS-Enabled:**
- Supports cross-origin requests
- Allows web application integration
- Preflight request handling

**Validated:**
- Input validation on all requests
- Server existence checks before operations
- Foreign key constraint enforcement

### Database Layer

PostgreSQL database with 7 tables organized around book club operations:

**Core Entities:**
- `servers` - Discord server registrations
- `clubs` - Book clubs within servers
- `members` - Individual users/members
- `books` - Shared book information

**Relationships:**
- `memberclubs` - Member-club associations
- `sessions` - Reading sessions
- `discussions` - Discussion events
- `shamelist` - Club-based tracking

See [DATABASE_SCHEMA.md](../supabase/migrations/DATABASE_SCHEMA.md) for complete details.

---

## Multi-Server Architecture

### Design Problem

**Challenge:** A single Discord bot instance needs to serve multiple Discord servers (guilds), each with their own independent book clubs.

**Requirements:**
1. Complete data isolation between servers
2. Same club names can exist on different servers
3. Members can participate across multiple servers
4. Single bot deployment for all servers

### Solution: Server-Scoped Clubs

```
Server 1 (Production)           Server 2 (Test Alpha)
├── Club: Freaks & Geeks       ├── Club: Trifecta
├── Club: Blingers             └── Club: Mystery Readers
└── Club: ...                   
```

**Key Design:**
- `servers` table stores Discord server registrations
- `clubs.server_id` foreign key ensures clubs belong to servers
- All club operations require `server_id` parameter
- Server validation occurs before any club operation

### Server Registration Flow

```
1. Bot joins Discord server
   ↓
2. Bot receives GUILD_CREATE event
   ↓
3. Bot calls POST /server with Discord server ID and name
   ↓
4. Server registered in database
   ↓
5. Clubs can now be created for this server
```

### Data Isolation

**Server-level isolation:**
- Queries always filter by `server_id`
- Cross-server data access is impossible
- Each server operates independently

**Example:**
```sql
-- Get clubs for specific server only
SELECT * FROM clubs WHERE server_id = 1039326367428395038;

-- Members can belong to clubs across servers
SELECT c.* FROM clubs c
JOIN memberclubs mc ON c.id = mc.club_id
WHERE mc.member_id = 1;
-- Returns clubs from multiple servers
```

---

## Authentication Flow

### Discord Bot → API

```
1. Bot makes API request to Edge Function endpoint
   ↓
2. Edge Function receives request (may include Authorization header)
   ↓
3. Edge Function uses service_role key internally (bypasses RLS)
   ↓
4. Edge Function performs authorization logic in TypeScript
   ↓
5. Database operations execute with full access
```

**Example Request:**
```javascript
// External clients (Discord bot, web, mobile) call Edge Functions
fetch('https://project.supabase.co/functions/v1/club?id=club-1&server_id=123', {
  headers: {
    'Authorization': `Bearer ${USER_AUTH_TOKEN}`,  // Optional: for user identity
    'Content-Type': 'application/json'
  }
})

// Note: Edge Functions internally use service_role key to bypass RLS
// Authorization logic is implemented in TypeScript within Edge Functions
```

### Web App → API (With User Authentication)

```
1. User logs in via Supabase Auth
   ↓
2. Receives JWT token with user_id
   ↓
3. Web app makes API request with user's JWT
   ↓
4. Edge Function validates token
   ↓
5. Can query member by user_id
   ↓
6. Returns user's Discord bot data
```

**Example Flow:**
```javascript
// User logs in
const { user, session } = await supabase.auth.signInWithPassword({...})

// Query member by Supabase user_id
fetch(`/functions/v1/member?user_id=${user.id}`, {
  headers: {
    'Authorization': `Bearer ${session.access_token}`
  }
})
// Returns: Member with Discord stats, club memberships, etc.
```

### Member-User Linking

The `members.user_id` field bridges Discord identity with Supabase Auth:

```
Discord Member ──linked via──> Supabase Auth User
     (id: 1)      user_id      (uuid: 550e8400-...)
        │                              │
        │                              │
        ├─ Discord-only data          ├─ Auth-only data
        │  • Name                     │  • Email
        │  • Points                   │  • Password
        │  • Books read               │  • Metadata
        │                             │
        └──────────────┬──────────────┘
                       │
                Unified Identity
                 • Club memberships
                 • Reading history
                 • Shame list status
```

**Linking Process:**
1. User authenticates in web app → Gets `user_id`
2. User links Discord account → Provides Discord user ID
3. Bot looks up or creates member with Discord ID
4. Bot updates `member.user_id` to link accounts
5. Now member data accessible via either Discord ID or Auth UUID

---

## Data Flow

### Creating a Club (Example)

```
1. Discord Bot
   └─> POST /club
       {
         name: "Sci-Fi Readers",
         server_id: 1039326367428395038,
         discord_channel: 987654321098765432,
         members: [{id: 1, name: "Alice"}]
       }

2. Edge Function (club/index.ts)
   ├─> Validate server_id exists
   ├─> Create club record
   ├─> Create member records
   └─> Link members to club (memberclubs)

3. Database
   ├─> INSERT INTO clubs
   ├─> INSERT INTO members
   └─> INSERT INTO memberclubs

4. Response
   └─> {success: true, club: {...}}
```

### Reading Session Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│ 1. CREATE SESSION                                       │
│    POST /session                                        │
│    - Create book record (if new)                        │
│    - Create session linking club + book                 │
│    - Create discussion records                          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. ACTIVE SESSION                                       │
│    GET /club?id=club-1                                  │
│    - Returns active_session with book & discussions     │
│    - Members read book                                  │
│    - Discussions occur                                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. SESSION COMPLETION                                   │
│    - Session due_date passes                            │
│    - Members who didn't complete → Added to shame list  │
│    - Session becomes "past_session" in club data        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. DELETE SESSION (optional)                            │
│    DELETE /session?id=session-1                         │
│    - Cascade delete discussions                         │
│    - Delete session                                     │
│    - Attempt to delete book (if not used elsewhere)     │
└─────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### 1. Why Edge Functions Over Traditional Server?

**Decision:** Use Supabase Edge Functions instead of Express/Fastify server

**Rationale:**
- ✅ **Serverless** - No server management, automatic scaling
- ✅ **Global distribution** - Low latency via edge network
- ✅ **Cost-effective** - Pay only for execution time
- ✅ **Integrated** - Direct Supabase database access
- ✅ **TypeScript native** - Built on Deno with first-class TS support

**Trade-offs:**
- ❌ Cold start latency (first request after idle)
- ❌ Deno ecosystem (not Node.js)
- ❌ Limited execution time (varies by plan)

### 2. Why Separate Functions Per Resource?

**Decision:** Four separate functions instead of one monolithic function

**Rationale:**
- ✅ **Independent deployment** - Deploy club endpoint without affecting others
- ✅ **Clear separation** - Each function has single responsibility
- ✅ **Easier testing** - Test endpoints in isolation
- ✅ **Better scaling** - Functions scale independently based on usage

**Trade-offs:**
- ❌ Some code duplication (CORS, validation helpers)
- ❌ More functions to manage

**Mitigation:** Shared utilities could be extracted to a common module

### 3. Why Text IDs for Some Tables?

**Decision:** `clubs`, `sessions`, `discussions` use text IDs; `members`, `books` use integers

**Rationale:**
- ✅ **Flexibility** - Can use UUIDs or semantic IDs like "club-scifi-readers"
- ✅ **External system integration** - Easier to use external IDs
- ✅ **Readable** - Better in logs and URLs

**Trade-offs:**
- ❌ Slight storage overhead vs. integers
- ❌ Manual ID generation required (or use uuid_generate_v4())

**Why integers for members/books:**
- Auto-incrementing IDs make sense for internal entities
- Sequential IDs are more compact
- No external system integration needed

### 4. Why Club-Level Shame Lists?

**Decision:** Shame lists associated with clubs, not individual sessions

**Rationale:**
- ✅ **Simplified model** - One shame list per club vs. many per sessions
- ✅ **Better UX** - "You're on the shame list" vs. "You're on the shame list for session X"
- ✅ **Persistent tracking** - Club-wide reputation system
- ✅ **Easier queries** - Single JOIN to get shame list

**Trade-offs:**
- ❌ No per-session granularity
- ❌ Can't track which specific book was missed

**Mitigation:** Application logic can track session-specific data if needed

### 5. Why Shared Books Table?

**Decision:** Books stored separately and referenced by sessions

**Rationale:**
- ✅ **Avoid duplication** - "1984" only stored once
- ✅ **Consistency** - Update book info in one place
- ✅ **Data integrity** - Same book always has same ISBN, author, etc.

**Trade-offs:**
- ❌ Book deletion complexity (check if used by other sessions)
- ❌ Can't have session-specific book notes

---

## Scalability Considerations

### Current Scale

**Designed for:**
- Dozens of Discord servers
- Hundreds of clubs
- Thousands of members
- Moderate request volume (Discord bot usage patterns)

### Bottlenecks & Solutions

**1. Database Queries**

*Potential Issue:* Complex JOINs in GET /club (members, sessions, discussions, books)

*Solution:*
- Add indexes on foreign keys
- Consider caching for frequently accessed clubs
- Paginate large member lists

**2. Edge Function Cold Starts**

*Potential Issue:* First request after idle period has ~1-2s latency

*Solution:*
- Accept trade-off (rare for Discord bots)
- Keep functions "warm" with periodic pings if needed
- Upgrade Supabase plan for better cold start performance

**3. Concurrent Writes**

*Potential Issue:* Multiple Discord commands modifying same club simultaneously

*Solution:*
- PostgreSQL handles concurrent writes well
- Use transactions for multi-step operations
- Database constraints prevent invalid states

### Growth Path

**If you reach limits:**

**Small → Medium (Current → 1000s of users)**
- ✅ Current architecture handles this fine
- Add database indexes
- Monitor function execution times

**Medium → Large (1000s → 100,000s of users)**
- Consider caching layer (Redis)
- Implement pagination for large lists
- Add rate limiting per server

**Large → Massive (100,000s+ users)**
- Shard database by server_id
- Use read replicas for GET requests
- Consider dedicated backend server vs. Edge Functions

---

## Future Considerations

### Potential Enhancements

**1. Caching Layer**
- Cache club data for frequently accessed clubs
- Invalidate on updates
- Reduce database load

**2. Event-Driven Architecture**
- Pub/sub for real-time updates
- Notify Discord bot of changes from web app
- Use Supabase Realtime subscriptions

**3. Background Jobs**
- Scheduled function to update shame lists
- Automatic session archival
- Reminder notifications

**4. Analytics**
- Track most read books
- Club engagement metrics
- Member activity analytics

**5. Rate Limiting**
- Prevent abuse
- Per-server or per-user limits
- Built into Edge Functions or external service

---

## Security Model

### Current Implementation (API Gateway Pattern)

This API uses an **API Gateway Pattern** where Edge Functions serve as the single, trusted entry point for all clients. See [SECURITY.md](./SECURITY.md) for comprehensive documentation.

**Authentication:**
- JWT token validation for user identity (optional, depending on endpoint)
- Supabase manages token signing/verification
- Edge Functions extract user info from JWT tokens

**Authorization:**
- Implemented in TypeScript within Edge Functions
- Edge Functions use service_role key to bypass RLS
- Currently permissive (MVP phase) - future RBAC planned
- Authorization logic will check `members.role` for admin/member permissions

**Row-Level Security (RLS):**
- RLS is **enabled** on all tables (Supabase requirement)
- Temporary policies exist for `authenticated` role
- Policies are **inactive** (service_role bypasses RLS entirely)
- Edge Functions are trusted server-side code with full database access

**Data Validation:**
- Server existence checks before operations
- Foreign key constraints prevent orphaned records
- Input validation in Edge Functions

### Future Authorization Implementation

**Role-Based Access Control (RBAC):**
- Query `members.role` to determine permissions (admin, member, guest)
- Implement in TypeScript Edge Function handlers
- Admin-only operations (DELETE, etc.)
- Member-only operations (UPDATE own data)

**Example future implementation:**
```typescript
// Get user's role from JWT token
const { data: member } = await client
  .from('members')
  .select('role')
  .eq('user_id', user.id)
  .single()

// Enforce permissions in TypeScript
if (operation === 'DELETE' && member?.role !== 'admin') {
  return errorResponse('Forbidden: Admin only', 403)
}
```

See [SECURITY.md](./SECURITY.md) for detailed security model, implementation patterns, and best practices.

---

## Monitoring & Observability

### Available Metrics

**Supabase Dashboard:**
- Request count per function
- Error rates
- Execution duration
- Database query performance

**Edge Function Logs:**
- Structured logging with `[FUNCTION-METHOD]` prefixes
- Console output visible in Supabase dashboard
- Helpful for debugging

### Recommended Monitoring

**Alerts:**
- Set up alerts for high error rates
- Monitor slow queries (>1s)
- Track database connection pool usage

**Custom Logging:**
```typescript
console.log(`[CLUB-POST] Creating club for server: ${serverId}`);
console.log(`[CLUB-POST] Request completed in ${duration}ms`);
```

---

## Testing Strategy

### Local Testing

**Edge Functions:**
```bash
supabase functions serve
curl http://localhost:54321/functions/v1/club?id=club-1&server_id=123
```

**Database:**
```bash
supabase db reset  # Apply migrations + seed data
psql "postgresql://postgres:postgres@localhost:54322/postgres"
```

### Integration Testing

**Recommended approach:**
1. Use `supabase db reset` for clean state
2. Run seed.sql for test data
3. Make API requests via curl or Postman
4. Verify database state

**Example test flow:**
```bash
# 1. Reset environment
supabase db reset

# 2. Create test club
curl -X POST http://localhost:54321/functions/v1/club \
  -H "Authorization: Bearer $KEY" \
  -d '{"name":"Test Club","server_id":1234567890123456789}'

# 3. Verify in database
psql -c "SELECT * FROM clubs WHERE server_id=1234567890123456789;"
```

---

## Conclusion

The Book Club API is designed as a modern, serverless backend that:
- ✅ Scales with demand via Edge Functions
- ✅ Supports multiple Discord servers with data isolation
- ✅ Integrates with Supabase Auth for unified identity
- ✅ Uses PostgreSQL for robust data management
- ✅ Follows RESTful principles for clarity

The architecture prioritizes simplicity and maintainability while remaining flexible enough to scale as usage grows.