// Test utilities and helpers for Supabase Edge Functions
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

/**
 * Creates a mock HTTP Request object for testing
 */
export function createMockRequest(
  method: string,
  url: string,
  body?: any,
  headers?: Record<string, string>
): Request {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-token',
    ...headers
  };

  const init: RequestInit = {
    method,
    headers: defaultHeaders,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

/**
 * Parses a Response object and returns the JSON body
 */
export async function parseResponse(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Asserts that a response has the expected status and returns parsed body
 */
export async function assertResponseStatus(
  response: Response,
  expectedStatus: number
): Promise<any> {
  assertEquals(response.status, expectedStatus,
    `Expected status ${expectedStatus} but got ${response.status}`);
  return await parseResponse(response);
}

/**
 * Asserts that a response contains CORS headers
 */
export function assertCorsHeaders(response: Response) {
  assertExists(response.headers.get('Access-Control-Allow-Origin'));
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
}

/**
 * Asserts that a response is a successful JSON response
 */
export async function assertSuccessResponse(
  response: Response,
  expectedData?: any
): Promise<any> {
  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Content-Type'), 'application/json');
  assertCorsHeaders(response);

  const body = await parseResponse(response);

  if (expectedData) {
    assertEquals(body, expectedData);
  }

  return body;
}

/**
 * Asserts that a response is an error response
 */
export async function assertErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedErrorMessage?: string
): Promise<any> {
  assertEquals(response.status, expectedStatus);
  assertCorsHeaders(response);

  const body = await parseResponse(response);
  assertEquals(body.success, false);
  assertExists(body.error);

  if (expectedErrorMessage) {
    assertEquals(body.error, expectedErrorMessage);
  }

  return body;
}

/**
 * Creates a test server ID
 */
export function createTestServerId(): string {
  return Math.floor(Math.random() * 1000000000000000000).toString();
}

/**
 * Creates a test UUID
 */
export function createTestUUID(): string {
  return crypto.randomUUID();
}

/**
 * Sleep utility for async tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
