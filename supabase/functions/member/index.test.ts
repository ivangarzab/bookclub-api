// Tests for member edge function
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  createMockRequest,
  assertCorsHeaders,
  assertErrorResponse,
  assertSuccessResponse,
} from "../_shared/test-utils.ts";
import {
  MockDatabase,
  createMockSupabaseClient,
} from "../_shared/mock-supabase.ts";
import {
  mockMember,
  mockMember2,
  mockClub,
  mockClub2,
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

Deno.test("Member - OPTIONS request returns CORS headers", async () => {
  setupTest();
  const req = createMockRequest('OPTIONS', 'http://localhost/member');
  const response = await handleRequest(req);
  assertEquals(response.status, 200);
  assertCorsHeaders(response);
});

// GET Tests
Deno.test("Member - GET returns 400 when both id and user_id missing", async () => {
  setupTest();
  const req = createMockRequest('GET', 'http://localhost/member');
  const response = await handleRequest(req);
  await assertErrorResponse(response, 400, 'Either Member ID or User ID is required');
});

Deno.test("Member - GET returns 404 when member not found by id", async () => {
  setupTest();
  const req = createMockRequest('GET', 'http://localhost/member?id=999');
  const response = await handleRequest(req);
  await assertErrorResponse(response, 404, 'Not found');
});

Deno.test("Member - GET returns member by id", async () => {
  setupTest();
  db.members.set(mockMember.id, mockMember);

  const req = createMockRequest('GET', `http://localhost/member?id=${mockMember.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.id, mockMember.id);
  assertEquals(body.name, mockMember.name);
  assertEquals(body.points, mockMember.points);
  assertEquals(body.books_read, mockMember.books_read);
  assertEquals(body.clubs, []);
  assertEquals(body.shame_clubs, []);
});

Deno.test("Member - GET returns member with clubs", async () => {
  setupTest();
  db.members.set(mockMember.id, mockMember);
  db.clubs.set(mockClub.id, mockClub);
  db.clubs.set(mockClub2.id, mockClub2);
  db.memberClubs.push({ member_id: mockMember.id, club_id: mockClub.id });
  db.memberClubs.push({ member_id: mockMember.id, club_id: mockClub2.id });

  const req = createMockRequest('GET', `http://localhost/member?id=${mockMember.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.clubs.length, 2);
});

Deno.test("Member - GET returns member with shame clubs", async () => {
  setupTest();
  db.members.set(mockMember.id, mockMember);
  db.clubs.set(mockClub.id, mockClub);
  db.shameList.push({ member_id: mockMember.id, club_id: mockClub.id });

  const req = createMockRequest('GET', `http://localhost/member?id=${mockMember.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.shame_clubs.length, 1);
  assertEquals(body.shame_clubs[0].id, mockClub.id);
});

// POST Tests
Deno.test("Member - POST creates member successfully", async () => {
  setupTest();

  const newMember = { name: "New Member", points: 10, books_read: 1 };
  const req = createMockRequest('POST', 'http://localhost/member', newMember);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.member.name, newMember.name);
  assertEquals(body.member.id, 1);
});

Deno.test("Member - POST auto-increments ID", async () => {
  setupTest();
  db.members.set(5, { id: 5, name: "Existing", points: 0, books_read: 0 });

  const newMember = { name: "New Member" };
  const req = createMockRequest('POST', 'http://localhost/member', newMember);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.member.id, 6);
});

Deno.test("Member - POST returns 400 when name missing", async () => {
  setupTest();
  const req = createMockRequest('POST', 'http://localhost/member', {});
  const response = await handleRequest(req);
  await assertErrorResponse(response, 400, 'Member name is required');
});

Deno.test("Member - POST creates member with clubs", async () => {
  setupTest();
  db.clubs.set(mockClub.id, mockClub);

  const newMember = { name: "New Member", clubs: [mockClub.id] };
  const req = createMockRequest('POST', 'http://localhost/member', newMember);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(db.memberClubs.length, 1);
});

Deno.test("Member - POST returns 400 when club doesn't exist", async () => {
  setupTest();

  const newMember = { name: "New Member", clubs: ["nonexistent"] };
  const req = createMockRequest('POST', 'http://localhost/member', newMember);
  const response = await handleRequest(req);

  const body = await assertErrorResponse(response, 400);
  assertEquals(body.partial_success, true);
});

// PUT Tests
Deno.test("Member - PUT updates member fields", async () => {
  setupTest();
  db.members.set(mockMember.id, { ...mockMember });

  const updateData = { id: mockMember.id, name: "Updated Name", points: 150 };
  const req = createMockRequest('PUT', 'http://localhost/member', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.member.name, "Updated Name");
  assertEquals(body.member.points, 150);
});

Deno.test("Member - PUT returns 404 when member not found", async () => {
  setupTest();

  const updateData = { id: 999, name: "Updated" };
  const req = createMockRequest('PUT', 'http://localhost/member', updateData);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Member not found');
});

Deno.test("Member - PUT updates clubs", async () => {
  setupTest();
  db.members.set(mockMember.id, { ...mockMember });
  db.clubs.set(mockClub.id, mockClub);
  db.clubs.set(mockClub2.id, mockClub2);

  const updateData = { id: mockMember.id, clubs: [mockClub.id, mockClub2.id] };
  const req = createMockRequest('PUT', 'http://localhost/member', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.clubs_updated, true);
  assertEquals(db.memberClubs.length, 2);
});

// DELETE Tests
Deno.test("Member - DELETE removes member successfully", async () => {
  setupTest();
  db.members.set(mockMember.id, { ...mockMember });

  const req = createMockRequest('DELETE', `http://localhost/member?id=${mockMember.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(db.members.has(mockMember.id), false);
});

Deno.test("Member - DELETE returns 404 when member not found", async () => {
  setupTest();

  const req = createMockRequest('DELETE', 'http://localhost/member?id=999');
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Member not found');
});

Deno.test("Member - DELETE cascades to associations and shame list", async () => {
  setupTest();
  db.members.set(mockMember.id, { ...mockMember });
  db.clubs.set(mockClub.id, mockClub);
  db.memberClubs.push({ member_id: mockMember.id, club_id: mockClub.id });
  db.shameList.push({ member_id: mockMember.id, club_id: mockClub.id });

  const req = createMockRequest('DELETE', `http://localhost/member?id=${mockMember.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(db.memberClubs.length, 0);
  assertEquals(db.shameList.length, 0);
});

// Additional error path tests for better coverage

Deno.test("Member - GET by user_id returns member", async () => {
  const mockMemberWithUserId = {
    id: 1,
    name: "Test User",
    points: 50,
    books_read: 3,
    user_id: "user-uuid-123",
    role: "member"
  };
  db.members.set(mockMemberWithUserId.id, mockMemberWithUserId);

  const req = createMockRequest('GET', `http://localhost/member?user_id=${mockMemberWithUserId.user_id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.id, mockMemberWithUserId.id);
  assertEquals(body.name, mockMemberWithUserId.name);
});

Deno.test("Member - GET returns member with empty clubs list", async () => {
  db.members.set(mockMember.id, mockMember);

  const req = createMockRequest('GET', `http://localhost/member?id=${mockMember.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.clubs, []);
  assertEquals(body.shame_clubs, []);
});

Deno.test("Member - PUT returns 400 when clubs is not an array", async () => {
  db.members.set(mockMember.id, mockMember);

  const data = {
    id: mockMember.id,
    clubs: "not-an-array"
  };
  const req = createMockRequest('PUT', 'http://localhost/member', data);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400);
});

Deno.test("Member - DELETE returns 400 when id missing", async () => {
  const req = createMockRequest('DELETE', 'http://localhost/member');
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400);
});

Deno.test("Member - POST creates member with user_id and role", async () => {
  setupTest();

  const newMember = {
    name: "New Member",
    user_id: "user-123",
    role: "admin",
    points: 50,
    books_read: 2
  };

  const req = createMockRequest('POST', 'http://localhost/member', newMember);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.member.name, "New Member");
  assertExists(body.member.id);
});

Deno.test("Member - PUT updates points and books_read", async () => {
  setupTest();
  db.members.set(mockMember.id, { ...mockMember });

  const updateData = {
    id: mockMember.id,
    points: 200,
    books_read: 10
  };

  const req = createMockRequest('PUT', 'http://localhost/member', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.member.points, 200);
  assertEquals(body.member.books_read, 10);
});

Deno.test("Member - GET returns 404 when member not found by user_id", async () => {
  setupTest();

  const req = createMockRequest('GET', 'http://localhost/member?user_id=nonexistent');
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Not found');
});

Deno.test("Member - GET returns member with shame clubs", async () => {
  setupTest();
  db.members.set(mockMember.id, mockMember);
  db.clubs.set(mockClub.id, mockClub);
  db.shameList.push({ member_id: mockMember.id, club_id: mockClub.id });

  const req = createMockRequest('GET', `http://localhost/member?id=${mockMember.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.shame_clubs.length, 1);
  assertEquals(body.shame_clubs[0].id, mockClub.id);
});

Deno.test("Member - POST creates member with minimal data", async () => {
  setupTest();

  const newMember = {
    name: "Minimal Member"
    // No points, books_read, user_id, or role
  };

  const req = createMockRequest('POST', 'http://localhost/member', newMember);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.member.name, "Minimal Member");
});

Deno.test("Member - PUT updates name only", async () => {
  setupTest();
  db.members.set(mockMember.id, { ...mockMember });

  const updateData = {
    id: mockMember.id,
    name: "Updated Name"
  };

  const req = createMockRequest('PUT', 'http://localhost/member', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.member.name, "Updated Name");
});

Deno.test("Member - PUT returns 400 when id missing", async () => {
  setupTest();

  const updateData = {
    name: "Updated Name"
  };

  const req = createMockRequest('PUT', 'http://localhost/member', updateData);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400, 'Member ID is required');
});

Deno.test("Member - PUT returns 200 with message when no changes", async () => {
  setupTest();
  db.members.set(mockMember.id, { ...mockMember });

  const updateData = {
    id: mockMember.id
    // No actual fields to update
  };

  const req = createMockRequest('PUT', 'http://localhost/member', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.message, "No changes to apply");
});
