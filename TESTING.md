# Testing Guide

This document explains how to run and write tests for the Book Club API edge functions.

## Overview

The test suite provides comprehensive coverage for all four Supabase Edge Functions:
- `server` - Discord server management
- `club` - Book club CRUD operations
- `member` - Member management
- `session` - Reading session and discussion management

## Running Tests

### All Tests

```bash
# Run all tests
deno task test

# Run with file watching (auto-rerun on changes)
deno task test:watch

# Run with coverage report
deno task test:coverage
```

### Individual Function Tests

```bash
# Test server function only
deno task test:server

# Test club function only
deno task test:club

# Test member function only
deno task test:member

# Test session function only
deno task test:session
```

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
supabase/functions/
├── _shared/                    # Shared test utilities
│   ├── test-utils.ts          # Helper functions for testing
│   ├── mock-supabase.ts       # Mock Supabase client
│   └── test-fixtures.ts       # Sample test data
├── server/
│   ├── index.ts               # Server function
│   └── index.test.ts          # Server tests
├── club/
│   ├── index.ts               # Club function
│   └── index.test.ts          # Club tests
├── member/
│   ├── index.ts               # Member function
│   └── index.test.ts          # Member tests
└── session/
    ├── index.ts               # Session function
    └── index.test.ts          # Session tests
```

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
