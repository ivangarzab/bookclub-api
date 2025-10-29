// Integration tests for session edge function
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  createTestClient,
  invokeFunction,
  cleanupTestData,
  generateTestId,
  generateTestUUID,
  assertResponseOk,
  assertResponseError,
} from "./setup.ts";

const client = createTestClient();

async function setup() {
  await cleanupTestData(client);
}

async function teardown() {
  await cleanupTestData(client);
}

Deno.test({
  name: "Session Integration - POST creates session with book and discussions",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();

    // Create server and club
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({ id: clubId, name: 'Test Club', server_id: serverId });

    // Create session via edge function
    const response = await invokeFunction('session', {
      method: 'POST',
      body: {
        club_id: clubId,
        book: {
          title: 'Integration Test Book',
          author: 'Test Author',
          edition: 'First',
          year: 2024,
          isbn: '978-0000000000'
        },
        due_date: '2025-12-31',
        discussions: [
          {
            title: 'Part 1',
            date: '2025-11-15',
            location: 'Discord'
          },
          {
            title: 'Part 2',
            date: '2025-11-22',
            location: 'Discord'
          }
        ]
      }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    assertExists(data.session.id);
    assertEquals(data.session.book.title, 'Integration Test Book');
    assertEquals(data.session.discussions.length, 2);

    // Verify in database
    const { data: dbSession } = await client
      .from('sessions')
      .select('*, books(*)')
      .eq('id', data.session.id)
      .single();

    assertExists(dbSession);
    assertEquals(dbSession.books.title, 'Integration Test Book');

    // Verify discussions
    const { data: dbDiscussions } = await client
      .from('discussions')
      .select('*')
      .eq('session_id', data.session.id);

    assertEquals(dbDiscussions?.length, 2);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Session Integration - GET returns session with full details",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();
    const bookId = 30000;
    const sessionId = generateTestUUID();
    const discussionId = generateTestUUID();
    const memberId = 30000;

    // Create full session structure
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({
      id: clubId,
      name: 'Test Club',
      discord_channel: 3333333333333333,
      server_id: serverId
    });
    await client.from('books').insert({
      id: bookId,
      title: 'Findable Book',
      author: 'Findable Author',
      edition: '2nd',
      year: 2023,
      isbn: '978-1111111111'
    });
    await client.from('sessions').insert({
      id: sessionId,
      club_id: clubId,
      book_id: bookId,
      due_date: '2025-12-31'
    });
    await client.from('discussions').insert({
      id: discussionId,
      session_id: sessionId,
      title: 'Test Discussion',
      date: '2025-11-15',
      location: 'Discord'
    });
    await client.from('members').insert({
      id: memberId,
      name: 'Shame Member',
      points: 0,
      books_read: 0
    });
    await client.from('shamelist').insert({ club_id: clubId, member_id: memberId });

    // Get session via edge function
    const response = await invokeFunction('session', {
      params: { id: sessionId }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.id, sessionId);
    assertEquals(data.club.id, clubId);
    assertEquals(data.book.title, 'Findable Book');
    assertEquals(data.book.author, 'Findable Author');
    assertEquals(data.discussions.length, 1);
    assertEquals(data.discussions[0].title, 'Test Discussion');
    assertEquals(data.shame_list.length, 1);
    assertEquals(data.shame_list[0].id, memberId);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Session Integration - PUT updates session due_date",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();
    const bookId = 30001;
    const sessionId = generateTestUUID();

    // Create session
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({ id: clubId, name: 'Test Club', server_id: serverId });
    await client.from('books').insert({
      id: bookId,
      title: 'Book',
      author: 'Author'
    });
    await client.from('sessions').insert({
      id: sessionId,
      club_id: clubId,
      book_id: bookId,
      due_date: '2025-12-31'
    });

    // Update via edge function
    const response = await invokeFunction('session', {
      method: 'PUT',
      body: {
        id: sessionId,
        due_date: '2026-01-31'
      }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    assertEquals(data.updates.session, true);

    // Verify in database
    const { data: dbSession } = await client
      .from('sessions')
      .select('due_date')
      .eq('id', sessionId)
      .single();

    assertEquals(dbSession?.due_date, '2026-01-31');

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Session Integration - PUT updates book information",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();
    const bookId = 30002;
    const sessionId = generateTestUUID();

    // Create session
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({ id: clubId, name: 'Test Club', server_id: serverId });
    await client.from('books').insert({
      id: bookId,
      title: 'Original Title',
      author: 'Original Author'
    });
    await client.from('sessions').insert({
      id: sessionId,
      club_id: clubId,
      book_id: bookId
    });

    // Update book via edge function
    const response = await invokeFunction('session', {
      method: 'PUT',
      body: {
        id: sessionId,
        book: {
          title: 'Updated Title',
          author: 'Updated Author'
        }
      }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    assertEquals(data.updates.book, true);

    // Verify in database
    const { data: dbBook } = await client
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();

    assertEquals(dbBook?.title, 'Updated Title');
    assertEquals(dbBook?.author, 'Updated Author');

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Session Integration - PUT adds and updates discussions",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();
    const bookId = 30003;
    const sessionId = generateTestUUID();
    const discussionId = generateTestUUID();

    // Create session with one discussion
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({ id: clubId, name: 'Test Club', server_id: serverId });
    await client.from('books').insert({ id: bookId, title: 'Book', author: 'Author' });
    await client.from('sessions').insert({
      id: sessionId,
      club_id: clubId,
      book_id: bookId
    });
    await client.from('discussions').insert({
      id: discussionId,
      session_id: sessionId,
      title: 'Original Title',
      date: '2025-11-15'
    });

    // Update discussions via edge function
    const response = await invokeFunction('session', {
      method: 'PUT',
      body: {
        id: sessionId,
        discussions: [
          {
            id: discussionId,
            title: 'Updated Title'  // Update existing
          },
          {
            title: 'New Discussion',  // Add new
            date: '2025-11-22'
          }
        ]
      }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    assertEquals(data.updates.discussions, true);

    // Verify in database
    const { data: dbDiscussions } = await client
      .from('discussions')
      .select('*')
      .eq('session_id', sessionId)
      .order('date', { ascending: true });

    assertEquals(dbDiscussions?.length, 2);

    // Find updated discussion
    const updatedDiscussion = dbDiscussions?.find((d: any) => d.id === discussionId);
    assertEquals(updatedDiscussion?.title, 'Updated Title');

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Session Integration - DELETE removes session and cascades",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();
    const bookId = 30004;
    const sessionId = generateTestUUID();
    const discussionId = generateTestUUID();

    // Create session with discussions
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({ id: clubId, name: 'Test Club', server_id: serverId });
    await client.from('books').insert({ id: bookId, title: 'Book', author: 'Author' });
    await client.from('sessions').insert({
      id: sessionId,
      club_id: clubId,
      book_id: bookId
    });
    await client.from('discussions').insert({
      id: discussionId,
      session_id: sessionId,
      title: 'Discussion',
      date: '2025-11-15'
    });

    // Delete via edge function
    const response = await invokeFunction('session', {
      method: 'DELETE',
      params: { id: sessionId }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);

    // Verify cascade deletion
    const { data: dbSession } = await client.from('sessions').select('*').eq('id', sessionId).single();
    const { data: dbDiscussion } = await client.from('discussions').select('*').eq('id', discussionId).single();
    const { data: dbBook } = await client.from('books').select('*').eq('id', bookId).single();

    assertEquals(dbSession, null);
    assertEquals(dbDiscussion, null);
    assertEquals(dbBook, null);  // Book should also be deleted

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Session Integration - POST returns 404 when club doesn't exist",
  async fn() {
    await setup();

    const response = await invokeFunction('session', {
      method: 'POST',
      body: {
        club_id: 'nonexistent',
        book: {
          title: 'Test',
          author: 'Test'
        }
      }
    });

    await assertResponseError(response, 404);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Session Integration - POST returns 400 when book info missing",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();

    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({ id: clubId, name: 'Test Club', server_id: serverId });

    const response = await invokeFunction('session', {
      method: 'POST',
      body: {
        club_id: clubId
        // Missing book
      }
    });

    await assertResponseError(response, 400);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
