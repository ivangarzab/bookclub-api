# Book Club API

[![Tests](https://github.com/ivangarzab/bookclub-api/actions/workflows/test.yml/badge.svg)](https://github.com/ivangarzab/bookclub-api/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/ivangarzab/bookclub-api/branch/main/graph/badge.svg)](https://codecov.io/gh/ivangarzab/bookclub-api)

Supabase Edge Functions API for managing book clubs across multiple Discord servers with authentication integration.

## Quick Start

```bash
# Install Supabase CLI
npm install -g supabase

# Clone and setup
git clone https://github.com/ivangarzab/bookclub-api.git
cd bookclub-api
supabase init

# Start local environment
supabase start

# Link to production and pull schema
supabase link --project-ref your-production-project-ref
supabase db pull
supabase db reset

# Serve functions locally
supabase functions serve
```

Your local API is now running at `http://localhost:54321` 🚀

## Documentation

### API Reference
- [Club Endpoint](supabase/functions/club/README.md) - Manage book clubs
- [Member Endpoint](supabase/functions/member/README.md) - Manage members
- [Session Endpoint](supabase/functions/session/README.md) - Manage reading sessions
- [Server Endpoint](supabase/functions/server/README.md) - Manage Discord servers

### Technical Documentation
- [Database Schema](supabase/migrations/DATABASE_SCHEMA.md) - Complete schema reference and migration guide
- [Testing Guide](TESTING.md) - Comprehensive testing documentation and best practices
- [Architecture Overview](docs/ARCHITECTURE.md) - System design and multi-server architecture *(coming soon)*
- [Development Guide](docs/DEVELOPMENT_GUIDE.md) - Detailed workflow and troubleshooting *(coming soon)*

## Key Features

**Multi-Server Support**
- Single bot instance serves multiple Discord servers
- Complete data isolation between servers
- Server-scoped clubs and channels

**Authentication Integration**
- Links Discord members with Supabase Auth users
- Unified identity across bot and web applications
- Role-based access control

**Flexible API**
- RESTful endpoints with full CRUD operations
- Search by Discord channel or internal IDs
- Comprehensive error handling and validation

## Project Structure

```
bookclub-api/
├── supabase/
│   ├── functions/              # Edge Functions (API endpoints)
│   │   ├── _shared/           # Shared test utilities
│   │   ├── club/              # Club management + tests
│   │   ├── member/            # Member management + tests
│   │   ├── session/           # Session management + tests
│   │   └── server/            # Server registration + tests
│   └── migrations/            # Database migrations
│       └── DATABASE_SCHEMA.md # Schema documentation
├── deno.jsonc                 # Deno configuration & test tasks
├── TESTING.md                 # Testing guide
├── seed.sql                   # Sample data for local dev
└── local-env-refresh.sh       # Quick environment reset script
```

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) - For local Supabase
- [Supabase CLI](https://supabase.com/docs/guides/cli) - Manage local environment
- [Deno](https://deno.land/) - For running edge functions and tests
- [PostgreSQL Client](https://www.postgresql.org/download/) - Optional, for direct DB access

## Common Commands

```bash
# Development
supabase start                 # Start local Supabase
supabase status                # Check status and get credentials
supabase functions serve       # Serve functions locally
supabase db reset              # Reset database with migrations

# Testing
deno task test                 # Run all tests
deno task test:watch           # Run tests in watch mode
deno task test:club            # Test specific function
deno task test:coverage        # Generate coverage report

# Database
supabase db pull               # Pull schema from production
supabase db push               # Push migrations to production
supabase migration new <name>  # Create new migration

# Deployment
supabase functions deploy      # Deploy all functions
supabase functions deploy club # Deploy specific function
```

## Environment URLs

**Local Development**
- API: `http://localhost:54321/functions/v1`
- Studio: `http://localhost:54323`
- Database: `postgresql://postgres:postgres@localhost:54322/postgres`

**Production**
- API: `https://your-project-ref.supabase.co/functions/v1`
- Studio: `https://app.supabase.com/project/your-project-ref`

## Need Help?

- **API Issues?** Check the endpoint-specific READMEs in `supabase/functions/`
- **Database Issues?** See [DATABASE_SCHEMA.md](supabase/migrations/DATABASE_SCHEMA.md)
- **Setup Issues?** Review the [Supabase Local Development Guide](https://supabase.com/docs/guides/local-development)

## Contributing

1. Create a new branch for your changes
2. Update relevant documentation alongside code changes
3. Write tests for new functionality
4. Run the test suite: `deno task test`
5. Test locally with `supabase db reset` and `supabase functions serve`
6. Submit PR with clear description

## License

[Add your license here]