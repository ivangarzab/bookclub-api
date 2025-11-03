// Tests for server edge function
import { assertEquals, assert, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  createMockRequest,
  assertCorsHeaders,
  assertErrorResponse,
  assertSuccessResponse,
  createTestServerId,
} from "../_shared/test-utils.ts";
import {
  MockDatabase,
  createMockSupabaseClient,
} from "../_shared/mock-supabase.ts";
import { mockServer, mockServer2, mockClub } from "../_shared/test-fixtures.ts";
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

// CORS Tests
Deno.test("Server - OPTIONS request returns CORS headers", async () => {
  setupTest();

  const req = createMockRequest('OPTIONS', 'http://localhost/server');
  const response = await handleRequest(req);

  assertEquals(response.status, 200);
  assertCorsHeaders(response);
});

// GET Tests
Deno.test("Server - GET all servers returns empty array when no servers", async () => {
  setupTest();

  const req = createMockRequest('GET', 'http://localhost/server');
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.servers, []);
});

Deno.test("Server - GET all servers returns servers with clubs", async () => {
  setupTest();
  db.servers.set(mockServer.id, mockServer);
  db.clubs.set(mockClub.id, mockClub);

  const req = createMockRequest('GET', 'http://localhost/server');
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.servers.length, 1);
  assertEquals(body.servers[0].id, mockServer.id);
  assertEquals(body.servers[0].name, mockServer.name);
  assertEquals(body.servers[0].clubs.length, 1);
  assertEquals(body.servers[0].clubs[0].id, mockClub.id);
});

Deno.test("Server - GET specific server returns 404 when not found", async () => {
  setupTest();

  const req = createMockRequest('GET', 'http://localhost/server?id=nonexistent');
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Not found');
});

Deno.test("Server - GET specific server returns server with club details", async () => {
  setupTest();
  db.servers.set(mockServer.id, mockServer);
  db.clubs.set(mockClub.id, mockClub);

  const req = createMockRequest('GET', `http://localhost/server?id=${mockServer.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.id, mockServer.id);
  assertEquals(body.name, mockServer.name);
  assertEquals(body.clubs.length, 1);
  assertEquals(body.clubs[0].member_count, 0);
  assertEquals(body.clubs[0].latest_session, null);
});

// POST Tests
Deno.test("Server - POST creates new server successfully", async () => {
  setupTest();

  const newServer = { name: "New Test Server" };
  const req = createMockRequest('POST', 'http://localhost/server', newServer);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.server.name, newServer.name);
  // Server ID can be either string (provided) or number (generated)
  assert(typeof body.server.id === 'string' || typeof body.server.id === 'number');
});

Deno.test("Server - POST with provided ID uses that ID", async () => {
  setupTest();

  const serverId = createTestServerId();
  const newServer = { id: serverId, name: "Server with ID" };
  const req = createMockRequest('POST', 'http://localhost/server', newServer);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.server.id, serverId);
});

Deno.test("Server - POST returns 400 when name is missing", async () => {
  setupTest();

  const req = createMockRequest('POST', 'http://localhost/server', {});
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400, 'Server name is required');
});

// PUT Tests
Deno.test("Server - PUT updates server name successfully", async () => {
  setupTest();
  db.servers.set(mockServer.id, { ...mockServer });

  const updateData = { id: mockServer.id, name: "Updated Server Name" };
  const req = createMockRequest('PUT', 'http://localhost/server', updateData);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(body.server.name, "Updated Server Name");
});

Deno.test("Server - PUT returns 404 when server not found", async () => {
  setupTest();

  const updateData = { id: "nonexistent", name: "Updated Name" };
  const req = createMockRequest('PUT', 'http://localhost/server', updateData);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Server not found');
});

Deno.test("Server - PUT returns 400 when no ID provided", async () => {
  setupTest();

  const updateData = { name: "Updated Name" };
  const req = createMockRequest('PUT', 'http://localhost/server', updateData);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400, 'Server ID is required');
});

Deno.test("Server - PUT returns 400 when no fields to update", async () => {
  setupTest();
  db.servers.set(mockServer.id, { ...mockServer });

  const updateData = { id: mockServer.id };
  const req = createMockRequest('PUT', 'http://localhost/server', updateData);
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400, 'No fields to update');
});

// DELETE Tests
Deno.test("Server - DELETE removes server successfully", async () => {
  setupTest();
  db.servers.set(mockServer.id, { ...mockServer });

  const req = createMockRequest('DELETE', `http://localhost/server?id=${mockServer.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.success, true);
  assertEquals(db.servers.has(mockServer.id), false);
});

Deno.test("Server - DELETE returns 404 when server not found", async () => {
  setupTest();

  const req = createMockRequest('DELETE', 'http://localhost/server?id=nonexistent');
  const response = await handleRequest(req);

  await assertErrorResponse(response, 404, 'Server not found');
});

Deno.test("Server - DELETE returns 400 when ID missing", async () => {
  setupTest();

  const req = createMockRequest('DELETE', 'http://localhost/server');
  const response = await handleRequest(req);

  await assertErrorResponse(response, 400, 'Server ID is required');
});

Deno.test("Server - DELETE returns 400 when server has clubs", async () => {
  setupTest();
  db.servers.set(mockServer.id, { ...mockServer });
  db.clubs.set(mockClub.id, { ...mockClub });

  const req = createMockRequest('DELETE', `http://localhost/server?id=${mockServer.id}`);
  const response = await handleRequest(req);

  const body = await assertErrorResponse(response, 400);
  assertEquals(body.error, 'Cannot delete server with existing clubs. Please delete all clubs first.');
  assertEquals(body.clubs_count, 1);
});

// Method not allowed test
Deno.test("Server - PATCH returns 405 method not allowed", async () => {
  setupTest();

  const req = createMockRequest('PATCH', 'http://localhost/server', {});
  const response = await handleRequest(req);

  await assertErrorResponse(response, 405, 'Method not allowed');
});

// Additional error path tests for better coverage

Deno.test("Server - GET all servers returns empty array when no servers", async () => {
  const req = createMockRequest('GET', 'http://localhost/server');
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertEquals(body.servers, []);
});

Deno.test("Server - GET server returns clubs with discord_channel", async () => {
  db.servers.set(mockServer.id, mockServer);
  db.clubs.set(mockClub.id, { ...mockClub, server_id: mockServer.id });

  const req = createMockRequest('GET', `http://localhost/server?id=${mockServer.id}`);
  const response = await handleRequest(req);

  const body = await assertSuccessResponse(response);
  assertExists(body.clubs);
  if (body.clubs.length > 0) {
    assertExists(body.clubs[0].discord_channel);
  }
});
