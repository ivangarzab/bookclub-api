// Integration tests for member edge function
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
  name: "Member Integration - POST creates member successfully",
  async fn() {
    await setup();

    // Create member via edge function
    const response = await invokeFunction('member', {
      method: 'POST',
      body: {
        name: 'Integration Test Member',
        points: 50,
        books_read: 3
      }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    assertExists(data.member.id);
    assertEquals(data.member.name, 'Integration Test Member');
    assertEquals(data.member.points, 50);
    assertEquals(data.member.books_read, 3);

    // Verify in database
    const { data: dbMember } = await client
      .from('members')
      .select('*')
      .eq('id', data.member.id)
      .single();

    assertExists(dbMember);
    assertEquals(dbMember.name, 'Integration Test Member');

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Member Integration - POST creates member with club associations",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = generateTestUUID();

    // Create server and club
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({ id: clubId, name: 'Test Club', server_id: serverId });

    // Create member with club association
    const response = await invokeFunction('member', {
      method: 'POST',
      body: {
        name: 'Member With Club',
        points: 0,
        books_read: 0,
        clubs: [clubId]
      }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    assertEquals(data.member.clubs.length, 1);
    assertEquals(data.member.clubs[0], clubId);

    // Verify association in database
    const { data: memberClubs } = await client
      .from('memberclubs')
      .select('*')
      .eq('member_id', data.member.id)
      .eq('club_id', clubId);

    assertEquals(memberClubs?.length, 1);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Member Integration - GET returns member by ID with clubs",
  async fn() {
    await setup();

    const memberId = 20000;
    const serverId = generateTestId();
    const clubId = generateTestUUID();

    // Create member and club association
    await client.from('members').insert({
      id: memberId,
      name: 'Findable Member',
      points: 100,
      books_read: 5
    });
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({ id: clubId, name: 'Test Club', server_id: serverId });
    await client.from('memberclubs').insert({ member_id: memberId, club_id: clubId });

    // Get member via edge function
    const response = await invokeFunction('member', {
      params: { id: memberId.toString() }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.id, memberId);
    assertEquals(data.name, 'Findable Member');
    assertEquals(data.points, 100);
    assertEquals(data.books_read, 5);
    assertEquals(data.clubs.length, 1);
    assertEquals(data.clubs[0].id, clubId);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Member Integration - GET returns member with shame clubs",
  async fn() {
    await setup();

    const memberId = 20001;
    const serverId = generateTestId();
    const clubId = generateTestUUID();

    // Create member on shame list
    await client.from('members').insert({
      id: memberId,
      name: 'Shame Member',
      points: 0,
      books_read: 0
    });
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({ id: clubId, name: 'Test Club', server_id: serverId });
    await client.from('shamelist').insert({ club_id: clubId, member_id: memberId });

    // Get member via edge function
    const response = await invokeFunction('member', {
      params: { id: memberId.toString() }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.id, memberId);
    assertEquals(data.shame_clubs.length, 1);
    assertEquals(data.shame_clubs[0].id, clubId);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Member Integration - PUT updates member fields",
  async fn() {
    await setup();

    const memberId = 20002;

    // Create member
    await client.from('members').insert({
      id: memberId,
      name: 'Original Name',
      points: 50,
      books_read: 2
    });

    // Update via edge function
    const response = await invokeFunction('member', {
      method: 'PUT',
      body: {
        id: memberId,
        name: 'Updated Name',
        points: 150,
        books_read: 7
      }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    assertEquals(data.member.name, 'Updated Name');
    assertEquals(data.member.points, 150);
    assertEquals(data.member.books_read, 7);

    // Verify in database
    const { data: dbMember } = await client
      .from('members')
      .select('*')
      .eq('id', memberId)
      .single();

    assertEquals(dbMember?.name, 'Updated Name');
    assertEquals(dbMember?.points, 150);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Member Integration - PUT updates club associations",
  async fn() {
    await setup();

    const memberId = 20003;
    const serverId = generateTestId();
    const clubId1 = generateTestUUID();
    const clubId2 = generateTestUUID();

    // Create member and clubs
    await client.from('members').insert({
      id: memberId,
      name: 'Member',
      points: 0,
      books_read: 0
    });
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert([
      { id: clubId1, name: 'Club 1', server_id: serverId },
      { id: clubId2, name: 'Club 2', server_id: serverId }
    ]);
    await client.from('memberclubs').insert({ member_id: memberId, club_id: clubId1 });

    // Update clubs via edge function
    const response = await invokeFunction('member', {
      method: 'PUT',
      body: {
        id: memberId,
        clubs: [clubId2]  // Remove from club1, add to club2
      }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    assertEquals(data.clubs_updated, true);

    // Verify in database
    const { data: memberClubs } = await client
      .from('memberclubs')
      .select('club_id')
      .eq('member_id', memberId);

    assertEquals(memberClubs?.length, 1);
    assertEquals(memberClubs?.[0].club_id, clubId2);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Member Integration - DELETE removes member and cascades",
  async fn() {
    await setup();

    const memberId = 20004;
    const serverId = generateTestId();
    const clubId = generateTestUUID();

    // Create member with associations
    await client.from('members').insert({
      id: memberId,
      name: 'To Delete',
      points: 0,
      books_read: 0
    });
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({ id: clubId, name: 'Test Club', server_id: serverId });
    await client.from('memberclubs').insert({ member_id: memberId, club_id: clubId });
    await client.from('shamelist').insert({ club_id: clubId, member_id: memberId });

    // Delete via edge function
    const response = await invokeFunction('member', {
      method: 'DELETE',
      params: { id: memberId.toString() }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);

    // Verify cascade deletion
    const { data: dbMember } = await client.from('members').select('*').eq('id', memberId).single();
    const { data: dbMemberClubs } = await client.from('memberclubs').select('*').eq('member_id', memberId);
    const { data: dbShame } = await client.from('shamelist').select('*').eq('member_id', memberId);

    assertEquals(dbMember, null);
    assertEquals(dbMemberClubs?.length, 0);
    assertEquals(dbShame?.length, 0);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Member Integration - POST auto-increments ID when not provided",
  async fn() {
    await setup();

    // Create first member
    const response1 = await invokeFunction('member', {
      method: 'POST',
      body: { name: 'Member 1' }
    });
    const data1 = await assertResponseOk(response1);
    const firstId = data1.member.id;

    // Create second member
    const response2 = await invokeFunction('member', {
      method: 'POST',
      body: { name: 'Member 2' }
    });
    const data2 = await assertResponseOk(response2);
    const secondId = data2.member.id;

    // Second ID should be greater than first
    assertEquals(secondId > firstId, true);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
