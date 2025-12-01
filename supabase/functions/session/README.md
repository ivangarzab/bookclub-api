# Session Endpoint

The Session endpoint manages reading sessions, including books, due dates, and associated discussions for book clubs.

## Base URL

```
POST   /functions/v1/session
GET    /functions/v1/session
PUT    /functions/v1/session
DELETE /functions/v1/session
```

## Authentication

All requests require a valid Supabase JWT token:

```
Authorization: Bearer YOUR_SUPABASE_TOKEN
```

---

## GET - Retrieve Session Details

Retrieves complete information about a specific reading session, including the book, club info, discussions, and shame list.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The unique identifier of the session |

### Request Example

```bash
curl --request GET \
  --url "http://localhost:54321/functions/v1/session?id=session-1" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

### Response

```json
{
  "id": "session-1",
  "club_id": "club-1",
  "book_id": 1,
  "due_date": "2025-04-15",
  "club": {
    "id": "club-1",
    "name": "Freaks & Geeks",
    "discord_channel": 987654321098765432,
    "server_id": 1039326367428395038
  },
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
  ],
  "shame_list": [
    {
      "member_id": 2,
      "member_name": "Jorge Romo"
    }
  ]
}
```

### Error Responses

**400 Bad Request** - Missing required parameter
```json
{
  "success": false,
  "error": "Session ID is required"
}
```

**404 Not Found** - Session not found
```json
{
  "success": false,
  "error": "Session not found"
}
```

---

## POST - Create New Session

Creates a new reading session with a book and optional discussions.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `club_id` | string | Yes | The ID of the club this session belongs to |
| `book` | object | Yes | Book information (see below) |
| `id` | string | No | Custom session ID (UUID generated if not provided) |
| `due_date` | date | No | Session due date (ISO 8601 format) |
| `discussions` | array | No | Array of discussion objects (see below) |

#### Book Object Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Book title |
| `author` | string | Yes | Book author |
| `edition` | string | No | Book edition |
| `year` | integer | No | Publication year |
| `isbn` | string | No | ISBN number |

#### Discussion Object Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Discussion title |
| `date` | date | Yes | Discussion date (ISO 8601 format) |
| `id` | string | No | Custom discussion ID (UUID generated if not provided) |
| `location` | string | No | Discussion location/platform |

### Request Example

```bash
curl --request POST \
  --url "http://localhost:54321/functions/v1/session" \
  --header "Authorization: Bearer YOUR_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "club_id": "club-1",
    "due_date": "2025-06-01",
    "book": {
      "title": "Dune",
      "author": "Frank Herbert",
      "edition": "Paperback",
      "year": 1965,
      "isbn": "978-0441013593"
    },
    "discussions": [
      {
        "title": "Part 1: Arrakis",
        "date": "2025-05-15",
        "location": "Discord Voice Channel"
      },
      {
        "title": "Part 2: Muad'\''Dib",
        "date": "2025-06-01",
        "location": "Discord Voice Channel"
      }
    ]
  }'
```

### Response

```json
{
  "success": true,
  "message": "Session created successfully",
  "session": {
    "id": "generated-uuid",
    "club_id": "club-1",
    "book_id": 8,
    "due_date": "2025-06-01"
  },
  "book": {
    "id": 8,
    "title": "Dune",
    "author": "Frank Herbert",
    "edition": "Paperback",
    "year": 1965,
    "ISBN": "978-0441013593"
  },
  "discussions": [
    {
      "id": "generated-uuid-1",
      "session_id": "generated-uuid",
      "title": "Part 1: Arrakis",
      "date": "2025-05-15",
      "location": "Discord Voice Channel"
    },
    {
      "id": "generated-uuid-2",
      "session_id": "generated-uuid",
      "title": "Part 2: Muad'Dib",
      "date": "2025-06-01",
      "location": "Discord Voice Channel"
    }
  ]
}
```

### Error Responses

**400 Bad Request** - Missing required fields
```json
{
  "success": false,
  "error": "Club ID and book information are required"
}
```

**400 Bad Request** - Invalid discussion data
```json
{
  "success": false,
  "error": "Discussion title is required and must be a non-empty string"
}
```

**Note**: All discussions in the request are validated upfront. If any discussion is missing required fields (title or date) or has empty values, the entire request fails with HTTP 400 before any database operations occur.

**404 Not Found** - Invalid club_id
```json
{
  "success": false,
  "error": "Club not found"
}
```

---

## PUT - Update Session

Updates session information, book details, and/or discussions.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | The ID of the session to update |
| `club_id` | string | No | Move session to different club |
| `due_date` | date | No | Update due date |
| `book` | object | No | Update book information (partial updates allowed) |
| `discussions` | array | No | Update or add discussions |
| `discussion_ids_to_delete` | array | No | Array of discussion IDs to remove |

**Note:** At least one field to update (besides `id`) must be provided.

#### Book Update Behavior

When providing the `book` object:
- Include only fields you want to update
- At least one book field must be provided to trigger book update
- The book record itself is updated (affects all sessions using this book)

#### Discussion Update Behavior

- **Existing discussions**: Include the discussion `id` and fields to update
- **New discussions**: Omit `id` or provide new ID, include `title` and `date`
- **Delete discussions**: Use `discussion_ids_to_delete` array

### Request Example

```bash
curl --request PUT \
  --url "http://localhost:54321/functions/v1/session" \
  --header "Authorization: Bearer YOUR_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "id": "session-1",
    "due_date": "2025-04-30",
    "book": {
      "edition": "Updated Edition"
    },
    "discussions": [
      {
        "id": "disc-1",
        "location": "Discord Stage Channel"
      },
      {
        "title": "New Discussion",
        "date": "2025-04-25",
        "location": "Discord Voice Channel"
      }
    ],
    "discussion_ids_to_delete": ["disc-old-1"]
  }'
```

### Response

```json
{
  "success": true,
  "message": "Session updated successfully",
  "updated": {
    "session": true,
    "book": true,
    "discussions": true
  },
  "session": {
    "id": "session-1",
    "club_id": "club-1",
    "book_id": 1,
    "due_date": "2025-04-30"
  }
}
```

### No Changes Response

If no actual changes were applied:

```json
{
  "success": true,
  "message": "No changes were applied to the session"
}
```

### Error Responses

**400 Bad Request** - Missing required fields or no updates
```json
{
  "error": "Session ID is required"
}
```

**404 Not Found** - Session not found
```json
{
  "error": "Session not found"
}
```

---

## DELETE - Delete Session

Permanently deletes a session and optionally its associated book (cascading delete).

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The ID of the session to delete |

### Cascading Behavior

Deleting a session will automatically delete:
1. All discussions for the session
2. The session itself
3. The associated book (if not used by other sessions)*

**\*Book Deletion Note:** If the book is used by other sessions, deletion will fail gracefully. The session and discussions will still be deleted, but you'll receive a warning about the book.

### Request Example

```bash
curl --request DELETE \
  --url "http://localhost:54321/functions/v1/session?id=session-1" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

### Response

**Full success:**
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

**Partial success (book deletion failed):**
```json
{
  "success": true,
  "message": "Session deleted but could not delete associated book",
  "warning": "Book is used by other sessions"
}
```

### Error Responses

**400 Bad Request** - Missing required parameter
```json
{
  "success": false,
  "error": "Session ID is required"
}
```

**404 Not Found** - Session not found
```json
{
  "success": false,
  "error": "Session not found"
}
```

---

## Notes

### Active vs Past Sessions

Sessions are considered "active" or "past" based on your application logic, not the API itself. Typically:
- **Active session**: Current reading with a future or recent due date
- **Past session**: Completed reading with past due date

The club endpoint automatically categorizes sessions when retrieving club details.

### Book Reuse

Books are stored separately from sessions to avoid duplication:
- Multiple sessions can reference the same book
- Updating a book affects all sessions using that book
- Deleting a session only deletes the book if no other sessions reference it

### Discussion Ordering

- Discussions are automatically sorted by date in ascending order when retrieved
- This provides a chronological view of planned or completed discussions

### Due Dates

- Due dates are optional but recommended for tracking reading progress
- Store in ISO 8601 format: `YYYY-MM-DD`
- Used by applications to determine session status and send reminders

### Multi-Server Considerations

While sessions don't directly reference `server_id`, they inherit server context from their parent club:
- Sessions belong to clubs
- Clubs belong to servers
- Therefore, sessions are implicitly scoped to servers through their club association