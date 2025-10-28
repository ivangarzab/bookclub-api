// Integration tests for server edge function
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  createTestClient,
  invokeFunction,
  cleanupTestData,
  generateTestId,
  assertResponseOk,
  assertResponseError,
} from "./setup.ts";

const client = createTestClient();

// Setup: Clean database before tests
async function setup() {
  await cleanupTestData(client);
}

// Teardown: Clean up after tests
async function teardown() {
  await cleanupTestData(client);
}

Deno.test({
  name: "Server Integration - POST creates server successfully",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const serverName = "Integration Test Server";

    // Create server via edge function
    const response = await invokeFunction('server', {
      method: 'POST',
      body: { id: serverId, name: serverName }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    // Server ID is returned as bigint from database, convert to string for comparison
    assertEquals(data.server.id.toString(), serverId);
    assertEquals(data.server.name, serverName);

    // Verify in database
    const { data: dbServer, error } = await client
      .from('servers')
      .select('*')
      .eq('id', serverId)
      .single();

    assertEquals(error, null);
    assertExists(dbServer);
    assertEquals(dbServer.name, serverName);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Server Integration - GET returns server with clubs",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = crypto.randomUUID();

    // Create server and club via database
    await client.from('servers').insert({ id: serverId, name: 'Test Server' });
    await client.from('clubs').insert({
      id: clubId,
      name: 'Test Club',
      discord_channel: 5555555555555555,
      server_id: serverId
    });

    // Get server via edge function
    const response = await invokeFunction('server', {
      params: { id: serverId }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.id, serverId);
    assertEquals(data.name, 'Test Server');
    assertEquals(data.clubs.length, 1);
    assertEquals(data.clubs[0].id, clubId);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Server Integration - PUT updates server name",
  async fn() {
    await setup();

    const serverId = generateTestId();

    // Create server
    await client.from('servers').insert({ id: serverId, name: 'Original Name' });

    // Update via edge function
    const response = await invokeFunction('server', {
      method: 'PUT',
      body: { id: serverId, name: 'Updated Name' }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);
    assertEquals(data.server.name, 'Updated Name');

    // Verify in database
    const { data: dbServer } = await client
      .from('servers')
      .select('name')
      .eq('id', serverId)
      .single();

    assertEquals(dbServer?.name, 'Updated Name');

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Server Integration - DELETE removes server",
  async fn() {
    await setup();

    const serverId = generateTestId();

    // Create server
    await client.from('servers').insert({ id: serverId, name: 'To Delete' });

    // Delete via edge function
    const response = await invokeFunction('server', {
      method: 'DELETE',
      params: { id: serverId }
    });

    const data = await assertResponseOk(response);
    assertEquals(data.success, true);

    // Verify deleted from database
    const { data: dbServer } = await client
      .from('servers')
      .select('*')
      .eq('id', serverId)
      .single();

    assertEquals(dbServer, null);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Server Integration - DELETE prevents deletion when server has clubs",
  async fn() {
    await setup();

    const serverId = generateTestId();
    const clubId = crypto.randomUUID();

    // Create server with club
    await client.from('servers').insert({ id: serverId, name: 'Server With Club' });
    await client.from('clubs').insert({
      id: clubId,
      name: 'Test Club',
      server_id: serverId
    });

    // Try to delete via edge function
    const response = await invokeFunction('server', {
      method: 'DELETE',
      params: { id: serverId }
    });

    const data = await assertResponseError(response, 400);
    assertExists(data.error);
    assertEquals(data.clubs_count, 1);

    // Verify server still exists
    const { data: dbServer } = await client
      .from('servers')
      .select('*')
      .eq('id', serverId)
      .single();

    assertExists(dbServer);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Server Integration - GET all servers returns list",
  async fn() {
    await setup();

    const serverId1 = generateTestId();
    const serverId2 = generateTestId();

    // Create servers
    await client.from('servers').insert([
      { id: serverId1, name: 'Server A' },
      { id: serverId2, name: 'Server B' }
    ]);

    // Get all servers
    const response = await invokeFunction('server');

    const data = await assertResponseOk(response);
    assertExists(data.servers);
    assertEquals(data.servers.length >= 2, true);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Server Integration - POST returns 400 when name missing",
  async fn() {
    await setup();

    const response = await invokeFunction('server', {
      method: 'POST',
      body: { id: generateTestId() }
    });

    const data = await assertResponseError(response, 400);
    assertExists(data.error);

    await teardown();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
