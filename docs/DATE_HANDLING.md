# Date Handling in Bookclub API

This document describes how dates and timestamps are handled throughout the Bookclub API.

## Date Fields in Database

### 1. **Sessions Table**
- **Field**: `due_date`
- **Type**: `DATE`
- **Format**: ISO 8601 date (YYYY-MM-DD)
- **Nullable**: Yes
- **Description**: The date when a reading session should be completed
- **Example**: `"2025-12-31"`

### 2. **Discussions Table**
- **Field**: `date`
- **Type**: `DATE`
- **Format**: ISO 8601 date (YYYY-MM-DD)
- **Nullable**: Yes (optional field)
- **Description**: The date when a discussion is scheduled
- **Example**: `"2025-11-15"`
- **Validation**: Required when creating/updating discussions (validated in session handlers)

### 3. **Clubs Table**
- **Field**: `founded_date`
- **Type**: `DATE`
- **Format**: ISO 8601 date (YYYY-MM-DD)
- **Nullable**: Yes
- **Description**: The date when the club was established
- **Example**: `"2024-01-15"`
- **Added**: Migration 20251130205915

### 4. **Members Table**
- **Field**: `created_at`
- **Type**: `TIMESTAMP WITH TIME ZONE`
- **Format**: ISO 8601 timestamp with timezone
- **Nullable**: No (has DEFAULT NOW())
- **Description**: Timestamp when the member account was created
- **Example**: `"2025-11-30T20:59:15.123456+00:00"`
- **Auto-generated**: Yes (database default)
- **Added**: Migration 20251130205915

## API Request/Response Formats

### Sending Dates to API (Requests)

All date fields in API requests should use **ISO 8601 date format**: `YYYY-MM-DD`

Examples:
```json
{
  "due_date": "2025-12-31",
  "founded_date": "2024-01-15",
  "discussions": [
    {
      "title": "Chapter 1",
      "date": "2025-11-15",
      "location": "Discord"
    }
  ]
}
```

### Receiving Dates from API (Responses)

- **DATE fields** are returned as strings in ISO 8601 format: `"YYYY-MM-DD"`
- **TIMESTAMP WITH TIME ZONE fields** are returned as ISO 8601 timestamps: `"YYYY-MM-DDTHH:MM:SS.ssssss+00:00"`

Example response:
```json
{
  "id": "session-1",
  "club_id": "club-1",
  "due_date": "2025-12-31",
  "book": {
    "title": "Dune",
    "author": "Frank Herbert"
  },
  "discussions": [
    {
      "id": "disc-1",
      "title": "Introduction",
      "date": "2025-11-15",
      "location": "Discord"
    }
  ]
}
```

## Validation

### Discussion Date Validation

Discussion dates are **required and validated** in session handlers:

**Location**: `supabase/functions/session/utils/validation.ts`

```typescript
export function validateDiscussion(discussion: any): { valid: boolean; error?: string } {
  if (!discussion.date || typeof discussion.date !== 'string' || discussion.date.trim() === '') {
    return { valid: false, error: 'Discussion date is required and must be a non-empty string' }
  }
  // ... other validations
  return { valid: true }
}
```

**Behavior**:
- Missing `date` field → HTTP 400 error
- Empty `date` string → HTTP 400 error
- Invalid format → Database will reject (constraint violation)

### Other Date Fields

**Optional fields** (`due_date`, `founded_date`):
- Can be omitted from requests
- Stored as NULL in database
- Returned as `null` in responses

**Auto-generated fields** (`created_at`):
- Cannot be set in requests (ignored if provided)
- Automatically set by database on INSERT
- Always present in responses

## Date Type Migration History

From `supabase/migrations/20250325060346_remote_schema.sql`:

1. **Discussions.date**: Changed from `text` to `date` type
2. **Sessions.duedate**: Renamed to `due_date` and changed to `date` type

This migration improved type safety and ensured consistent date handling across the database.

## Best Practices

### For API Consumers

1. **Always use ISO 8601 format** for dates: `YYYY-MM-DD`
2. **Include timezone information** when working with timestamps
3. **Validate date formats** on the client side before sending to API
4. **Handle null dates** gracefully (optional fields may be null)
5. **Don't send `created_at`** when creating members (it's auto-generated)

### For API Developers

1. **Use DATE type** for calendar dates (no time component)
2. **Use TIMESTAMP WITH TIME ZONE** for exact moments in time
3. **Validate required date fields** before database operations
4. **Document nullable vs required** date fields in API documentation
5. **Return dates in consistent format** (ISO 8601)

## PostgreSQL Date/Time Types Used

- **`DATE`**: Calendar date (no time), stored as YYYY-MM-DD
- **`TIMESTAMP WITH TIME ZONE`**: Exact moment in time with timezone information

PostgreSQL automatically handles:
- ISO 8601 string parsing
- Timezone conversions
- Date validation (rejects invalid dates like "2025-02-30")

## Related Files

- Database schema: `supabase/migrations/DATABASE_SCHEMA.md`
- Date migration: `supabase/migrations/20251130205915_add_metadata_fields.sql`
- Discussion validation: `supabase/functions/session/utils/validation.ts`
- Session handlers: `supabase/functions/session/handlers/create.ts`, `update.ts`, `get.ts`
- Club handlers: `supabase/functions/club/handlers/create.ts`, `update.ts`, `get.ts`
- Member handlers: `supabase/functions/member/handlers/create.ts`, `get.ts`

## Summary

The API uses standard PostgreSQL date types with ISO 8601 formatting:
- **Simple dates** → `DATE` type (YYYY-MM-DD format)
- **Timestamps** → `TIMESTAMP WITH TIME ZONE` type (full ISO 8601)
- **Validation** → Required date fields are validated upfront
- **Auto-generation** → `created_at` is set automatically by database
- **Consistency** → All date/time values use ISO 8601 standard
