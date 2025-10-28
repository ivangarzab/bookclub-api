// Integration test setup utilities
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Test configuration for local Supabase instance
 */
export const TEST_CONFIG = {
  supabaseUrl: Deno.env.get('SUPABASE_URL') || 'http://localhost:54321',
  supabaseKey: Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  functionsUrl: Deno.env.get('SUPABASE_FUNCTIONS_URL') || 'http://localhost:54321/functions/v1',
};

/**
 * Creates a Supabase client for integration tests
 */
export function createTestClient(): SupabaseClient {
  return createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey);
}

/**
 * Invokes an edge function for testing
 */
export async function invokeFunction(
  functionName: string,
  options: {
    method?: string;
    body?: any;
    params?: Record<string, string>;
  } = {}
): Promise<Response> {
  const { method = 'GET', body, params } = options;

  // Build URL with query params
  let url = `${TEST_CONFIG.functionsUrl}/${functionName}`;
  if (params) {
    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${TEST_CONFIG.supabaseKey}`,
    'Content-Type': 'application/json',
  };

  const init: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    init.body = JSON.stringify(body);
  }

  return await fetch(url, init);
}

/**
 * Cleans up test data from the database
 */
export async function cleanupTestData(client: SupabaseClient) {
  // Delete in order to respect foreign key constraints
  await client.from('discussions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('books').delete().neq('id', 0);
  await client.from('shamelist').delete().neq('member_id', 0);
  await client.from('memberclubs').delete().neq('member_id', 0);
  await client.from('members').delete().neq('id', 0);
  await client.from('clubs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('servers').delete().neq('id', '00000000000000000');
}

/**
 * Seeds basic test data
 */
export async function seedTestData(client: SupabaseClient) {
  // Insert test servers
  const { data: servers } = await client
    .from('servers')
    .insert([
      { id: '111111111111111111', name: 'Test Server 1' },
      { id: '222222222222222222', name: 'Test Server 2' },
    ])
    .select();

  return { servers };
}

/**
 * Generates a unique test ID
 */
export function generateTestId(): string {
  return Math.floor(Math.random() * 1000000000000000000).toString();
}

/**
 * Generates a unique test UUID
 */
export function generateTestUUID(): string {
  return crypto.randomUUID();
}

/**
 * Waits for a condition to be true (useful for eventual consistency)
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return false;
}

/**
 * Assertion helper for response status
 */
export async function assertResponseOk(response: Response): Promise<any> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Expected OK response but got ${response.status}: ${text}`);
  }
  return await response.json();
}

/**
 * Assertion helper for error responses
 */
export async function assertResponseError(
  response: Response,
  expectedStatus: number
): Promise<any> {
  if (response.status !== expectedStatus) {
    const text = await response.text();
    throw new Error(`Expected status ${expectedStatus} but got ${response.status}: ${text}`);
  }
  return await response.json();
}
