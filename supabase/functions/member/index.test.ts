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

// Mock database
const db = new MockDatabase();

// Helper to simulate the member function handler
async function handleRequest(req: Request): Promise<Response> {
  const supabaseClient = createMockSupabaseClient(db);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGetMember(req, supabaseClient, corsHeaders);
      case 'POST':
        return await handleCreateMember(req, supabaseClient, corsHeaders);
      case 'PUT':
        return await handleUpdateMember(req, supabaseClient, corsHeaders);
      case 'DELETE':
        return await handleDeleteMember(req, supabaseClient, corsHeaders);
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

async function handleGetMember(req: Request, supabaseClient: any, corsHeaders: any) {
  const url = new URL(req.url);
  const memberId = url.searchParams.get('id');
  const userId = url.searchParams.get('user_id');

  if (!memberId && !userId) {
    return new Response(
      JSON.stringify({ error: 'Either Member ID or User ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  let memberData;
  let memberError;

  if (userId) {
    const result = await supabaseClient
      .from("members")
      .select("*")
      .eq("user_id", userId)
      .single();
    memberData = result.data;
    memberError = result.error;
  } else {
    const result = await supabaseClient
      .from("members")
      .select("*")
      .eq("id", parseInt(memberId!))
      .single();
    memberData = result.data;
    memberError = result.error;
  }

  if (memberError || !memberData) {
    return new Response(
      JSON.stringify({ error: memberError?.message || 'Member not found' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  // Get clubs
  const { data: memberClubs } = await supabaseClient
    .from("memberclubs")
    .select("club_id")
    .eq("member_id", memberData.id);

  const clubIds = memberClubs?.map((mc: any) => mc.club_id) || [];
  let clubs = [];

  if (clubIds.length > 0) {
    const { data: clubsData } = await supabaseClient
      .from("clubs")
      .select("id, name, discord_channel")
      .in("id", clubIds);
    clubs = clubsData || [];
  }

  // Get shame list
  const { data: shameData } = await supabaseClient
    .from("shamelist")
    .select("club_id")
    .eq("member_id", memberData.id);

  const shameClubIds = shameData?.map((s: any) => s.club_id) || [];
  let shameClubs = [];

  if (shameClubIds.length > 0) {
    const { data: clubsData } = await supabaseClient
      .from("clubs")
      .select("id, name, discord_channel")
      .in("id", shameClubIds);
    shameClubs = clubsData || [];
  }

  return new Response(
    JSON.stringify({
      id: memberData.id,
      name: memberData.name,
      points: memberData.points,
      books_read: memberData.books_read,
      user_id: memberData.user_id,
      role: memberData.role,
      clubs: clubs,
      shame_clubs: shameClubs
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleCreateMember(req: Request, supabaseClient: any, corsHeaders: any) {
  const data = await req.json();

  if (!data.name) {
    return new Response(
      JSON.stringify({ error: 'Member name is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  if (data.clubs && (!Array.isArray(data.clubs) || data.clubs.length === 0)) {
    return new Response(
      JSON.stringify({ error: 'The clubs field must be an array with at least one club ID' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  let memberId;
  if (data.id) {
    memberId = data.id;
  } else {
    const { data: maxIdResult } = await supabaseClient
      .from("members")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);

    memberId = maxIdResult && maxIdResult.length > 0 ? maxIdResult[0].id + 1 : 1;
  }

  const { data: memberData, error: memberError } = await supabaseClient
    .from("members")
    .insert({
      id: memberId,
      name: data.name,
      points: data.points || 0,
      books_read: data.books_read || 0
    })
    .select();

  if (memberError) {
    return new Response(
      JSON.stringify({ error: memberError.message }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }

  // Associate with clubs
  if (data.clubs && data.clubs.length > 0) {
    const { data: existingClubs } = await supabaseClient
      .from("clubs")
      .select("id")
      .in("id", data.clubs);

    if (!existingClubs || existingClubs.length !== data.clubs.length) {
      const existingClubIds = existingClubs?.map((c: any) => c.id) || [];
      const nonExistentClubs = data.clubs.filter((id: string) => !existingClubIds.includes(id));

      return new Response(
        JSON.stringify({
          error: `The following clubs do not exist: ${nonExistentClubs.join(', ')}`,
          partial_success: true,
          message: "Member created but not associated with all clubs",
          member: memberData[0]
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
      );
    }

    const memberClubData = data.clubs.map((clubId: string) => ({
      member_id: memberId,
      club_id: clubId
    }));

    await supabaseClient
      .from("memberclubs")
      .insert(memberClubData);
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Member created successfully",
      member: {
        ...memberData[0],
        clubs: data.clubs || []
      }
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleUpdateMember(req: Request, supabaseClient: any, corsHeaders: any) {
  const data = await req.json();

  if (!data.id) {
    return new Response(
      JSON.stringify({ error: 'Member ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  const { data: existingMember } = await supabaseClient
    .from("members")
    .select("id")
    .eq("id", data.id)
    .single();

  if (!existingMember) {
    return new Response(
      JSON.stringify({ error: 'Member not found' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.points !== undefined) updateData.points = data.points;
  if (data.books_read !== undefined) updateData.books_read = data.books_read;

  let updatedMember = { id: data.id };
  let clubsUpdated = false;

  if (Object.keys(updateData).length > 0) {
    const { data: memberData } = await supabaseClient
      .from("members")
      .update(updateData)
      .eq("id", data.id)
      .select();

    updatedMember = memberData[0];
  }

  // Handle clubs update
  if (data.clubs !== undefined) {
    if (!Array.isArray(data.clubs)) {
      return new Response(
        JSON.stringify({ error: 'Clubs must be an array' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
      );
    }

    const { data: existingAssociations } = await supabaseClient
      .from("memberclubs")
      .select("club_id")
      .eq("member_id", data.id);

    const existingClubIds = existingAssociations?.map((a: any) => a.club_id) || [];
    const clubsToAdd = data.clubs.filter((id: string) => !existingClubIds.includes(id));
    const clubsToRemove = existingClubIds.filter((id: string) => !data.clubs.includes(id));

    if (clubsToAdd.length > 0) {
      const { data: validClubs } = await supabaseClient
        .from("clubs")
        .select("id")
        .in("id", clubsToAdd);

      const validClubIds = validClubs?.map((c: any) => c.id) || [];
      const invalidClubs = clubsToAdd.filter((id: string) => !validClubIds.includes(id));

      if (invalidClubs.length > 0) {
        return new Response(
          JSON.stringify({
            error: `The following clubs do not exist: ${invalidClubs.join(', ')}`,
            partial_success: Object.keys(updateData).length > 0,
            message: "Member updated but clubs not completely modified",
            member: updatedMember
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
        );
      }

      const newAssociations = validClubIds.map((clubId: string) => ({
        member_id: data.id,
        club_id: clubId
      }));

      if (newAssociations.length > 0) {
        await supabaseClient
          .from("memberclubs")
          .insert(newAssociations);
        clubsUpdated = true;
      }
    }

    if (clubsToRemove.length > 0) {
      await supabaseClient
        .from("memberclubs")
        .delete()
        .eq("member_id", data.id)
        .in("club_id", clubsToRemove);
      clubsUpdated = true;
    }
  }

  if (Object.keys(updateData).length === 0 && !clubsUpdated) {
    return new Response(
      JSON.stringify({ message: "No changes to apply" }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Member updated successfully",
      member: updatedMember,
      clubs_updated: clubsUpdated
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleDeleteMember(req: Request, supabaseClient: any, corsHeaders: any) {
  const url = new URL(req.url);
  const memberId = url.searchParams.get('id');

  if (!memberId) {
    return new Response(
      JSON.stringify({ error: 'Member ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  const { data: existingMember } = await supabaseClient
    .from("members")
    .select("id")
    .eq("id", parseInt(memberId))
    .single();

  if (!existingMember) {
    return new Response(
      JSON.stringify({ error: 'Member not found' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  // Delete shame list entries
  await supabaseClient
    .from("shamelist")
    .delete()
    .eq("member_id", parseInt(memberId));

  // Delete club associations
  await supabaseClient
    .from("memberclubs")
    .delete()
    .eq("member_id", parseInt(memberId));

  // Delete member
  await supabaseClient
    .from("members")
    .delete()
    .eq("id", parseInt(memberId));

  return new Response(
    JSON.stringify({
      success: true,
      message: "Member deleted successfully"
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

// Test setup
function setupTest() {
  db.clear();
}

// CORS Tests
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
