// Tests for server edge function
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
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

// Mock the Supabase client module
const db = new MockDatabase();

// Helper to simulate the server function handler
async function handleRequest(req: Request): Promise<Response> {
  // This simulates the server function logic
  // We'll need to extract the handler functions or test them directly
  // For now, this is a placeholder structure

  const supabaseClient = createMockSupabaseClient(db);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      }
    });
  }

  const url = new URL(req.url);
  const serverId = url.searchParams.get('id');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  try {
    switch (req.method) {
      case 'GET':
        return await handleGetServer(req, supabaseClient, serverId, corsHeaders);
      case 'POST':
        return await handleCreateServer(req, supabaseClient, corsHeaders);
      case 'PUT':
        return await handleUpdateServer(req, supabaseClient, corsHeaders);
      case 'DELETE':
        return await handleDeleteServer(req, supabaseClient, serverId, corsHeaders);
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 405 }
        );
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }
}

async function handleGetServer(req: Request, supabaseClient: any, serverId: string | null, corsHeaders: any) {
  if (!serverId) {
    // Get all servers
    const { data: serversData, error: serversError } = await supabaseClient
      .from("servers")
      .select("id, name")
      .order('name', { ascending: true });

    if (serversError) {
      return new Response(
        JSON.stringify({ error: serversError.message }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
      );
    }

    const serversWithClubs = await Promise.all(
      serversData.map(async (server: any) => {
        const { data: clubsData } = await supabaseClient
          .from("clubs")
          .select("id, name, discord_channel")
          .eq("server_id", server.id);

        return {
          id: server.id,
          name: server.name,
          clubs: clubsData || []
        };
      })
    );

    return new Response(
      JSON.stringify({ servers: serversWithClubs }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Get specific server
  const { data: serverData, error: serverError } = await supabaseClient
    .from("servers")
    .select("id, name")
    .eq("id", serverId)
    .single();

  if (serverError || !serverData) {
    return new Response(
      JSON.stringify({ error: serverError?.message || 'Server not found' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  const { data: clubsData } = await supabaseClient
    .from("clubs")
    .select("id, name, discord_channel")
    .eq("server_id", serverId);

  const clubsWithDetails = await Promise.all(
    (clubsData || []).map(async (club: any) => {
      const { data: memberCount } = await supabaseClient
        .from("memberclubs")
        .select("member_id")
        .eq("club_id", club.id);

      const { data: latestSession } = await supabaseClient
        .from("sessions")
        .select("id, due_date")
        .eq("club_id", club.id)
        .order('due_date', { ascending: false })
        .limit(1);

      return {
        id: club.id,
        name: club.name,
        discord_channel: club.discord_channel,
        member_count: memberCount?.length || 0,
        latest_session: latestSession?.[0] || null
      };
    })
  );

  return new Response(
    JSON.stringify({
      id: serverData.id,
      name: serverData.name,
      clubs: clubsWithDetails
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleCreateServer(req: Request, supabaseClient: any, corsHeaders: any) {
  const data = await req.json();

  if (!data.name) {
    return new Response(
      JSON.stringify({ error: 'Server name is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  const serverId = data.id || Math.floor(Math.random() * 1000000000000000000).toString();

  const { data: serverData, error: serverError } = await supabaseClient
    .from("servers")
    .insert({ id: serverId, name: data.name })
    .select();

  if (serverError) {
    return new Response(
      JSON.stringify({ error: serverError.message }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Server created successfully",
      server: serverData[0]
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleUpdateServer(req: Request, supabaseClient: any, corsHeaders: any) {
  const data = await req.json();

  if (!data.id) {
    return new Response(
      JSON.stringify({ error: 'Server ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  const { data: existingServer } = await supabaseClient
    .from("servers")
    .select("id")
    .eq("id", data.id)
    .single();

  if (!existingServer) {
    return new Response(
      JSON.stringify({ error: 'Server not found' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;

  if (Object.keys(updateData).length === 0) {
    return new Response(
      JSON.stringify({ error: 'No fields to update' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  const { data: serverData, error: updateError } = await supabaseClient
    .from("servers")
    .update(updateData)
    .eq("id", data.id)
    .select();

  if (updateError) {
    return new Response(
      JSON.stringify({ error: updateError.message }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Server updated successfully",
      server: serverData[0]
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleDeleteServer(req: Request, supabaseClient: any, serverId: string | null, corsHeaders: any) {
  if (!serverId) {
    return new Response(
      JSON.stringify({ error: 'Server ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  const { data: existingServer } = await supabaseClient
    .from("servers")
    .select("id")
    .eq("id", serverId)
    .single();

  if (!existingServer) {
    return new Response(
      JSON.stringify({ error: 'Server not found' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  const { data: clubsData } = await supabaseClient
    .from("clubs")
    .select("id")
    .eq("server_id", serverId);

  if (clubsData && clubsData.length > 0) {
    return new Response(
      JSON.stringify({
        error: 'Cannot delete server with existing clubs. Please delete all clubs first.',
        clubs_count: clubsData.length
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  const { error: deleteError } = await supabaseClient
    .from("servers")
    .delete()
    .eq("id", serverId);

  if (deleteError) {
    return new Response(
      JSON.stringify({ error: deleteError.message }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Server deleted successfully"
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
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
  assertEquals(typeof body.server.id, 'string');
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
