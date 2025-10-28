# Testing Guide

This document explains how to run and write tests for the Book Club API edge functions.

## Overview

The project includes **two types of tests**:

### 1. **Unit/Mock Tests** (Fast, No Dependencies)
- Located in `supabase/functions/*/index.test.ts`
- Use mock Supabase client (in-memory database)
- Run in **~120ms** for 72 tests
- Perfect for **quick feedback during development**
- No local Supabase required

### 2. **Integration Tests** (Real Database)
- Located in `tests/integration/*.test.ts`
- Hit real Supabase Edge Functions and database
- Require **local Supabase running**
- Perfect for **pre-commit validation**
- Catch real-world issues

All tests cover four Supabase Edge Functions:
- `server` - Discord server management
- `club` - Book club CRUD operations
- `member` - Member management
- `session` - Reading session and discussion management

## Running Tests

### Quick Unit/Mock Tests (Development)

```bash
# Run all unit tests (fast, no dependencies)
deno task test

# Run with file watching (auto-rerun on changes)
deno task test:watch

# Run with coverage report
deno task test:coverage

# Test individual functions
deno task test:server
deno task test:club
deno task test:member
deno task test:session
```

### Integration Tests (Pre-Commit)

**⚠️ Requires local Supabase running:** `supabase start`

```bash
# Run all integration tests
deno task test:integration

# Test individual functions
deno task test:integration:server
deno task test:integration:club
deno task test:integration:member
deno task test:integration:session

# Run BOTH unit and integration tests
deno task test:all
```

### Setup for Integration Tests

```bash
# 1. Start local Supabase
supabase start

# 2. Ensure functions are deployed locally
supabase functions serve

# 3. Run integration tests (in another terminal)
deno task test:integration
```

### Running Tests in VS Code

You can run tests directly from VS Code using the Command Palette:

1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Tasks: Run Task"
3. Select one of the test tasks:

**Unit Test Tasks:**
- `Test: All Functions` - Run all 72 unit tests (~120ms)
- `Test: Watch Mode` - Auto-rerun tests on file changes
- `Test: Server Function` - Run server unit tests only
- `Test: Club Function` - Run club unit tests only
- `Test: Member Function` - Run member unit tests only
- `Test: Session Function` - Run session unit tests only
- `Test: Coverage Report` - Generate coverage report

**Integration Test Tasks:**
- `Test: All Integration Tests` - Run all 30 integration tests (~2s)
- `Test: Integration - Server` - Run server integration tests only
- `Test: Integration - Club` - Run club integration tests only
- `Test: Integration - Member` - Run member integration tests only
- `Test: Integration - Session` - Run session integration tests only
- `Test: All (Unit + Integration)` - Run all 102 tests

**Note:** Integration tests require local Supabase to be running (`supabase start` and `supabase functions serve`).

### Direct Deno Commands

```bash
# Run all tests with verbose output
deno test --allow-net --allow-env supabase/functions/ -v

# Run specific test file
deno test --allow-net --allow-env supabase/functions/club/index.test.ts

# Run tests matching a pattern
deno test --allow-net --allow-env --filter "Club - POST" supabase/functions/
```

## Test Structure

### Directory Layout

```
bookclub-api/
├── supabase/functions/         # Unit/Mock tests
│   ├── _shared/
│   │   ├── test-utils.ts      # Mock test helpers
│   │   ├── mock-supabase.ts   # Mock Supabase client
│   │   └── test-fixtures.ts   # Mock test data
│   ├── server/
│   │   ├── index.ts
│   │   └── index.test.ts      # 17 unit tests
│   ├── club/
│   │   ├── index.ts
│   │   └── index.test.ts      # 22 unit tests
│   ├── member/
│   │   ├── index.ts
│   │   └── index.test.ts      # 17 unit tests
│   └── session/
│       ├── index.ts
│       └── index.test.ts      # 16 unit tests
└── tests/
    ├── integration/            # Integration tests
    │   ├── setup.ts           # Integration test utilities
    │   ├── server.test.ts     # 7 integration tests
    │   ├── club.test.ts       # 8 integration tests
    │   ├── member.test.ts     # 9 integration tests
    │   └── session.test.ts    # 9 integration tests
    └── fixtures/
        └── test-data.sql      # Test database seed data
```

**Total Test Coverage:**
- **72 unit/mock tests** - Run in ~120ms, no dependencies
- **33 integration tests** - Real database, requires local Supabase

### Test Categories

Each edge function test suite covers:

1. **CORS Tests** - Validates CORS headers on OPTIONS requests
2. **GET Tests** - Read operations and query parameters
3. **POST Tests** - Create operations and validation
4. **PUT Tests** - Update operations
5. **DELETE Tests** - Delete operations and cascading
6. **Error Handling** - Missing parameters, invalid data, not found scenarios

## Test Utilities

### Available Helpers

Located in `supabase/functions/_shared/test-utils.ts`:

```typescript
// Create mock HTTP requests
createMockRequest(method: string, url: string, body?: any, headers?: Record<string, string>)

// Parse response body
parseResponse(response: Response): Promise<any>

// Assert response status
assertResponseStatus(response: Response, expectedStatus: number): Promise<any>

// Assert CORS headers present
assertCorsHeaders(response: Response)

// Assert successful response
assertSuccessResponse(response: Response, expectedData?: any): Promise<any>

// Assert error response
assertErrorResponse(response: Response, expectedStatus: number, expectedErrorMessage?: string): Promise<any>

// Generate test IDs
createTestServerId(): string
createTestUUID(): string
```

### Mock Database

The `MockDatabase` class (in `mock-supabase.ts`) provides an in-memory database for testing:

```typescript
const db = new MockDatabase();

// Clear all data between tests
db.clear();

// Access mock tables
db.servers
db.clubs
db.members
db.sessions
db.books
db.discussions
db.memberClubs
db.shameList
```

### Test Fixtures

Pre-defined test data is available in `test-fixtures.ts`:

```typescript
import {
  mockServer,
  mockClub,
  mockMember,
  mockBook,
  mockSession,
  mockDiscussion,
  createFullClubData,
  createSessionData,
  createMemberData
} from "../_shared/test-fixtures.ts";
```

## Writing Tests

### Basic Test Template

```typescript
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  createMockRequest,
  assertSuccessResponse,
  assertErrorResponse,
} from "../_shared/test-utils.ts";
import { MockDatabase, createMockSupabaseClient } from "../_shared/mock-supabase.ts";

const db = new MockDatabase();

function setupTest() {
  db.clear();
}

Deno.test("MyFunction - should do something", async () => {
  setupTest();

  // Arrange: Set up test data
  db.servers.set("test-id", { id: "test-id", name: "Test Server" });

  // Act: Make request
  const req = createMockRequest('GET', 'http://localhost/myfunction?id=test-id');
  const response = await handleRequest(req);

  // Assert: Verify response
  const body = await assertSuccessResponse(response);
  assertEquals(body.name, "Test Server");
});
```

### Testing Different HTTP Methods

```typescript
// GET request
const req = createMockRequest('GET', 'http://localhost/endpoint?id=123');

// POST request with body
const req = createMockRequest('POST', 'http://localhost/endpoint', {
  name: "Test",
  value: 42
});

// PUT request with body
const req = createMockRequest('PUT', 'http://localhost/endpoint', {
  id: "123",
  name: "Updated"
});

// DELETE request
const req = createMockRequest('DELETE', 'http://localhost/endpoint?id=123');

// OPTIONS (CORS preflight)
const req = createMockRequest('OPTIONS', 'http://localhost/endpoint');
```

### Asserting Responses

```typescript
// Assert successful response (200)
const body = await assertSuccessResponse(response);
assertEquals(body.success, true);

// Assert error response
await assertErrorResponse(response, 404, 'Not found');

// Assert specific status
const body = await assertResponseStatus(response, 201);

// Assert CORS headers
assertCorsHeaders(response);
```

## Test Coverage

To view test coverage:

```bash
# Generate coverage
deno task test:coverage

# View coverage report
deno coverage coverage
```

## Best Practices

1. **Always clear the database** - Call `setupTest()` at the start of each test
2. **Test both success and failure cases** - Include validation errors, not found scenarios
3. **Use descriptive test names** - Format: "Function - Method - should do what"
4. **Test edge cases** - Empty arrays, null values, missing parameters
5. **Verify cascading deletes** - Ensure related data is properly cleaned up
6. **Check CORS headers** - All endpoints should return proper CORS headers

## Troubleshooting

### Tests failing with "Module not found"

Make sure you're running tests from the project root directory.

### Permission errors

Ensure you're using `--allow-net` and `--allow-env` flags:

```bash
deno test --allow-net --allow-env
```

### Mock database state leaking between tests

Always call `setupTest()` or `db.clear()` at the start of each test.

### TypeScript errors in test files

Check that your `deno.jsonc` is properly configured and you're using compatible versions of dependencies.

## CI/CD Integration

To run tests in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: deno task test
```

## Additional Resources

- [Deno Testing Documentation](https://deno.land/manual/testing)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [HTTP Testing Best Practices](https://deno.land/manual/testing/mocking)
