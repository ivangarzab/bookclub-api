// supabase/functions/server/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.76.1'
import { handleGetServer } from './handlers/get.ts'
import { handleCreateServer } from './handlers/create.ts'
import { handleUpdateServer } from './handlers/update.ts'
import { handleDeleteServer } from './handlers/delete.ts'
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
    console.log(`[SERVER] === New ${req.method} request received ===`);

    // Create Supabase client if not provided (for testing)
    // Use service role key to bypass RLS (Edge Functions are trusted server-side code)
    const client = supabaseClient || createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Determine which operation to perform based on HTTP method
    switch (req.method) {
      case 'GET':
        return await handleGetServer(req, client);
      case 'POST':
        return await handleCreateServer(req, client);
      case 'PUT':
        return await handleUpdateServer(req, client);
      case 'DELETE':
        return await handleDeleteServer(req, client);
      default:
        console.log(`[SERVER] Method not allowed: ${req.method}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Method not allowed'
          }),
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
    console.log(`[SERVER] FATAL ERROR: ${error.message}`);
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
