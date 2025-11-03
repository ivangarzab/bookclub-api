// Tests for club edge function
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  createMockRequest,
  assertCorsHeaders,
  assertErrorResponse,
  assertSuccessResponse,
  createTestUUID,
  parseResponse,
} from "../_shared/test-utils.ts";
import {
  MockDatabase,
  createMockSupabaseClient,
} from "../_shared/mock-supabase.ts";
import {
  mockServer,
  mockClub,
  mockMember,
  mockMember2,
  mockBook,
  mockSession,
  mockDiscussion,
  createFullClubData,
  TEST_SERVER_ID,
} from "../_shared/test-fixtures.ts";
import { handler } from "./index.ts";

// Mock database
const db = new MockDatabase();

// Wrapper function to call the real handler with mock client
async function handleRequest(req: Request): Promise<Response> {
  const supabaseClient = createMockSupabaseClient(db);
  return handler(req, supabaseClient);
}

// Test setup
function setupTest() {
  db.clear();
}

// CORS Tests
Deno.test("Club - OPTIONS request returns CORS headers", async () => {
  setupTest();

  const req = createMockRequest('OPTIONS', 'http://localhost/club');
  const response = await handleRequest(req);

  assertEquals(response.status, 200);
  assertCorsHeaders(response);
});

// GET Tests
Deno.test("Club - GET returns 400 when club ID missing", async () => {
  setupTest();

  const req = createMockRequest('GET', 'http://localhost/club');
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400, 'Club ID is required');
});

Deno.test("Club - GET returns 400 when server ID missing", async () => {
  setupTest();

  const req = createMockRequest('GET', 'http://localhost/club?id=club-1');
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400, 'Server ID is required');
});

Deno.test("Club - GET returns 404 when server not found", async () => {
  setupTest();

  const req = createMockRequest('GET', `http://localhost/club?id=club-1&server_id=nonexistent`);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Server not found or not registered');
});

Deno.test("Club - GET returns 404 when club not found", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);

  const req = createMockRequest('GET', `http://localhost/club?id=nonexistent&server_id=${TEST_SERVER_ID}`);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Not found');
});

Deno.test("Club - GET returns club with empty members and sessions", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);
  db.clubs.set(mockClub.id, mockClub);

  const req = createMockRequest('GET', `http://localhost/club?id=${mockClub.id}&server_id=${TEST_SERVER_ID}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.id, mockClub.id);
  assertEquals(body.name, mockClub.name);
  assertEquals(body.discord_channel, mockClub.discord_channel);
  assertEquals(body.members, []);
  assertEquals(body.active_session, null);
  assertEquals(body.past_sessions, []);
  assertEquals(body.shame_list, []);
});

Deno.test("Club - GET by discord_channel returns club", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);
  db.clubs.set(mockClub.id, mockClub);

  const req = createMockRequest('GET', `http://localhost/club?discord_channel=${mockClub.discord_channel}&server_id=${TEST_SERVER_ID}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.id, mockClub.id);
  assertEquals(body.name, mockClub.name);
});

Deno.test("Club - GET by discord_channel returns 400 when server_id missing", async () => {
  setupTest();

  const req = createMockRequest('GET', `http://localhost/club?discord_channel=${mockClub.discord_channel}`);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400, 'Server ID is required when searching by discord_channel');
});

Deno.test("Club - GET returns club with members", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);
  db.clubs.set(mockClub.id, mockClub);
  db.members.set(mockMember.id, mockMember);
  db.memberClubs.push({ member_id: mockMember.id, club_id: mockClub.id });

  const req = createMockRequest('GET', `http://localhost/club?id=${mockClub.id}&server_id=${TEST_SERVER_ID}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.members.length, 1);
  assertEquals(body.members[0].id, mockMember.id);
  assertEquals(body.members[0].name, mockMember.name);
});

Deno.test("Club - GET returns club with active session", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);
  db.clubs.set(mockClub.id, mockClub);
  db.books.set(mockBook.id, mockBook);
  db.sessions.set(mockSession.id, mockSession);
  db.discussions.set(mockDiscussion.id, mockDiscussion);

  const req = createMockRequest('GET', `http://localhost/club?id=${mockClub.id}&server_id=${TEST_SERVER_ID}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertExists(body.active_session);
  assertEquals(body.active_session.id, mockSession.id);
  assertEquals(body.active_session.book.title, mockBook.title);
  assertEquals(body.active_session.discussions.length, 1);
});

// POST Tests
Deno.test("Club - POST creates club successfully", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);

  const newClub = {
    name: "New Club",
    discord_channel: "new-club",
    server_id: TEST_SERVER_ID
  };

  const req = createMockRequest('POST', 'http://localhost/club', newClub);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.club.name, newClub.name);
  assertEquals(body.club.discord_channel, newClub.discord_channel);
});

Deno.test("Club - POST returns 400 when name missing", async () => {
  setupTest();

  const req = createMockRequest('POST', 'http://localhost/club', { server_id: TEST_SERVER_ID });
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400, 'Club name is required');
});

Deno.test("Club - POST returns 400 when server_id missing", async () => {
  setupTest();

  const req = createMockRequest('POST', 'http://localhost/club', { name: "Test" });
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400, 'Server ID is required');
});

Deno.test("Club - POST returns 404 when server not found", async () => {
  setupTest();

  const newClub = {
    name: "New Club",
    server_id: "nonexistent"
  };

  const req = createMockRequest('POST', 'http://localhost/club', newClub);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Server not found or not registered');
});

Deno.test("Club - POST creates club with full data", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);

  const fullClub = createFullClubData(TEST_SERVER_ID);
  const req = createMockRequest('POST', 'http://localhost/club', fullClub);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.club.name, fullClub.name);

  // Verify data was created
  assertEquals(db.members.size, 2);
  assertEquals(db.memberClubs.length, 2);
});

// PUT Tests
Deno.test("Club - PUT updates club name", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);
  db.clubs.set(mockClub.id, { ...mockClub });

  const updateData = {
    id: mockClub.id,
    server_id: TEST_SERVER_ID,
    name: "Updated Club Name"
  };

  const req = createMockRequest('PUT', 'http://localhost/club', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.club.name, "Updated Club Name");
});

Deno.test("Club - PUT returns 400 when id missing", async () => {
  setupTest();

  const req = createMockRequest('PUT', 'http://localhost/club', { server_id: TEST_SERVER_ID });
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400, 'Club ID is required');
});

Deno.test("Club - PUT returns 404 when club not found", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);

  const updateData = {
    id: "nonexistent",
    server_id: TEST_SERVER_ID,
    name: "Updated"
  };

  const req = createMockRequest('PUT', 'http://localhost/club', updateData);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Club not found in this server');
});

Deno.test("Club - PUT updates shame list", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);
  db.clubs.set(mockClub.id, { ...mockClub });
  db.members.set(mockMember.id, mockMember);
  db.members.set(mockMember2.id, mockMember2);

  const updateData = {
    id: mockClub.id,
    server_id: TEST_SERVER_ID,
    shame_list: [mockMember.id, mockMember2.id]
  };

  const req = createMockRequest('PUT', 'http://localhost/club', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.shame_list_updated, true);
  assertEquals(db.shameList.length, 2);
});

// DELETE Tests
Deno.test("Club - DELETE removes club successfully", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);
  db.clubs.set(mockClub.id, { ...mockClub });

  const req = createMockRequest('DELETE', `http://localhost/club?id=${mockClub.id}&server_id=${TEST_SERVER_ID}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(db.clubs.has(mockClub.id), false);
});

Deno.test("Club - DELETE returns 400 when id missing", async () => {
  setupTest();

  const req = createMockRequest('DELETE', `http://localhost/club?server_id=${TEST_SERVER_ID}`);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400, 'Club ID is required');
});

Deno.test("Club - DELETE cascades to sessions and discussions", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);
  db.clubs.set(mockClub.id, { ...mockClub });
  db.sessions.set(mockSession.id, mockSession);
  db.discussions.set(mockDiscussion.id, mockDiscussion);
  db.memberClubs.push({ member_id: mockMember.id, club_id: mockClub.id });
  db.shameList.push({ member_id: mockMember.id, club_id: mockClub.id });

  const req = createMockRequest('DELETE', `http://localhost/club?id=${mockClub.id}&server_id=${TEST_SERVER_ID}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(db.clubs.has(mockClub.id), false);
  assertEquals(db.sessions.has(mockSession.id), false);
  assertEquals(db.discussions.has(mockDiscussion.id), false);
  assertEquals(db.memberClubs.length, 0);
  assertEquals(db.shameList.length, 0);
});

// Additional error path tests for better coverage

Deno.test("Club - GET returns club with discord_channel as string", async () => {
  db.clubs.set(mockClub.id, mockClub);
  db.servers.set(mockClub.server_id, { id: mockClub.server_id, name: "Test Server" });

  const req = createMockRequest('GET', `http://localhost/club?id=${mockClub.id}&server_id=${mockClub.server_id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertExists(body.discord_channel);
  assertEquals(typeof body.discord_channel, 'string');
});

Deno.test("Club - GET handles empty shame list", async () => {
  db.clubs.set(mockClub.id, mockClub);
  db.servers.set(mockClub.server_id, { id: mockClub.server_id, name: "Test Server" });

  const req = createMockRequest('GET', `http://localhost/club?id=${mockClub.id}&server_id=${mockClub.server_id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.shame_list, []);
});

Deno.test("Club - PUT returns 400 when shame_list is not an array", async () => {
  db.clubs.set(mockClub.id, mockClub);
  db.servers.set(mockClub.server_id, { id: mockClub.server_id, name: "Test Server" });

  const data = {
    id: mockClub.id,
    server_id: mockClub.server_id,
    shame_list: "not-an-array"
  };
  const req = createMockRequest('PUT', 'http://localhost/club', data);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400);
});

Deno.test("Club - DELETE returns 400 when server_id missing", async () => {
  const req = createMockRequest('DELETE', `http://localhost/club?id=${mockClub.id}`);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400);
});

Deno.test("Club - POST creates club without discord_channel", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);

  const newClub = {
    name: "Club Without Channel",
    server_id: TEST_SERVER_ID
    // No discord_channel provided
  };

  const req = createMockRequest('POST', 'http://localhost/club', newClub);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.club.name, newClub.name);
  assertEquals(body.club.discord_channel, null);
});

Deno.test("Club - PUT updates discord_channel", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);
  db.clubs.set(mockClub.id, { ...mockClub });

  const updateData = {
    id: mockClub.id,
    server_id: TEST_SERVER_ID,
    discord_channel: "updated-channel"
  };

  const req = createMockRequest('PUT', 'http://localhost/club', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.club.discord_channel, "updated-channel");
});

Deno.test("Club - GET by discord_channel returns 404 when not found", async () => {
  setupTest();
  db.servers.set(TEST_SERVER_ID, mockServer);

  const req = createMockRequest('GET', `http://localhost/club?discord_channel=nonexistent&server_id=${TEST_SERVER_ID}`);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Not found');
});
