# Book Club API

This repository contains Supabase Edge Functions that serve as the API for the Book Club application. It handles all database interactions and provides a consistent interface that can be consumed by various clients (Discord bot, mobile apps, etc.).

## Repository Structure

``` text
bookclub-api/
├── supabase/
│   ├── migrations/            # Database migrations pulled from production
│   │   └── *.sql
│   └── functions/             # Edge Functions
│       ├── club/
│       │   └── index.ts
│       ├── member/
│       │   └── index.ts
│       └── session/
│           └── index.ts
├── local-env-refresh.sh       # Script to refresh local environment
├── seed.sql                   # Sample data for local development
└── README.md                  # This file
```

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Node.js](https://nodejs.org/) (for TypeScript support)
- [PostgreSQL Client (psql)](https://www.postgresql.org/download/) (optional)

## Initial Setup

### 1. Install Required Tools

```bash
# Install Supabase CLI using npm
npm install -g supabase

# OR using Homebrew on macOS
brew install supabase/tap/supabase
```

### 2. Clone and Set Up Repository

```bash
# Clone this repository
git clone https://github.com/ivangarzab/bookclub-api.git
cd bookclub-api

# Initialize Supabase in this directory
supabase init
```

### 3. Set Up Your Local Environment

```bash
# Start your local Supabase instance
supabase start

# Link to your production project (to pull schema)
# You can leave the password blank if you don't have it
# The project-ref can be extracted from the Supabase URL, and it is simply the Project ID
supabase link --project-ref your-production-project-ref

# Pull the current schema from production
supabase db pull

# Reset the database with the schema and seed data
supabase db reset

# Apply seed data
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f seed.sql
```

### 4. Handling Config Warnings

If you see warnings about config differences between local and production, you can manually update your `supabase/config.toml` file to match the production settings for consistency. These changes typically affect authentication settings and may not impact API development directly.

## Development Workflow

### Local Development & Testing

1. **Start/refresh your local environment**:

    ```bash
    # Start Supabase if it's not running
    supabase start

    # Check status and get your local anon key
    supabase status
    ```

2. **Serve Edge Functions locally for testing**:

    ```bash
    # Serve all functions
    supabase functions serve

    # Or serve specific functions
    supabase functions serve club member session
    ```

3. **Test with curl**:

    ```bash
    # Test the club endpoint (get a club)
    curl --request GET \
      --url "http://localhost:54321/functions/v1/club?id=club-1" \
      --header "Content-Type: application/json" \
      --header "Authorization: Bearer your-local-anon-key"

    # Test creating a member
    curl --request POST \
      --url "http://localhost:54321/functions/v1/member" \
      --header "Content-Type: application/json" \
      --header "Authorization: Bearer your-local-anon-key" \
      --data '{
        "name": "New Member",
        "points": 0,
        "books_read": 0,
        "clubs": ["club-1"]
      }'
    ```

**NOTE:** Testing may also be done with Postman

### Recovering From Local Environment Issues

If your local environment gets into an inconsistent state:

```bash
# Stop Supabase
supabase stop

# Clean up (but preserve your functions directory!)
rm -f config.toml
rm -rf .supabase

# Start fresh
supabase init
supabase start

# Link and pull again
supabase link --project-ref your-production-project-ref
supabase db pull
supabase db reset

# Seed data
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f seed.sql
```

### Updating Your Local Database Schema

As your production schema evolves, you'll want to keep your local environment in sync:

```bash
# Pull latest schema
supabase link --project-ref your-production-project-ref
supabase db pull

# Reset and reload
supabase db reset

# Re-seed data
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f seed.sql
```

### Deploying to Production

When you're ready to deploy your functions to production:

```bash
# Link to production project
supabase link --project-ref your-production-project-ref

# Deploy all functions
supabase functions deploy --all

# Or deploy specific functions
supabase functions deploy club member session
```

## Data Schema

The database schema has been optimized with the following design choices:

1. **Club-based Shame Lists**: Shame lists are now directly associated with clubs rather than sessions. This simplifies the data model and allows for club-wide tracking of members who haven't completed readings.

2. **Discord Channel at Club Level**: The `discord_channel` field has been moved from sessions to the club level, reflecting that channels are typically associated with clubs rather than individual reading sessions.

3. **Consistent Snake Case Naming**: All database fields and API parameters use consistent snake_case naming for better readability and maintainability.

## API Endpoints

The API follows RESTful principles with these main endpoints:

### Club Endpoint: `/club`

#### GET `/club`

**Required Parameters:**

- `id` - The ID of the club to retrieve (as a URL query parameter)

**Response:**

- Returns the club details including:
  - Club information (name, discord_channel)
  - Members list
  - Active session
  - Past sessions
  - Shame list (members who haven't completed readings)
- If no members are found, returns an empty members array
- If no active session exists, returns null for active_session

#### POST `/club` (Create)

**Required Fields:**

- `name` - The name of the club

**Optional Fields:**

- `id` - A unique identifier for the club (if not provided, a UUID will be generated)
- `discord_channel` - The Discord channel ID associated with this club
- `members` - An array of member objects, each requiring:
  - `id` - Member identifier
  - `name` - Member name
  - `points` - Member points (defaults to 0 if not provided)
  - `books_read` - Number of books read by member (defaults to 0 if not provided)
- `active_session` - Session object with:
  - `id` - Session identifier (required if active_session is provided)
  - `due_date` - Due date for the session (optional)
  - `book` - Book object with:
    - `title` - Book title (required if active_session is provided)
    - `author` - Book author (required if active_session is provided)
    - `edition` - Book edition (optional)
    - `year` - Publication year (optional)
    - `isbn` - ISBN number (optional)
  - `discussions` - Array of discussion objects, each requiring:
    - `id` - Discussion identifier
    - `title` - Discussion title
    - `date` - Discussion date
    - `location` - Discussion location (optional)
- `shame_list` - Array of member IDs to be added to the club's shame list

#### PUT `/club` (Update)

**Required Fields:**

- `id` - The ID of the club to update

**Optional Fields:**

- `name` - The new name for the club
- `discord_channel` - The Discord channel ID for the club
- `shame_list` - Array of member IDs for the club's shame list (replaces existing list)

**Note:** At least one field to update must be provided, or the request will return a 400 error.

#### DELETE `/club`

**Required Parameters:**

- `id` - The ID of the club to delete (as a URL query parameter)

**Behavior:**

- Performs a cascading delete that removes:
  1. Discussions for any sessions in the club
  2. Sessions belonging to the club
  3. Shame list entries for the club
  4. Member-club associations
  5. The club itself
  
-----

### Session Endpoint: `/session`

#### GET `/session`

**Required Parameters:**

- `id` - The ID of the session to retrieve (as a URL query parameter)

**Response:**

- Returns session details including:
  - Club info (including discord_channel)
  - Book details
  - Due date
  - Discussions (sorted by date in ascending order)
  - Club's shame list members

#### POST `/session` (Create)

**Required Fields:**

- `club_id` - The ID of the club the session belongs to
- `book` - An object containing book information:
  - `title` - Book title (required)
  - `author` - Book author (required)

**Optional Fields:**

- `id` - Session identifier (if not provided, a UUID will be generated)
- `due_date` - Session due date
- `book` - Additional book properties:
  - `edition` - Book edition
  - `year` - Publication year
  - `isbn` - ISBN number
- `discussions` - Array of discussion objects, each requiring:
  - `title` - Discussion title (required)
  - `date` - Discussion date (required)
  - `id` - Discussion identifier (if not provided, a UUID will be generated)
  - `location` - Discussion location

#### PUT `/session` (Update)

**Required Fields:**

- `id` - The ID of the session to update

**Optional Fields:**

- `club_id` - New club ID (verified to exist)
- `due_date` - New due date
- `book` - Book updates (at least one property required to trigger update):
  - `title` - New book title
  - `author` - New book author
  - `edition` - New book edition
  - `year` - New publication year
  - `isbn` - New ISBN
- `discussions` - Array of discussion objects to update or add:
  - For existing discussions: Include `id` and fields to update
  - For new discussions: Include `title` and `date` (and optionally `id`)
- `discussion_ids_to_delete` - Array of discussion IDs to remove

**Behavior:**

- Updates only the specified fields
- Returns which components were updated (book, session, discussions)
- If no changes were applied, returns a message indicating so

#### DELETE `/session`

**Required Parameters:**

- `id` - The ID of the session to delete (as a URL query parameter)

**Behavior:**

- Performs a cascading delete that removes:
  1. Discussions
  2. The session itself
  3. The associated book (note: may fail if book is used by other sessions)

-----

### Member Endpoint: `/member`

#### GET `/member`

**Required Parameters:**

- `id` - The ID of the member to retrieve (as a URL query parameter)

**Response:**

- Returns complete member details including:
  - Basic member information (name, points, books_read)
  - List of clubs the member belongs to
  - Clubs where the member is on the shame list

#### POST `/member` (Create)

**Required Fields:**

- `name` - The name of the member

**Optional Fields:**

- `id` - A unique identifier for the member (if not provided, an auto-incrementing ID will be used)
- `points` - Initial points for the member (defaults to 0)
- `books_read` - Initial number of books read (defaults to 0)
- `clubs` - Array of club IDs to associate the member with (must be valid club IDs)

**Response:**

- Returns the created member with all fields including club associations
- If some operations partially succeed (e.g., member created but club association failed), a `partial_success` flag and appropriate message are returned

#### PUT `/member` (Update)

**Required Fields:**

- `id` - The ID of the member to update

**Optional Fields:**

- `name` - New name for the member
- `points` - New points value
- `books_read` - New number of books read
- `clubs` - Complete array of club IDs (replaces all existing club associations)

**Behavior:**

- Updates only the specified fields
- If `clubs` is provided, it performs a complete replacement of club associations by:
  - Adding associations for clubs in the new list but not in the existing list
  - Removing associations for clubs in the existing list but not in the new list
- Returns which components were updated (member fields, club associations)
- If no changes were applied, returns a message indicating so

#### DELETE `/member`

**Required Parameters:**

- `id` - The ID of the member to delete (as a URL query parameter)

**Behavior:**

- Performs a cascading delete that removes:
  1. Shame list entries for the member
  2. Club associations
  3. The member record itself

## Client Implementation

To interact with this API from your applications, create a client that makes HTTP requests to these endpoints. Here's a basic example in Python:

```python
import os
import requests
from typing import Dict, List, Optional, Union, Any

class BookClubAPI:
    """SDK for interacting with Book Club API powered by Supabase Edge Functions."""
    
    def __init__(self, base_url: str, api_key: str):
        """
        Initialize the Book Club API client.
        
        Args:
            base_url: The base URL for the Supabase project
            api_key: The Supabase API key for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.functions_url = f"{self.base_url}/functions/v1"
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
    
    def get_club(self, club_id: str) -> Dict:
        """
        Get details for a specific club.
        
        Args:
            club_id: The ID of the club to retrieve
            
        Returns:
            Dict containing club details including members, active session, and shame list
        """
        url = f"{self.functions_url}/club"
        params = {"id": club_id}
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()
    
    def create_member(self, name: str, points: int = 0, books_read: int = 0, clubs: List[str] = None) -> Dict:
        """
        Create a new member and optionally add them to clubs.
        
        Args:
            name: Member name
            points: Initial points (default: 0)
            books_read: Initial books read count (default: 0)
            clubs: List of club IDs to add the member to
            
        Returns:
            Dict containing the created member information
        """
        url = f"{self.functions_url}/member"
        data = {
            "name": name,
            "points": points,
            "books_read": books_read,
        }
        if clubs:
            data["clubs"] = clubs
            
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json()
    
    # Add more methods for other endpoints...
```

## Local Development vs. Production

The Supabase CLI uses project references to determine which environment to target. Switch between them with:

```bash
# For local development
supabase link --project-ref local

# For production
supabase link --project-ref your-production-project-ref
```

Your applications should use environment variables to determine which API URL and key to use:

```python
# Example in Python
import os
from bookclub_api import BookClubAPI

# For local development
if os.getenv("ENV") == "dev":
    client = BookClubAPI(
        "http://localhost:54321",
        "your-local-anon-key"
    )
else:
    # For production
    client = BookClubAPI(
        "https://your-project-ref.supabase.co",
        os.getenv("SUPABASE_KEY")
    )
```

## Accessing the Supabase Dashboard

- **Local**: Visit `http://localhost:54323` to access your local Supabase Studio
- **Production**: Visit `https://app.supabase.com/project/your-project-ref`

## Security Considerations

1. **API Keys**: Never commit API keys to git. Use environment variables instead.
2. **Auth Tokens**: In documentation and examples, use placeholders like `your-token-here`.
3. **JWT Authentication**: Ensure all endpoints properly validate the JWT token.

## Troubleshooting

### Connection Issues

If you can't connect to your local Supabase:

- Check if Docker is running
- Ensure ports 54321-54326 aren't in use by other applications
- Try stopping and restarting with `supabase stop` and `supabase start`

### Database Migration Issues

If you encounter errors when pulling the schema:

- Try repairing migrations: `supabase migration repair --status reverted [migration-id]`
- As a last resort, delete migrations and pull again: `rm -rf supabase/migrations/* && supabase db pull`

### Function Errors

If your functions aren't working:

- Check the terminal output for errors
- Add `console.log()` statements to debug
- Verify the function URL and request format
- Ensure you're using the correct authorization token

## References

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase Local Development Guide](https://supabase.com/docs/guides/local-development)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
