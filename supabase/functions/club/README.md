# Club Endpoint

The Club endpoint manages book club data across multiple Discord servers, including club information, members, sessions, and shame lists.

## Base URL

```
POST   /functions/v1/club
GET    /functions/v1/club
PUT    /functions/v1/club
DELETE /functions/v1/club
```

## Authentication

All requests require a valid Supabase JWT token:

```
Authorization: Bearer YOUR_SUPABASE_TOKEN
```

---

## GET - Retrieve Club Details

Retrieves complete information about a specific club, including members, sessions, and shame list.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Conditional* | The unique identifier of the club |
| `server_id` | text | No** | Optional Discord server ID (required when using discord_channel) |
| `discord_channel` | text | Conditional* | The Discord channel ID associated with the club |

**\*Note:** You must provide either `id` OR `discord_channel` (not both).
**\*\*Note:** `server_id` becomes required when querying by `discord_channel` to prevent ambiguity.

### Request Examples

**Get club by ID:**
```bash
curl --request GET \
  --url "http://localhost:54321/functions/v1/club?id=club-1&server_id=1039326367428395038" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

**Get club by Discord channel:**
```bash
curl --request GET \
  --url "http://localhost:54321/functions/v1/club?discord_channel=987654321098765432&server_id=1039326367428395038" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

### Response

```json
{
  "id": "club-1",
  "name": "Freaks & Geeks",
  "discord_channel": 987654321098765432,
  "server_id": 1039326367428395038,
  "members": [
    {
      "id": 1,
      "name": "Ivan Garza",
      "points": 250,
      "books_read": 20,
      "user_id": "uuid-here-if-linked",
      "role": "admin"
    }
  ],
  "active_session": {
    "id": "session-1",
    "club_id": "club-1",
    "book_id": 1,
    "due_date": "2025-04-15",
    "book": {
      "id": 1,
      "title": "The Republic",
      "author": "Plato",
      "edition": "Reeve Edition",
      "year": -380,
      "ISBN": "978-0872207363"
    },
    "discussions": [
      {
        "id": "disc-1",
        "session_id": "session-1",
        "title": "Looking outside of the Cave",
        "date": "2025-04-15",
        "location": "Discord Voice Channel"
      }
    ]
  },
  "past_sessions": [
    // Array of past session objects with same structure as active_session
  ],
  "shame_list": [
    {
      "id": 2,
      "name": "Jorge Romo",
      "points": 120,
      "books_read": 8
    }
  ]
}
```

### Error Responses

**400 Bad Request** - Missing required parameters
```json
{
  "error": "Either Club ID or Discord Channel is required"
}
```

**404 Not Found** - Server or club not found
```json
{
  "error": "Server not found or not registered"
}
```

---

## POST - Create New Club

Creates a new book club with optional initial members, session, and shame list.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The name of the club |
| `server_id` | text | No | Optional Discord server ID (for Discord integration) |
| `id` | string | No | Custom club ID (UUID generated if not provided) |
| `discord_channel` | text | No | Discord channel ID for the club |
| `members` | array | No | Array of member objects to add to the club |
| `active_session` | object | No | Initial reading session with book and discussions |
| `shame_list` | array | No | Array of member IDs to add to shame list |

#### Member Object Structure

```json
{
  "id": 1,
  "name": "Member Name",
  "points": 0,
  "books_read": 0
}
```

#### Active Session Object Structure

```json
{
  "id": "session-1",
  "due_date": "2025-04-15",
  "book": {
    "title": "Book Title",
    "author": "Author Name",
    "edition": "Edition Name",
    "year": 2024,
    "isbn": "978-1234567890"
  },
  "discussions": [
    {
      "id": "disc-1",
      "title": "Discussion Title",
      "date": "2025-04-15",
      "location": "Discord Voice Channel"
    }
  ]
}
```

### Request Example

```bash
curl --request POST \
  --url "http://localhost:54321/functions/v1/club" \
  --header "Authorization: Bearer YOUR_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "name": "Mystery Readers",
    "server_id": 1039326367428395038,
    "discord_channel": 555666777888999000,
    "members": [
      {
        "id": 1,
        "name": "Ivan Garza",
        "points": 100,
        "books_read": 5
      }
    ],
    "active_session": {
      "due_date": "2025-05-01",
      "book": {
        "title": "Murder on the Orient Express",
        "author": "Agatha Christie",
        "year": 1934
      }
    }
  }'
```

### Response

```json
{
  "success": true,
  "message": "Club created successfully",
  "club": {
    "id": "generated-uuid",
    "name": "Mystery Readers",
    "discord_channel": 555666777888999000,
    "server_id": 1039326367428395038
  }
}
```

### Error Responses

**400 Bad Request** - Missing required fields
```json
{
  "error": "Club name is required"
}
```

**404 Not Found** - Invalid server_id
```json
{
  "error": "Server not found or not registered"
}
```

---

## PUT - Update Club

Updates club information, including name, Discord channel, and shame list.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | The ID of the club to update |
| `server_id` | text | No | Optional Discord server ID (for validation) |
| `name` | string | No | New name for the club |
| `discord_channel` | text | No | New Discord channel ID |
| `shame_list` | array | No | Complete array of member IDs (replaces existing) |

**Note:** At least one field to update (besides `id` and `server_id`) must be provided.

### Request Example

```bash
curl --request PUT \
  --url "http://localhost:54321/functions/v1/club" \
  --header "Authorization: Bearer YOUR_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "id": "club-1",
    "server_id": 1039326367428395038,
    "name": "Updated Club Name",
    "shame_list": [2, 5]
  }'
```

### Response

```json
{
  "success": true,
  "message": "Club updated successfully",
  "club": {
    "id": "club-1",
    "name": "Updated Club Name",
    "discord_channel": 987654321098765432,
    "server_id": 1039326367428395038
  },
  "shame_list_updated": true
}
```

### Error Responses

**400 Bad Request** - No fields to update
```json
{
  "error": "No fields to update"
}
```

**404 Not Found** - Club not found
```json
{
  "error": "Club not found"
}
```

---

## DELETE - Delete Club

Permanently deletes a club and all associated data (cascading delete).

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The ID of the club to delete |
| `server_id` | text | No | Optional Discord server ID (for validation) |

### Cascading Behavior

Deleting a club will automatically delete:
1. All discussions for sessions in the club
2. All sessions belonging to the club
3. All shame list entries for the club
4. All member-club associations
5. The club itself

### Request Example

```bash
curl --request DELETE \
  --url "http://localhost:54321/functions/v1/club?id=club-1&server_id=1039326367428395038" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

### Response

```json
{
  "success": true,
  "message": "Club deleted successfully"
}
```

### Error Responses

**400 Bad Request** - Missing required parameters
```json
{
  "error": "Club ID and Server ID are required"
}
```

**404 Not Found** - Club not found
```json
{
  "error": "Club not found"
}
```

---

## Notes

### Multi-Server Support

- All operations now require `server_id` to ensure proper isolation between Discord servers
- Clubs with the same name can exist on different servers
- Discord channels are unique per server

### Shame List Management

- Shame lists are club-wide (not session-specific)
- Updating the shame list via PUT completely replaces the existing list
- Members on the shame list can still be active club members

### Server Validation

All endpoints validate that the provided `server_id` exists in the `servers` table before performing operations. This prevents operations on non-existent or unregistered servers.