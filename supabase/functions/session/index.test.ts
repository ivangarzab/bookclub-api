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
  TEST_SERVER_ID,
} from "../_shared/test-fixtures.ts";

// Mock database
const db = new MockDatabase();

// Helper to simulate the session function handler
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
        return await handleGetSession(req, supabaseClient, corsHeaders);
      case 'POST':
        return await handleCreateSession(req, supabaseClient, corsHeaders);
      case 'PUT':
        return await handleUpdateSession(req, supabaseClient, corsHeaders);
      case 'DELETE':
        return await handleDeleteSession(req, supabaseClient, corsHeaders);
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

async function handleGetSession(req: Request, supabaseClient: any, corsHeaders: any) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('id');

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: 'Session ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  const { data: sessionData, error: sessionError } = await supabaseClient
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !sessionData) {
    return new Response(
      JSON.stringify({ error: sessionError?.message || 'Session not found' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  // Get club
  const { data: clubData } = await supabaseClient
    .from("clubs")
    .select("id, name, discord_channel")
    .eq("id", sessionData.club_id)
    .single();

  // Get book
  const { data: bookData } = await supabaseClient
    .from("books")
    .select("*")
    .eq("id", sessionData.book_id)
    .single();

  // Get discussions
  const { data: discussionsData } = await supabaseClient
    .from("discussions")
    .select("*")
    .eq("session_id", sessionId)
    .order("date", { ascending: true });

  // Get shame list from club
  const { data: shameListData } = await supabaseClient
    .from("shamelist")
    .select("member_id")
    .eq("club_id", clubData.id);

  const memberIds = shameListData?.map((item: any) => item.member_id) || [];
  let shameListMembers = [];

  if (memberIds.length > 0) {
    const { data: membersData } = await supabaseClient
      .from("members")
      .select("id, name")
      .in("id", memberIds);
    shameListMembers = membersData || [];
  }

  return new Response(
    JSON.stringify({
      id: sessionData.id,
      club: clubData,
      book: {
        id: bookData.id,
        title: bookData.title,
        author: bookData.author,
        edition: bookData.edition,
        year: bookData.year,
        isbn: bookData.isbn
      },
      due_date: sessionData.due_date,
      discussions: discussionsData?.map((d: any) => ({
        id: d.id,
        title: d.title,
        date: d.date,
        location: d.location
      })) || [],
      shame_list: shameListMembers
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleCreateSession(req: Request, supabaseClient: any, corsHeaders: any) {
  const data = await req.json();

  if (!data.club_id) {
    return new Response(
      JSON.stringify({ error: 'Club ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  if (!data.book) {
    return new Response(
      JSON.stringify({ error: 'Book information is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  if (!data.book.title || !data.book.author) {
    return new Response(
      JSON.stringify({ error: 'Book title and author are required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  // Check if club exists
  const { data: clubData } = await supabaseClient
    .from("clubs")
    .select("id")
    .eq("id", data.club_id)
    .single();

  if (!clubData) {
    return new Response(
      JSON.stringify({ error: 'Club not found' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  // Insert book
  const { data: bookData, error: bookError } = await supabaseClient
    .from("books")
    .insert({
      title: data.book.title,
      author: data.book.author,
      edition: data.book.edition || null,
      year: data.book.year || null,
      isbn: data.book.isbn || null
    })
    .select();

  if (bookError) {
    return new Response(
      JSON.stringify({ error: bookError.message }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }

  const sessionId = data.id || crypto.randomUUID();

  // Insert session
  const { data: sessionData, error: sessionError } = await supabaseClient
    .from("sessions")
    .insert({
      id: sessionId,
      club_id: data.club_id,
      book_id: bookData[0].id,
      due_date: data.due_date || null
    })
    .select();

  if (sessionError) {
    return new Response(
      JSON.stringify({ error: sessionError.message }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 500 }
    );
  }

  // Insert discussions
  let discussions = [];
  if (data.discussions && Array.isArray(data.discussions) && data.discussions.length > 0) {
    for (const discussion of data.discussions) {
      if (!discussion.title || !discussion.date) continue;

      const discussionId = discussion.id || crypto.randomUUID();
      const { data: discussionData } = await supabaseClient
        .from("discussions")
        .insert({
          id: discussionId,
          session_id: sessionId,
          title: discussion.title,
          date: discussion.date,
          location: discussion.location || null
        })
        .select();

      if (discussionData) {
        discussions.push(discussionData[0]);
      }
    }
  }

  // Get full club data
  const { data: fullClubData } = await supabaseClient
    .from("clubs")
    .select("id, name, discord_channel")
    .eq("id", data.club_id)
    .single();

  return new Response(
    JSON.stringify({
      success: true,
      message: "Session created successfully",
      session: {
        id: sessionId,
        club: fullClubData || { id: data.club_id },
        book: {
          id: bookData[0].id,
          title: bookData[0].title,
          author: bookData[0].author,
          edition: bookData[0].edition,
          year: bookData[0].year,
          isbn: bookData[0].isbn
        },
        due_date: sessionData[0].due_date,
        discussions: discussions
      }
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleUpdateSession(req: Request, supabaseClient: any, corsHeaders: any) {
  const data = await req.json();

  if (!data.id) {
    return new Response(
      JSON.stringify({ error: 'Session ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  // Check if session exists
  const { data: existingSession } = await supabaseClient
    .from("sessions")
    .select("id, book_id")
    .eq("id", data.id)
    .single();

  if (!existingSession) {
    return new Response(
      JSON.stringify({ error: 'Session not found' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  let bookUpdated = false;

  // Handle book updates
  if (data.book) {
    const hasBookUpdates = ['title', 'author', 'edition', 'year', 'isbn'].some(prop =>
      data.book[prop] !== undefined
    );

    if (hasBookUpdates) {
      const { data: currentBook } = await supabaseClient
        .from("books")
        .select("*")
        .eq("id", existingSession.book_id)
        .single();

      const bookUpdateData = {
        title: data.book.title !== undefined ? data.book.title : currentBook.title,
        author: data.book.author !== undefined ? data.book.author : currentBook.author,
        edition: data.book.edition !== undefined ? data.book.edition : currentBook.edition,
        year: data.book.year !== undefined ? data.book.year : currentBook.year,
        isbn: data.book.isbn !== undefined ? data.book.isbn : currentBook.isbn
      };

      await supabaseClient
        .from("books")
        .update(bookUpdateData)
        .eq("id", existingSession.book_id);

      bookUpdated = true;
    }
  }

  // Handle session updates
  const sessionUpdateData: any = {};
  if (data.club_id !== undefined) {
    const { data: clubData } = await supabaseClient
      .from("clubs")
      .select("id")
      .eq("id", data.club_id)
      .single();

    if (!clubData) {
      return new Response(
        JSON.stringify({ error: 'Club not found' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
      );
    }

    sessionUpdateData.club_id = data.club_id;
  }

  if (data.due_date !== undefined) {
    sessionUpdateData.due_date = data.due_date;
  }

  let sessionUpdated = false;
  if (Object.keys(sessionUpdateData).length > 0) {
    await supabaseClient
      .from("sessions")
      .update(sessionUpdateData)
      .eq("id", data.id);

    sessionUpdated = true;
  }

  // Handle discussions
  let discussionsUpdated = false;
  if (data.discussions !== undefined) {
    if (!Array.isArray(data.discussions)) {
      return new Response(
        JSON.stringify({ error: 'Discussions must be an array' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
      );
    }

    const { data: existingDiscussions } = await supabaseClient
      .from("discussions")
      .select("id")
      .eq("session_id", data.id);

    for (const discussion of data.discussions) {
      if (discussion.id) {
        const isExisting = existingDiscussions?.some((d: any) => d.id === discussion.id);

        if (isExisting) {
          const updateData: any = {};
          if (discussion.title !== undefined) updateData.title = discussion.title;
          if (discussion.date !== undefined) updateData.date = discussion.date;
          if (discussion.location !== undefined) updateData.location = discussion.location;

          if (Object.keys(updateData).length > 0) {
            await supabaseClient
              .from("discussions")
              .update(updateData)
              .eq("id", discussion.id);

            discussionsUpdated = true;
          }
        } else {
          if (discussion.title && discussion.date) {
            await supabaseClient
              .from("discussions")
              .insert({
                id: discussion.id,
                session_id: data.id,
                title: discussion.title,
                date: discussion.date,
                location: discussion.location || null
              });

            discussionsUpdated = true;
          }
        }
      } else {
        if (discussion.title && discussion.date) {
          await supabaseClient
            .from("discussions")
            .insert({
              id: crypto.randomUUID(),
              session_id: data.id,
              title: discussion.title,
              date: discussion.date,
              location: discussion.location || null
            });

          discussionsUpdated = true;
        }
      }
    }

    // Handle deletions
    if (data.discussion_ids_to_delete && Array.isArray(data.discussion_ids_to_delete) && data.discussion_ids_to_delete.length > 0) {
      await supabaseClient
        .from("discussions")
        .delete()
        .in("id", data.discussion_ids_to_delete)
        .eq("session_id", data.id);

      discussionsUpdated = true;
    }
  }

  if (!bookUpdated && !sessionUpdated && !discussionsUpdated) {
    return new Response(
      JSON.stringify({ message: "No changes to apply" }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Session updated successfully",
      updates: {
        book: bookUpdated,
        session: sessionUpdated,
        discussions: discussionsUpdated
      }
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

async function handleDeleteSession(req: Request, supabaseClient: any, corsHeaders: any) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('id');

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: 'Session ID is required' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 400 }
    );
  }

  const { data: existingSession } = await supabaseClient
    .from("sessions")
    .select("id, book_id")
    .eq("id", sessionId)
    .single();

  if (!existingSession) {
    return new Response(
      JSON.stringify({ error: 'Session not found' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 404 }
    );
  }

  const bookId = existingSession.book_id;

  // Delete discussions
  await supabaseClient
    .from("discussions")
    .delete()
    .eq("session_id", sessionId);

  // Delete session
  await supabaseClient
    .from("sessions")
    .delete()
    .eq("id", sessionId);

  // Delete book
  await supabaseClient
    .from("books")
    .delete()
    .eq("id", bookId);

  return new Response(
    JSON.stringify({
      success: true,
      message: "Session deleted successfully"
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

// Test setup
function setupTest() {
  db.clear();
}

// CORS Tests
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
