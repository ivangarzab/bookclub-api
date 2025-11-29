// Tests for session edge function
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  createMockRequest,
  assertCorsHeaders,
  assertErrorResponse,
  assertSuccessResponse,
  createTestUUID,
} from "../_shared/test-utils.ts";
import {
  MockDatabase,
  createMockSupabaseClient,
} from "../_shared/mock-supabase.ts";
import {
  mockClub,
  mockBook,
  mockSession,
  mockDiscussion,
  mockDiscussion2,
  createSessionData,
} from "../_shared/test-fixtures.ts";
import { handler } from "./index.ts";

// Mock the Supabase client module
const db = new MockDatabase();

// Wrapper function to call the real handler with mock client
async function handleRequest(req: Request): Promise<Response> {
  const supabaseClient = createMockSupabaseClient(db);
  return handler(req, supabaseClient);
}

// Test setup and teardown
function setupTest() {
  db.clear();
}

Deno.test("Session - OPTIONS request returns CORS headers", async () => {
  setupTest();
  const req = createMockRequest('OPTIONS', 'http://localhost/session');
  const response = await handleRequest(req);
  assertEquals(response.status, 200);
  assertCorsHeaders(response);
});

// GET Tests
Deno.test("Session - GET returns 400 when session ID missing", async () => {
  setupTest();
  const req = createMockRequest('GET', 'http://localhost/session');
  const response = await handleRequest(req);
  await assertErrorResponse(response, 400, 'Session ID is required');
});

Deno.test("Session - GET returns 404 when session not found", async () => {
  setupTest();
  const req = createMockRequest('GET', 'http://localhost/session?id=nonexistent');
  const response = await handleRequest(req);
  await assertErrorResponse(response, 404, 'Not found');
});

Deno.test("Session - GET returns session with details", async () => {
  setupTest();
  db.clubs.set(mockClub.id, mockClub);
  db.books.set(mockBook.id, mockBook);
  db.sessions.set(mockSession.id, mockSession);
  db.discussions.set(mockDiscussion.id, mockDiscussion);

  const req = createMockRequest('GET', `http://localhost/session?id=${mockSession.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.id, mockSession.id);
  assertEquals(body.club.id, mockClub.id);
  assertEquals(body.book.title, mockBook.title);
  assertEquals(body.discussions.length, 1);
  assertEquals(body.discussions[0].id, mockDiscussion.id);
});

// POST Tests
Deno.test("Session - POST creates session successfully", async () => {
  setupTest();
  db.clubs.set(mockClub.id, mockClub);

  const sessionData = createSessionData(mockClub.id);
  const req = createMockRequest('POST', 'http://localhost/session', sessionData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.session.club.id, mockClub.id);
  assertEquals(body.session.book.title, sessionData.book.title);
  assertEquals(body.session.discussions.length, 1);
});

Deno.test("Session - POST returns 400 when club_id missing", async () => {
  setupTest();
  const req = createMockRequest('POST', 'http://localhost/session', { book: { title: "Test", author: "Author" } });
  const response = await handleRequest(req);
  await assertErrorResponse(response, 400, 'Club ID is required');
});

Deno.test("Session - POST returns 400 when book missing", async () => {
  setupTest();
  const req = createMockRequest('POST', 'http://localhost/session', { club_id: mockClub.id });
  const response = await handleRequest(req);
  await assertErrorResponse(response, 400, 'Book information is required');
});

Deno.test("Session - POST returns 400 when book title missing", async () => {
  setupTest();
  const req = createMockRequest('POST', 'http://localhost/session', { club_id: mockClub.id, book: { author: "Author" } });
  const response = await handleRequest(req);
  await assertErrorResponse(response, 400, 'Book title and author are required');
});

Deno.test("Session - POST returns 404 when club not found", async () => {
  setupTest();

  const sessionData = createSessionData("nonexistent");
  const req = createMockRequest('POST', 'http://localhost/session', sessionData);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Club not found');
});

// PUT Tests
Deno.test("Session - PUT updates session due_date", async () => {
  setupTest();
  db.clubs.set(mockClub.id, mockClub);
  db.books.set(mockBook.id, mockBook);
  db.sessions.set(mockSession.id, { ...mockSession });

  const updateData = { id: mockSession.id, due_date: "2026-01-01" };
  const req = createMockRequest('PUT', 'http://localhost/session', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.updates.session, true);
});

Deno.test("Session - PUT returns 404 when session not found", async () => {
  setupTest();

  const updateData = { id: "nonexistent", due_date: "2026-01-01" };
  const req = createMockRequest('PUT', 'http://localhost/session', updateData);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Session not found');
});

Deno.test("Session - PUT updates book information", async () => {
  setupTest();
  db.clubs.set(mockClub.id, mockClub);
  db.books.set(mockBook.id, { ...mockBook });
  db.sessions.set(mockSession.id, mockSession);

  const updateData = { id: mockSession.id, book: { title: "Updated Title" } };
  const req = createMockRequest('PUT', 'http://localhost/session', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.updates.book, true);
});

Deno.test("Session - PUT updates discussions", async () => {
  setupTest();
  db.clubs.set(mockClub.id, mockClub);
  db.books.set(mockBook.id, mockBook);
  db.sessions.set(mockSession.id, mockSession);
  db.discussions.set(mockDiscussion.id, mockDiscussion);

  const updateData = {
    id: mockSession.id,
    discussions: [
      { id: mockDiscussion.id, title: "Updated Title" },
      { title: "New Discussion", date: "2025-12-01" }
    ]
  };

  const req = createMockRequest('PUT', 'http://localhost/session', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.updates.discussions, true);
});

// DELETE Tests
Deno.test("Session - DELETE removes session successfully", async () => {
  setupTest();
  db.clubs.set(mockClub.id, mockClub);
  db.books.set(mockBook.id, mockBook);
  db.sessions.set(mockSession.id, { ...mockSession });

  const req = createMockRequest('DELETE', `http://localhost/session?id=${mockSession.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(db.sessions.has(mockSession.id), false);
  assertEquals(db.books.has(mockBook.id), false);
});

Deno.test("Session - DELETE returns 404 when session not found", async () => {
  setupTest();

  const req = createMockRequest('DELETE', 'http://localhost/session?id=nonexistent');
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Session not found');
});

Deno.test("Session - DELETE cascades to discussions", async () => {
  setupTest();
  db.clubs.set(mockClub.id, mockClub);
  db.books.set(mockBook.id, mockBook);
  db.sessions.set(mockSession.id, { ...mockSession });
  db.discussions.set(mockDiscussion.id, mockDiscussion);
  db.discussions.set(mockDiscussion2.id, mockDiscussion2);

  const req = createMockRequest('DELETE', `http://localhost/session?id=${mockSession.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(db.discussions.has(mockDiscussion.id), false);
  assertEquals(db.discussions.has(mockDiscussion2.id), false);
});

// Additional error path tests for better coverage

Deno.test("Session - PUT returns 400 when session_id missing", async () => {
  const data = {
    due_date: "2025-12-31"
  };
  const req = createMockRequest('PUT', 'http://localhost/session', data);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400);
});

Deno.test("Session - DELETE returns 400 when session_id missing", async () => {
  const req = createMockRequest('DELETE', 'http://localhost/session');
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400);
});

Deno.test("Session - GET returns club with discord_channel", async () => {
  db.sessions.set(mockSession.id, mockSession);
  db.clubs.set(mockClub.id, mockClub);
  db.books.set(mockBook.id, mockBook);

  const req = createMockRequest('GET', `http://localhost/session?id=${mockSession.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertExists(body.club);
  assertExists(body.club.discord_channel);
});

Deno.test("Session - POST creates session with discussions", async () => {
  db.clubs.set(mockClub.id, mockClub);

  const data = createSessionData();
  const req = createMockRequest('POST', 'http://localhost/session', data);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertExists(body.session);
});

Deno.test("Session - POST creates session with provided session ID", async () => {
  setupTest();
  db.clubs.set(mockClub.id, mockClub);

  const customId = createTestUUID();
  const sessionData = {
    ...createSessionData(mockClub.id),
    id: customId
  };

  const req = createMockRequest('POST', 'http://localhost/session', sessionData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.session.id, customId);
});

Deno.test("Session - PUT updates book author only", async () => {
  setupTest();
  db.clubs.set(mockClub.id, mockClub);
  db.books.set(mockBook.id, { ...mockBook });
  db.sessions.set(mockSession.id, mockSession);

  const updateData = {
    id: mockSession.id,
    book: { author: "Updated Author" }
  };

  const req = createMockRequest('PUT', 'http://localhost/session', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.updates.book, true);
});

Deno.test("Session - PUT returns message when no changes", async () => {
  setupTest();
  db.clubs.set(mockClub.id, mockClub);
  db.books.set(mockBook.id, { ...mockBook });
  db.sessions.set(mockSession.id, mockSession);

  const updateData = {
    id: mockSession.id
    // No actual fields to update
  };

  const req = createMockRequest('PUT', 'http://localhost/session', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.message, "No changes to apply");
});
