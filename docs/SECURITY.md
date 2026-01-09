# Security Guide

**Last Updated:** January 2026
**Status:** Active Implementation Guide

This document describes the security model, API Gateway architectural pattern, and authorization best practices for the Book Club API. Use this as a reference when implementing authentication and authorization in Edge Functions.

---

## Table of Contents
- [Overview](#overview)
- [Architecture Pattern](#architecture-pattern)
- [Why This Architecture](#why-this-architecture)
- [How It Works](#how-it-works)
- [Security Model](#security-model)
- [RLS and Edge Functions](#rls-and-edge-functions)
- [Do's and Don'ts](#dos-and-donts)
- [Future Authorization](#future-authorization)
- [Common Patterns](#common-patterns)

---

## Overview

The Book Club API uses an **API Gateway Pattern** where Edge Functions serve as the single entry point for all clients (Discord bot, web frontend, mobile apps). Clients never access the Supabase database directly.

### Key Principles
1. **Single API layer**: All data access goes through Edge Functions
2. **Service role authentication**: Edge Functions bypass RLS using service_role key
3. **TypeScript-based authorization**: All auth logic lives in Edge Function code, not database policies
4. **Multi-client support**: Same API serves Discord bot, web, and mobile apps

---

## Architecture Pattern

```
┌─────────────────┐
│  Discord Bot    │
└────────┬────────┘
         │
         │ HTTP Requests
         │ (with auth tokens)
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Web Frontend   │─────▶│  Edge Functions  │
│   (React)       │      │  (API Gateway)   │
└─────────────────┘      │                  │
         │               │ - Validation     │
         │               │ - Authorization  │
         ▼               │ - Business Logic │
┌─────────────────┐      └────────┬─────────┘
│  Mobile Apps    │               │
│  (iOS/Android)  │               │ Service Role Key
└─────────────────┘               │ (bypasses RLS)
                                  ▼
                        ┌──────────────────┐
                        │  Supabase DB     │
                        │  (PostgreSQL)    │
                        │                  │
                        │  RLS Enabled     │
                        │  (inactive for   │
                        │   service_role)  │
                        └──────────────────┘
```

---

## Why This Architecture

### Problem We Solved

**Before:** Each client (Discord bot, web, mobile) would need to:
- Implement database queries independently
- Duplicate business logic across platforms
- Manage database security in multiple places
- Keep schemas synchronized manually

**After:** With API Gateway Pattern:
- ✅ Write business logic **once** in TypeScript
- ✅ Consistent behavior across all clients
- ✅ Centralized security and validation
- ✅ Single source of truth for API contracts

### Why NOT Direct Database Access?

We explicitly chose **not** to let clients access the database directly because:

1. **Code duplication**: Would need to implement queries in TypeScript (web), Python (bot), and Kotlin (mobile)
2. **Maintenance nightmare**: Schema changes require updates in 4 places
3. **Security complexity**: RLS policies hard to debug and maintain
4. **Business logic scattered**: Authorization logic would be split between code and SQL
5. **Less flexible**: Complex operations easier in TypeScript than SQL

---

## How It Works

### Client Request Flow

1. **Client makes HTTP request** to Edge Function endpoint:
   ```typescript
   // Example: Web frontend calling club endpoint
   const response = await fetch('https://api.supabase.co/functions/v1/club', {
     method: 'GET',
     headers: {
       'Authorization': `Bearer ${userAuthToken}`,
       'Content-Type': 'application/json'
     }
   })
   ```

2. **Edge Function receives request** and creates Supabase client with service role:
   ```typescript
   // supabase/functions/club/index.ts
   const client = createClient(
     Deno.env.get('SUPABASE_URL') ?? '',
     Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
   )
   ```

3. **Handler performs validation and authorization** in TypeScript:
   ```typescript
   // Extract user from auth token
   const authHeader = req.headers.get('Authorization')
   const token = authHeader?.replace('Bearer ', '')
   const { data: { user } } = await client.auth.getUser(token)

   // Check permissions (future implementation)
   if (operation === 'DELETE' && member?.role !== 'admin') {
     return errorResponse('Admin only', 403)
   }
   ```

4. **Database query executes with full access** (service role bypasses RLS):
   ```typescript
   const { data, error } = await client
     .from('clubs')
     .select('*')
     .eq('id', clubId)
   ```

5. **Response returned to client** with appropriate HTTP status:
   ```typescript
   return successResponse(data)
   ```

---

## Security Model

### Authentication Flow

```
User signs in → Supabase Auth → JWT token issued
                                      ↓
User makes request → Sends JWT in Authorization header
                                      ↓
Edge Function → Validates JWT → Extracts user info
                                      ↓
TypeScript code → Checks permissions → Allows/Denies operation
```

### Current Security (MVP)

**Status:** Basic validation only
- Edge Functions validate that servers exist before creating clubs
- Discord bot provides basic access control at command level
- Web/mobile frontend shows UI based on user context

### Future Security (Planned)

**Status:** To be implemented
- Extract `user_id` from JWT token
- Query `members` table for user's role
- Enforce role-based permissions:
  - **Admin**: Can DELETE, modify all clubs
  - **Member**: Can only view/edit clubs they belong to
  - **Guest**: Read-only access

**Example future implementation:**
```typescript
// Get user's role
const { data: member } = await client
  .from('members')
  .select('role')
  .eq('user_id', user.id)
  .single()

// Enforce permissions
if (operation === 'DELETE' && member?.role !== 'admin') {
  return errorResponse('Forbidden: Admin only', 403)
}

if (operation === 'UPDATE' && !userBelongsToClub(user.id, clubId)) {
  return errorResponse('Forbidden: Not a club member', 403)
}
```

---

## RLS and Edge Functions

### Why RLS is Enabled but Inactive

**Supabase requires RLS** to be enabled on all tables. We have RLS enabled with temporary policies, but these policies are **never executed** because Edge Functions use the `service_role` key.

### The Service Role Bypass

```sql
-- RLS is enabled
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- Policy exists
CREATE POLICY "temp_clubs_select" ON clubs
  FOR SELECT TO authenticated
  USING (true);

-- But service_role BYPASSES this entirely
-- Edge Functions have full database access regardless of policies
```

**Think of it like:**
- RLS = Security system turned on
- Policies = Rules for regular users
- Service role = Master key that bypasses the security system entirely

### Current RLS Migration

Located at: `supabase/migrations/20260109010123_enable_rls_with_temp_policies.sql`

**What it does:**
1. Enables RLS on all 8 tables (required by Supabase)
2. Creates temporary wide-open policies for `authenticated` role
3. These policies are **dormant** (service_role ignores them)

**Why keep the policies?**
- No performance impact (service_role skips RLS checks)
- Safety net if someone accidentally uses anon key
- Good foundation if we ever want database-level enforcement
- Already tested and working

---

## Do's and Don'ts

### ✅ DO

**Architecture:**
- ✅ Route all client requests through Edge Functions
- ✅ Use Edge Functions as the single API layer
- ✅ Write all authorization logic in TypeScript (Edge Functions)
- ✅ Keep service_role key usage in Edge Functions

**Security:**
- ✅ Validate user authentication in Edge Functions
- ✅ Extract user info from JWT tokens
- ✅ Check permissions before database operations
- ✅ Return appropriate HTTP status codes (401, 403, 404, etc.)

**Development:**
- ✅ Add unit tests for Edge Function handlers
- ✅ Add integration tests that call Edge Functions
- ✅ Document API endpoints in README files
- ✅ Log operations with endpoint-specific prefixes

**Future Authorization:**
- ✅ Query `members.role` to check permissions
- ✅ Implement role-based access control (admin, member, guest)
- ✅ Validate club membership before operations
- ✅ Use consistent permission checking patterns

### ❌ DON'T

**Architecture:**
- ❌ Don't allow clients to access database directly
- ❌ Don't create separate Supabase clients in frontend/mobile with database access
- ❌ Don't duplicate business logic across clients
- ❌ Don't bypass Edge Functions for "just this one operation"

**Security:**
- ❌ Don't expose service_role key to clients
- ❌ Don't trust client-side permissions checks
- ❌ Don't skip authentication validation
- ❌ Don't assume requests are authorized without checking

**RLS and Policies:**
- ❌ Don't switch Edge Functions to use anon key (keep service_role)
- ❌ Don't write complex authorization logic in RLS policies
- ❌ Don't expect RLS policies to protect against bad Edge Function code
- ❌ Don't remove RLS enablement (Supabase requires it)

**Development:**
- ❌ Don't hardcode environment variables in code
- ❌ Don't commit `.env.local` or `.env.production` files
- ❌ Don't skip testing after adding authorization checks
- ❌ Don't forget CORS headers in responses

---

## Future Authorization

### Phase 1: Role-Based Access Control (RBAC)

**Goal:** Implement admin vs. member permissions

**Implementation checklist:**
1. Create auth utility function:
   ```typescript
   // supabase/functions/_shared/auth-utils.ts
   export async function getUserRole(client, userId) {
     const { data } = await client
       .from('members')
       .select('role')
       .eq('user_id', userId)
       .single()
     return data?.role || 'guest'
   }
   ```

2. Add permission checks to DELETE operations:
   ```typescript
   // Only admins can delete
   const role = await getUserRole(client, user.id)
   if (role !== 'admin') {
     return errorResponse('Admin only', 403)
   }
   ```

3. Update frontend to show/hide admin actions based on role

4. Update Discord bot to check roles before destructive commands

5. Update mobile apps when auth is implemented

### Phase 2: Club Membership Validation

**Goal:** Users can only modify clubs they belong to

**Implementation:**
1. Create membership check utility:
   ```typescript
   export async function isClubMember(client, userId, clubId) {
     const { data } = await client
       .from('memberclubs')
       .select('member_id')
       .eq('club_id', clubId)
       .eq('member_id', (
         client.from('members')
           .select('id')
           .eq('user_id', userId)
           .single()
       ))
     return data?.length > 0
   }
   ```

2. Add checks to UPDATE/DELETE operations:
   ```typescript
   if (!await isClubMember(client, user.id, clubId)) {
     return errorResponse('Not a club member', 403)
   }
   ```

### Phase 3: Server-Scoped Permissions

**Goal:** Users can only access clubs on servers they belong to

**Implementation:** Add server membership validation before all club operations.

---

## Common Patterns

### Pattern 1: Extract User from Token

```typescript
export async function getUserFromToken(client: SupabaseClient, req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return { user: null, error: 'No authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await client.auth.getUser(token)

  return { user, error: error?.message }
}
```

### Pattern 2: Check Admin Permission

```typescript
export async function requireAdmin(client: SupabaseClient, userId: string) {
  const { data } = await client
    .from('members')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (data?.role !== 'admin') {
    throw new Error('Admin permission required')
  }
}
```

### Pattern 3: Validate Club Membership

```typescript
export async function requireClubMember(
  client: SupabaseClient,
  userId: string,
  clubId: string
) {
  const { data: member } = await client
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!member) throw new Error('Member not found')

  const { data: membership } = await client
    .from('memberclubs')
    .select('*')
    .eq('member_id', member.id)
    .eq('club_id', clubId)
    .single()

  if (!membership) {
    throw new Error('Not a club member')
  }
}
```

### Pattern 4: Standard Error Responses

```typescript
// Unauthorized (no/invalid token)
return new Response(
  JSON.stringify({ success: false, error: 'Unauthorized' }),
  { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
)

// Forbidden (valid token, insufficient permissions)
return new Response(
  JSON.stringify({ success: false, error: 'Forbidden: Admin only' }),
  { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
)

// Not Found
return new Response(
  JSON.stringify({ success: false, error: 'Resource not found' }),
  { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
)
```

---

## Summary

**Our Architecture Decision:**
- ✅ Edge Functions are the API gateway (single source of truth)
- ✅ Service role key gives full database access to Edge Functions
- ✅ Authorization logic lives in TypeScript (easy to understand and maintain)
- ✅ RLS is enabled (Supabase requirement) but bypassed by service_role
- ✅ All clients (Discord, web, mobile) call the same API

**Why This Works:**
- Single codebase for business logic
- TypeScript is easier to debug than SQL policies
- Flexible for complex authorization rules
- Consistent behavior across all platforms
- Edge Functions ARE the security layer

**Remember:**
> Edge Functions with service_role are secure because they run on the server, not the client.
> Users can't access the service_role key or modify the Edge Function code.
> The Edge Functions decide what operations are allowed before querying the database.

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Project overview and development patterns
- [DATABASE_SCHEMA.md](../supabase/migrations/DATABASE_SCHEMA.md) - Database schema and relationships
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - Development setup and workflows
- [ARCHITECTURE.md](./ARCHITECTURE.md) - High-level system architecture

## Migration Reference

- **RLS Migration**: [20260109010123_enable_rls_with_temp_policies.sql](../supabase/migrations/20260109010123_enable_rls_with_temp_policies.sql)
  - Enables RLS on all tables (Supabase requirement)
  - Creates temporary policies for authenticated role
  - Policies are inactive (service_role bypasses them)
