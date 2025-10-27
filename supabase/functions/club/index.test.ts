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

// Mock database
const db = new MockDatabase();

// Helper to simulate the club function handler (simplified version of the actual handler)
async function handleRequest(req: Request): Promise<Response> {
  const supabaseClient = createMockSupabaseClient(db);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
    switch (req.method) {
      case 'GET':
        return await handleGetClub(req, supabaseClient, corsHeaders);
      case 'POST':
        return await handleCreateClub(req, supabaseClient, corsHeaders);
      case 'PUT':
        return await handleUpdateClub(req, supabaseClient, corsHeaders);
      case 'DELETE':
        return await handleDeleteClub(req, supabaseClient, corsHeaders);
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

async function handleGetClub(req: Request, supabaseClient: any, corsHeaders: any) {
  const url = new URL(req.url);
  const clubId = url.searchParams.get('id');
  const serverId = url.searchParams.get('server_id');
  const discordChannel = url.searchParams.get('discord_channel');

  // Search by discord_channel
  if (discordChannel) {
    if (!serverId) {
      return new Response(
        JSON.stringify({ error: 'Server ID is required when searching by discord_channel' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
      );
    }

    // Validate server
    const { data: serverData } = await supabaseClient.from("servers").select("id").eq("id", serverId).single();
    if (!serverData) {
      return new Response(
        JSON.stringify({ error: 'Server not found or not registered' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
      );
    }

    const { data: clubData, error: clubError } = await supabaseClient
      .from("clubs")
      .select("*")
      .eq("discord_channel", discordChannel)
      .eq("server_id", serverId)
      .single();

    if (clubError || !clubData) {
      return new Response(
        JSON.stringify({ error: clubError?.message || 'Club not found with this discord channel in the specified server' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
      );
    }

    return await getFullClubDetails(supabaseClient, clubData.id, serverId, corsHeaders);
  }

  // Search by ID
  if (!clubId) {
    return new Response(
      JSON.stringify({ error: 'Club ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  if (!serverId) {
    return new Response(
      JSON.stringify({ error: 'Server ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  // Validate server
  const { data: serverData } = await supabaseClient.from("servers").select("id").eq("id", serverId).single();
  if (!serverData) {
    return new Response(
      JSON.stringify({ error: 'Server not found or not registered' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  return await getFullClubDetails(supabaseClient, clubId, serverId, corsHeaders);
}

async function getFullClubDetails(supabaseClient: any, clubId: string, serverId: string, corsHeaders: any) {
  const { data: clubData, error: clubError } = await supabaseClient
    .from("clubs")
    .select("*")
    .eq("id", clubId)
    .eq("server_id", serverId)
    .single();

  if (clubError || !clubData) {
    return new Response(
      JSON.stringify({ error: clubError?.message || 'Club not found in this server' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  // Get members
  const { data: memberClubsData } = await supabaseClient
    .from("memberclubs")
    .select("member_id")
    .eq("club_id", clubId);

  let membersWithClubs = [];
  if (memberClubsData && memberClubsData.length > 0) {
    const memberIds = memberClubsData.map((mc: any) => mc.member_id);
    const { data: membersData } = await supabaseClient
      .from("members")
      .select("*")
      .in("id", memberIds);

    membersWithClubs = await Promise.all(
      (membersData || []).map(async (member: any) => {
        const { data: memberClubs } = await supabaseClient
          .from("memberclubs")
          .select("club_id")
          .eq("member_id", member.id);

        return {
          id: member.id,
          name: member.name,
          points: member.points,
          books_read: member.books_read,
          clubs: memberClubs?.map((mc: any) => mc.club_id) || []
        };
      })
    );
  }

  // Get active session
  const { data: sessionsData } = await supabaseClient
    .from("sessions")
    .select("*")
    .eq("club_id", clubId)
    .order('due_date', { ascending: false })
    .limit(1);

  let active_session = null;
  if (sessionsData && sessionsData.length > 0) {
    const session = sessionsData[0];

    const { data: bookData } = await supabaseClient
      .from("books")
      .select("*")
      .eq("id", session.book_id)
      .single();

    const { data: discussionsData } = await supabaseClient
      .from("discussions")
      .select("*")
      .eq("session_id", session.id);

    active_session = {
      id: session.id,
      club_id: session.club_id,
      book: bookData ? {
        title: bookData.title,
        author: bookData.author,
        edition: bookData.edition,
        year: bookData.year,
        isbn: bookData.isbn
      } : null,
      due_date: session.due_date,
      discussions: discussionsData?.map((d: any) => ({
        id: d.id,
        session_id: d.session_id,
        title: d.title,
        date: d.date,
        location: d.location
      })) || []
    };
  }

  // Get past sessions
  const { data: past_sessions_data } = await supabaseClient
    .from("sessions")
    .select("id, due_date")
    .eq("club_id", clubId)
    .order('due_date', { ascending: false })
    .range(active_session ? 1 : 0, 10);

  // Get shame list
  const { data: shame_list_data } = await supabaseClient
    .from("shamelist")
    .select("member_id")
    .eq("club_id", clubId);

  return new Response(
    JSON.stringify({
      id: clubData.id,
      name: clubData.name,
      discord_channel: clubData.discord_channel,
      server_id: clubData.server_id,
      members: membersWithClubs,
      active_session: active_session,
      past_sessions: past_sessions_data || [],
      shame_list: shame_list_data?.map((item: any) => item.member_id) || []
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleCreateClub(req: Request, supabaseClient: any, corsHeaders: any) {
  const data = await req.json();

  if (!data.name) {
    return new Response(
      JSON.stringify({ error: 'Club name is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  if (!data.server_id) {
    return new Response(
      JSON.stringify({ error: 'Server ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  // Validate server
  const { data: serverData } = await supabaseClient.from("servers").select("id").eq("id", data.server_id).single();
  if (!serverData) {
    return new Response(
      JSON.stringify({ error: 'Server not found or not registered' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  const clubId = data.id || crypto.randomUUID();

  const { data: clubData, error: clubError } = await supabaseClient
    .from("clubs")
    .insert({
      id: clubId,
      name: data.name,
      discord_channel: data.discord_channel || null,
      server_id: data.server_id
    })
    .select();

  if (clubError) {
    return new Response(
      JSON.stringify({ error: clubError.message }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }

  // Handle members
  if (data.members && Array.isArray(data.members) && data.members.length > 0) {
    for (const member of data.members) {
      if (!member.id || !member.name) continue;

      await supabaseClient.from("members").insert({
        id: member.id,
        name: member.name,
        points: member.points || 0,
        books_read: member.books_read || 0
      });

      await supabaseClient.from("memberclubs").insert({
        member_id: member.id,
        club_id: clubId
      });
    }
  }

  // Handle active session
  if (data.active_session) {
    const session = data.active_session;
    const book = session.book;

    if (session.id && book && book.title && book.author) {
      const { data: bookData } = await supabaseClient.from("books").insert({
        title: book.title,
        author: book.author,
        edition: book.edition || null,
        year: book.year || null,
        isbn: book.isbn || null
      }).select();

      if (bookData) {
        await supabaseClient.from("sessions").insert({
          id: session.id,
          club_id: clubId,
          book_id: bookData[0].id,
          due_date: session.due_date || null
        });

        if (session.discussions && Array.isArray(session.discussions)) {
          for (const discussion of session.discussions) {
            if (discussion.id && discussion.title && discussion.date) {
              await supabaseClient.from("discussions").insert({
                id: discussion.id,
                session_id: session.id,
                title: discussion.title,
                date: discussion.date,
                location: discussion.location || null
              });
            }
          }
        }
      }
    }
  }

  // Handle shame list
  if (data.shame_list && Array.isArray(data.shame_list) && data.shame_list.length > 0) {
    for (const memberId of data.shame_list) {
      await supabaseClient.from("shamelist").insert({
        club_id: clubId,
        member_id: memberId
      });
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Club created successfully",
      club: clubData[0]
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleUpdateClub(req: Request, supabaseClient: any, corsHeaders: any) {
  const data = await req.json();

  if (!data.id) {
    return new Response(
      JSON.stringify({ error: 'Club ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  if (!data.server_id) {
    return new Response(
      JSON.stringify({ error: 'Server ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  // Validate server
  const { data: serverData } = await supabaseClient.from("servers").select("id").eq("id", data.server_id).single();
  if (!serverData) {
    return new Response(
      JSON.stringify({ error: 'Server not found or not registered' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.discord_channel !== undefined) updateData.discord_channel = data.discord_channel;

  const hasClubUpdates = Object.keys(updateData).length > 0;
  const hasShameListUpdates = data.shame_list !== undefined;

  if (!hasClubUpdates && !hasShameListUpdates) {
    return new Response(
      JSON.stringify({ error: 'No fields to update' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  // Check if club exists
  const { data: existingClub } = await supabaseClient
    .from("clubs")
    .select("id")
    .eq("id", data.id)
    .eq("server_id", data.server_id)
    .single();

  if (!existingClub) {
    return new Response(
      JSON.stringify({ error: 'Club not found in this server' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  let clubData = null;
  if (hasClubUpdates) {
    const result = await supabaseClient
      .from("clubs")
      .update(updateData)
      .eq("id", data.id)
      .eq("server_id", data.server_id)
      .select();

    clubData = result.data;
  } else {
    const result = await supabaseClient
      .from("clubs")
      .select("*")
      .eq("id", data.id)
      .eq("server_id", data.server_id)
      .single();

    clubData = [result.data];
  }

  // Handle shame list updates
  let shame_list_updated = false;
  if (hasShameListUpdates) {
    if (!Array.isArray(data.shame_list)) {
      return new Response(
        JSON.stringify({ error: 'Shame list must be an array' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
      );
    }

    const { data: current_shame_list } = await supabaseClient
      .from("shamelist")
      .select("member_id")
      .eq("club_id", data.id);

    const current_member_ids = current_shame_list.map((item: any) => item.member_id);
    const members_to_add = data.shame_list.filter((id: number) => !current_member_ids.includes(id));
    const members_to_remove = current_member_ids.filter((id: number) => !data.shame_list.includes(id));

    if (members_to_add.length > 0) {
      for (const memberId of members_to_add) {
        await supabaseClient.from("shamelist").insert({
          club_id: data.id,
          member_id: memberId
        });
        shame_list_updated = true;
      }
    }

    if (members_to_remove.length > 0) {
      await supabaseClient
        .from("shamelist")
        .delete()
        .eq("club_id", data.id)
        .in("member_id", members_to_remove);

      shame_list_updated = true;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Club updated successfully",
      club: clubData[0],
      club_updated: hasClubUpdates,
      shame_list_updated: shame_list_updated
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleDeleteClub(req: Request, supabaseClient: any, corsHeaders: any) {
  const url = new URL(req.url);
  const clubId = url.searchParams.get('id');
  const serverId = url.searchParams.get('server_id');

  if (!clubId) {
    return new Response(
      JSON.stringify({ error: 'Club ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  if (!serverId) {
    return new Response(
      JSON.stringify({ error: 'Server ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  // Validate server
  const { data: serverData } = await supabaseClient.from("servers").select("id").eq("id", serverId).single();
  if (!serverData) {
    return new Response(
      JSON.stringify({ error: 'Server not found or not registered' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  // Check if club exists
  const { data: existingClub } = await supabaseClient
    .from("clubs")
    .select("id")
    .eq("id", clubId)
    .eq("server_id", serverId)
    .single();

  if (!existingClub) {
    return new Response(
      JSON.stringify({ error: 'Club not found in this server' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  // Get sessions to cascade delete
  const { data: sessions } = await supabaseClient
    .from("sessions")
    .select("id")
    .eq("club_id", clubId);

  const sessionIds = sessions?.map((s: any) => s.id) || [];

  // Delete discussions
  if (sessionIds.length > 0) {
    await supabaseClient
      .from("discussions")
      .delete()
      .in("session_id", sessionIds);

    await supabaseClient
      .from("sessions")
      .delete()
      .eq("club_id", clubId);
  }

  // Delete shame list
  await supabaseClient
    .from("shamelist")
    .delete()
    .eq("club_id", clubId);

  // Delete member associations
  await supabaseClient
    .from("memberclubs")
    .delete()
    .eq("club_id", clubId);

  // Delete club
  await supabaseClient
    .from("clubs")
    .delete()
    .eq("id", clubId)
    .eq("server_id", serverId);

  return new Response(
    JSON.stringify({
      success: true,
      message: "Club deleted successfully"
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
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
