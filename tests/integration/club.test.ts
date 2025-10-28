// Integration tests for club edge function
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
  name: "Club Integration - POST creates club successfully",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();

    // Create server first
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });

    // Create club via edge function
    const response = await invokeFunction('club', {
      method: 'POST',
      body: {
        id: clubId,
        name: 'Integration Test Club',
        discord_channel: 1234567890123456,
        server_id: serverId
      }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    assertEquals(data.club.id, clubId);
    assertEquals(data.club.name, 'Integration Test Club');

    // Verify in database
    const { data: dbClub } = await client
      .from('clubs')
      .select('*')
      .eq('id', clubId)
      .single();

    assertExists(dbClub);
    assertEquals(dbClub.name, 'Integration Test Club');

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Club Integration - GET returns club with members and session",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();
    const memberId = 10000;
    const bookId = 10000;
    const sessionId = generateTestUUID();

    // Create full club structure
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({
      id: clubId,
      name: 'Full Test Club',
      discord_channel: 9876543210123456,
      server_id: serverId
    });
    await client.from('members').insert({
      id: memberId,
      name: 'Test Member',
      points: 100,
      books_read: 5
    });
    await client.from('memberclubs').insert({ member_id: memberId, club_id: clubId });

    await client.from('books').insert({
      id: bookId,
      title: 'Test Book',
      author: 'Test Author'
    });
    await client.from('sessions').insert({
      id: sessionId,
      club_id: clubId,
      book_id: bookId,
      due_date: '2025-12-31'
    });

    // Get club via edge function
    const response = await invokeFunction('club', {
      params: { id: clubId, server_id: serverId }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.id, clubId);
    assertEquals(data.name, 'Full Test Club');
    assertEquals(data.members.length, 1);
    assertEquals(data.members[0].id, memberId);
    assertExists(data.active_session);
    assertEquals(data.active_session.id, sessionId);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Club Integration - GET by discord_channel finds club",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();
    const channelId = BigInt(Date.now()) * 1000n; // Unique bigint channel ID

    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({
      id: clubId,
      name: 'Channel Test Club',
      discord_channel: channelId.toString(),
      server_id: serverId
    });

    // Search by discord_channel
    const response = await invokeFunction('club', {
      params: { discord_channel: channelId.toString(), server_id: serverId }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.id, clubId);
    assertEquals(data.discord_channel.toString(), channelId.toString());

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Club Integration - PUT updates club name and discord_channel",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();

    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({
      id: clubId,
      name: 'Original Club',
      discord_channel: 1111111111111111,
      server_id: serverId
    });

    // Update via edge function
    const response = await invokeFunction('club', {
      method: 'PUT',
      body: {
        id: clubId,
        server_id: serverId,
        name: 'Updated Club Name',
        discord_channel: 2222222222222222
      }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    assertEquals(data.club.name, 'Updated Club Name');
    assertEquals(data.club.discord_channel.toString(), '2222222222222222');

    // Verify in database
    const { data: dbClub } = await client
      .from('clubs')
      .select('*')
      .eq('id', clubId)
      .single();

    assertEquals(dbClub?.name, 'Updated Club Name');
    assertEquals(dbClub?.discord_channel.toString(), '2222222222222222');

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Club Integration - PUT updates shame list",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();
    const memberId1 = 10001;
    const memberId2 = 10002;

    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({ id: clubId, name: 'Test Club', server_id: serverId });
    await client.from('members').insert([
      { id: memberId1, name: 'Member 1', points: 0, books_read: 0 },
      { id: memberId2, name: 'Member 2', points: 0, books_read: 0 }
    ]);

    // Update shame list via edge function
    const response = await invokeFunction('club', {
      method: 'PUT',
      body: {
        id: clubId,
        server_id: serverId,
        shame_list: [memberId1, memberId2]
      }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    assertEquals(data.shame_list_updated, true);

    // Verify in database
    const { data: shameList } = await client
      .from('shamelist')
      .select('member_id')
      .eq('club_id', clubId);

    assertEquals(shameList?.length, 2);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Club Integration - DELETE removes club and cascades",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();
    const memberId = 10003;
    const bookId = 10003;
    const sessionId = generateTestUUID();
    const discussionId = generateTestUUID();

    // Create full structure
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({ id: clubId, name: 'To Delete', server_id: serverId });
    await client.from('members').insert({ id: memberId, name: 'Member', points: 0, books_read: 0 });
    await client.from('memberclubs').insert({ member_id: memberId, club_id: clubId });
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
    await client.from('shamelist').insert({ club_id: clubId, member_id: memberId });

    // Delete via edge function
    const response = await invokeFunction('club', {
      method: 'DELETE',
      params: { id: clubId, server_id: serverId }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);

    // Verify cascade deletion
    const { data: dbClub } = await client.from('clubs').select('*').eq('id', clubId).single();
    const { data: dbSession } = await client.from('sessions').select('*').eq('id', sessionId).single();
    const { data: dbDiscussion } = await client.from('discussions').select('*').eq('id', discussionId).single();
    const { data: dbMemberClub } = await client.from('memberclubs').select('*').eq('club_id', clubId);
    const { data: dbShame } = await client.from('shamelist').select('*').eq('club_id', clubId);

    assertEquals(dbClub, null);
    assertEquals(dbSession, null);
    assertEquals(dbDiscussion, null);
    assertEquals(dbMemberClub?.length, 0);
    assertEquals(dbShame?.length, 0);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Club Integration - POST returns 404 when server doesn't exist",
  async fn() {
    await setup();

    const response = await invokeFunction('club', {
      method: 'POST',
      body: {
        name: 'Test Club',
        server_id: 'nonexistent'
      }
    });

    await assertResponseError(response, 404);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
