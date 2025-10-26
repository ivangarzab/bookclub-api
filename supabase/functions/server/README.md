# Server Endpoint

The Server endpoint manages Discord server registrations, enabling the bot to support multiple Discord servers with isolated club data.

## Base URL

```
POST   /functions/v1/server
GET    /functions/v1/server
PUT    /functions/v1/server
DELETE /functions/v1/server
```

## Authentication

All requests require a valid Supabase JWT token:

```
Authorization: Bearer YOUR_SUPABASE_TOKEN
```

---

## GET - Retrieve Server Details

Retrieves information about Discord servers, either all servers or a specific server with its clubs.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | bigint | No | The Discord server ID (omit to get all servers) |

### Request Examples

**Get all servers:**
```bash
curl --request GET \
  --url "http://localhost:54321/functions/v1/server" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

**Get specific server:**
```bash
curl --request GET \
  --url "http://localhost:54321/functions/v1/server?id=1039326367428395038" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

### Response - All Servers

```json
{
  "servers": [
    {
      "id": "1039326367428395038",
      "name": "Production Server",
      "clubs": [
        {
          "id": "club-1",
          "name": "Freaks & Geeks",
          "discord_channel": "987654321098765432"
        },
        {
          "id": "club-2",
          "name": "Blingers Pilingers",
          "discord_channel": "876543210987654321"
        }
      ]
    },
    {
      "id": "1234567890123456789",
      "name": "Test Server Alpha",
      "clubs": [
        {
          "id": "club-3",
          "name": "Trifecta",
          "discord_channel": "765432109876543210"
        }
      ]
    }
  ]
}
```

### Response - Specific Server

```json
{
  "id": "1039326367428395038",
  "name": "Production Server",
  "clubs": [
    {
      "id": "club-1",
      "name": "Freaks & Geeks",
      "discord_channel": "987654321098765432",
      "member_count": 5,
      "latest_session": {
        "id": "session-1",
        "due_date": "2025-04-15",
        "books": {
          "title": "The Republic",
          "author": "Plato"
        }
      }
    },
    {
      "id": "club-2",
      "name": "Blingers Pilingers",
      "discord_channel": "876543210987654321",
      "member_count": 3,
      "latest_session": {
        "id": "session-2",
        "due_date": "2025-04-20",
        "books": {
          "title": "Das Kapital",
          "author": "Karl Marx"
        }
      }
    }
  ]
}
```

### Error Responses

**404 Not Found** - Server not found
```json
{
  "error": "Server not found"
}
```

---

## POST - Register New Server

Registers a new Discord server in the system, allowing clubs to be created within it.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | The name of the Discord server |
| `id` | bigint | No | Discord server ID (auto-generated if not provided) |

**Note:** It's recommended to provide the actual Discord server ID rather than using an auto-generated one.

### Request Example

```bash
curl --request POST \
  --url "http://localhost:54321/functions/v1/server" \
  --header "Authorization: Bearer YOUR_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "id": 1234567890123456789,
    "name": "My Discord Server"
  }'
```

### Response

```json
{
  "success": true,
  "message": "Server created successfully",
  "server": {
    "id": "1234567890123456789",
    "name": "My Discord Server"
  }
}
```

### Error Responses

**400 Bad Request** - Missing required fields
```json
{
  "error": "Server name is required"
}
```

**500 Internal Server Error** - Server ID already exists
```json
{
  "error": "duplicate key value violates unique constraint"
}
```

---

## PUT - Update Server

Updates server information (currently only the name).

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | bigint | Yes | The Discord server ID to update |
| `name` | string | No | New name for the server |

**Note:** At least one field to update (besides `id`) must be provided.

### Request Example

```bash
curl --request PUT \
  --url "http://localhost:54321/functions/v1/server" \
  --header "Authorization: Bearer YOUR_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "id": 1234567890123456789,
    "name": "Updated Server Name"
  }'
```

### Response

```json
{
  "success": true,
  "message": "Server updated successfully",
  "server": {
    "id": "1234567890123456789",
    "name": "Updated Server Name"
  }
}
```

### Error Responses

**400 Bad Request** - Missing required fields or no updates
```json
{
  "error": "No fields to update"
}
```

**404 Not Found** - Server not found
```json
{
  "error": "Server not found"
}
```

---

## DELETE - Delete Server

Permanently deletes a server registration. This will only succeed if the server has no associated clubs.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | bigint | Yes | The Discord server ID to delete |

### Request Example

```bash
curl --request DELETE \
  --url "http://localhost:54321/functions/v1/server?id=1234567890123456789" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

### Response

```json
{
  "success": true,
  "message": "Server deleted successfully"
}
```

### Error Responses

**400 Bad Request** - Server has existing clubs
```json
{
  "error": "Cannot delete server with existing clubs. Please delete all clubs first.",
  "clubs_count": 3
}
```

**400 Bad Request** - Missing required parameter
```json
{
  "error": "Server ID is required"
}
```

**404 Not Found** - Server not found
```json
{
  "error": "Server not found"
}
```

---

## Notes

### Server Registration Flow

**Typical workflow when bot joins a new Discord server:**
1. Bot receives `GUILD_CREATE` event from Discord
2. Bot calls `POST /server` with Discord's server ID and name
3. Server is now registered and clubs can be created within it

### Discord Server IDs

- Server IDs are Discord snowflake IDs (large 64-bit integers)
- Stored as `bigint` in PostgreSQL
- Returned as strings in API responses to prevent JavaScript precision loss
- Example: `1039326367428395038`

### Server Isolation

- Each club belongs to exactly one server
- Members can belong to clubs across multiple servers
- Clubs with identical names can exist on different servers
- Discord channels are scoped to servers (can have same channel ID on different servers)

### Deletion Protection

Servers cannot be deleted if they have associated clubs. This prevents:
- Accidental data loss
- Orphaned club data
- Breaking foreign key relationships

**To delete a server:**
1. First delete all clubs on that server
2. Then delete the server registration

### Large Number Handling

The API automatically casts server IDs and Discord channel IDs to strings to prevent precision loss in JavaScript environments where numbers are limited to 53-bit integers.

### Detailed vs Summary Views

**Get all servers** returns a summary:
- Server ID and name
- List of clubs (basic info only)

**Get specific server** returns detailed info:
- Server ID and name
- List of clubs with:
  - Member count
  - Latest session information
  - Discord channel IDs

### Typical Use Cases

**Bot initialization:**
```
GET /server → Get all registered servers
```

**New server joins:**
```
POST /server → Register new Discord server
```

**Server renamed in Discord:**
```
PUT /server → Update server name
```

**Bot kicked from server:**
```
GET /server?id=X → Check if clubs exist
DELETE /server?id=X → Remove registration (after clubs deleted)
```