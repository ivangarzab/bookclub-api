# Member Endpoint

The Member endpoint manages individual member data, including points, books read, club associations, and Supabase authentication integration.

## Base URL

```
POST   /functions/v1/member
GET    /functions/v1/member
PUT    /functions/v1/member
DELETE /functions/v1/member
```

## Authentication

All requests require a valid Supabase JWT token:

```
Authorization: Bearer YOUR_SUPABASE_TOKEN
```

---

## GET - Retrieve Member Details

Retrieves complete information about a specific member, including club memberships and shame list status.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Conditional* | The internal member ID |
| `user_id` | uuid | Conditional* | The Supabase auth user ID |

**\*Note:** You must provide either `id` OR `user_id` (not both).

### Request Examples

**Get member by internal ID:**
```bash
curl --request GET \
  --url "http://localhost:54321/functions/v1/member?id=1" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

**Get member by Supabase user ID (auth integration):**
```bash
curl --request GET \
  --url "http://localhost:54321/functions/v1/member?user_id=550e8400-e29b-41d4-a716-446655440000" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

### Response

```json
{
  "id": 1,
  "name": "Ivan Garza",
  "points": 250,
  "books_read": 20,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "admin",
  "handle": "ivangarza",
  "created_at": "2024-01-15T10:30:00+00:00",
  "clubs": [
    {
      "id": "club-1",
      "name": "Freaks & Geeks",
      "discord_channel": 987654321098765432,
      "server_id": 1039326367428395038
    },
    {
      "id": "club-2",
      "name": "Blingers Pilingers",
      "discord_channel": 876543210987654321,
      "server_id": 1039326367428395038
    }
  ],
  "shame_clubs": [
    {
      "club_id": "club-1",
      "club_name": "Freaks & Geeks"
    }
  ]
}
```

### Error Responses

**400 Bad Request** - Missing required parameters
```json
{
  "success": false,
  "error": "Either Member ID or User ID is required"
}
```

**404 Not Found** - Member not found
```json
{
  "success": false,
  "error": "Member not found"
}
```

---

## POST - Create New Member

Creates a new member with optional club associations.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The name of the member |
| `id` | integer | No | Custom member ID (auto-generated if not provided) |
| `user_id` | uuid | No | Supabase auth user ID for authentication integration |
| `points` | integer | No | Initial points (defaults to 0) |
| `books_read` | integer | No | Initial books read count (defaults to 0) |
| `role` | string | No | Member role (e.g., "admin", "member") |
| `handle` | string | No | User handle or username for display |
| `clubs` | array | No | Array of club IDs to associate the member with |

**Note:** The `created_at` field is automatically set by the database when a member is created and cannot be manually specified.

### Request Example

```bash
curl --request POST \
  --url "http://localhost:54321/functions/v1/member" \
  --header "Authorization: Bearer YOUR_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "name": "New Member",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "points": 50,
    "books_read": 3,
    "role": "member",
    "handle": "newmember",
    "clubs": ["club-1", "club-2"]
  }'
```

### Response

```json
{
  "id": 7,
  "name": "New Member",
  "points": 50,
  "books_read": 3,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "member",
  "handle": "newmember",
  "created_at": "2025-11-30T20:59:15.123456+00:00",
  "clubs": ["club-1", "club-2"]
}
```

### Error Responses

**400 Bad Request** - Missing required fields
```json
{
  "success": false,
  "error": "Member name is required"
}
```

**400 Bad Request** - Invalid club associations
```json
{
  "success": false,
  "error": "The following clubs do not exist: club-3, club-4"
}
```

**Note**: Club associations are validated upfront. If any club ID doesn't exist, the entire request fails with HTTP 400 before creating the member.

**500 Internal Server Error** - Creation failed
```json
{
  "success": false,
  "error": "Failed to create member: [error details]"
}
```

---

## PUT - Update Member

Updates member information and/or club associations.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | integer | Yes | The ID of the member to update |
| `name` | string | No | New name for the member |
| `points` | integer | No | New points value |
| `books_read` | integer | No | New books read count |
| `user_id` | uuid | No | Link or update Supabase auth user ID |
| `role` | string | No | Update member role |
| `handle` | string | No | Update user handle or username |
| `clubs` | array | No | Complete array of club IDs (replaces all associations) |

**Note:** At least one field to update (besides `id`) must be provided.

### Update Behavior

- **Basic fields** (name, points, books_read, user_id, role): Updated individually
- **Clubs array**: Performs complete replacement
  - Adds associations for clubs in the new list but not in the existing list
  - Removes associations for clubs in the existing list but not in the new list

### Request Example

```bash
curl --request PUT \
  --url "http://localhost:54321/functions/v1/member" \
  --header "Authorization: Bearer YOUR_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "id": 1,
    "points": 300,
    "books_read": 25,
    "clubs": ["club-1", "club-3"]
  }'
```

### Response

```json
{
  "success": true,
  "message": "Member updated successfully",
  "updated": {
    "member_fields": true,
    "clubs": true
  },
  "member": {
    "id": 1,
    "name": "Ivan Garza",
    "points": 300,
    "books_read": 25,
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "admin"
  }
}
```

### No Changes Response

If no actual changes were applied:

```json
{
  "success": true,
  "message": "No changes were applied",
  "member": {
    "id": 1,
    "name": "Ivan Garza",
    "points": 250,
    "books_read": 20
  }
}
```

### Error Responses

**400 Bad Request** - Missing required fields or no updates
```json
{
  "success": false,
  "error": "Member ID is required"
}
```

**404 Not Found** - Member not found
```json
{
  "success": false,
  "error": "Member not found"
}
```

---

## DELETE - Delete Member

Permanently deletes a member and all associated data (cascading delete).

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | The ID of the member to delete |

### Cascading Behavior

Deleting a member will automatically delete:
1. All shame list entries for the member
2. All club associations (MemberClubs entries)
3. The member record itself

**Note:** This does NOT delete clubs the member belonged to, only the associations.

### Request Example

```bash
curl --request DELETE \
  --url "http://localhost:54321/functions/v1/member?id=1" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

### Response

```json
{
  "success": true,
  "message": "Member deleted successfully"
}
```

### Error Responses

**400 Bad Request** - Missing required parameter
```json
{
  "success": false,
  "error": "Member ID is required"
}
```

**404 Not Found** - Member not found
```json
{
  "success": false,
  "error": "Member not found"
}
```

---

## Notes

### Authentication Integration

The `user_id` field links Discord bot members with Supabase authenticated users, enabling:

- **Unified identity**: Same member record for both Discord bot and web app
- **Auth-based queries**: Look up members by their Supabase auth UUID
- **Permission management**: Link member roles with Supabase auth policies

**Workflow Example:**
1. User signs up via web app (Supabase Auth creates user)
2. User links Discord account
3. Bot creates/updates member record with `user_id`
4. Web app can now query member by `user_id` to show Discord bot stats

### Club Association Management

When updating clubs:
- Providing an empty array `[]` removes all club associations
- Not providing the `clubs` field leaves associations unchanged
- Invalid club IDs in the array will be skipped with errors logged

### Points and Books Read

- Points typically increment when members complete readings on time
- Books read increments when a member finishes a book
- These fields are managed by your application logic (not automatically updated)