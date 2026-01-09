// supabase/functions/session/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.76.1'
import { handleGetSession } from './handlers/get.ts'
import { handleCreateSession } from './handlers/create.ts'
import { handleUpdateSession } from './handlers/update.ts'
import { handleDeleteSession } from './handlers/delete.ts'
import { corsHeaders } from './utils/responses.ts'

/**
 * Main handler function - exported for testing
 */
export async function handler(req: Request, supabaseClient?: SupabaseClient): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log(`[SESSION] === New ${req.method} request received ===`);

    // Create Supabase client if not provided (for testing)
    // Use service role key to bypass RLS (Edge Functions are trusted server-side code)
    const client = supabaseClient || createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Determine which operation to perform based on HTTP method
    switch (req.method) {
      case 'GET':
        return await handleGetSession(req, client);
      case 'POST':
        return await handleCreateSession(req, client);
      case 'PUT':
        return await handleUpdateSession(req, client);
      case 'DELETE':
        return await handleDeleteSession(req, client);
      default:
        console.log(`[SESSION] Method not allowed: ${req.method}`);
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            },
            status: 405
          }
        );
    }
  } catch (error: any) {
    console.log(`[SESSION] FATAL ERROR: ${error.message}`);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: 500
      }
    )
  }
}

// Start server (only when run directly, not when imported for testing)
if (import.meta.main) {
  serve((req) => handler(req));
}
