// supabase/functions/member/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleGetMember } from './handlers/get.ts'
import { handleCreateMember } from './handlers/create.ts'
import { handleUpdateMember } from './handlers/update.ts'
import { handleDeleteMember } from './handlers/delete.ts'
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
    console.log(`[MEMBER] === New ${req.method} request received ===`);

    // Create Supabase client if not provided (for testing)
    const client = supabaseClient || createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Determine which operation to perform based on HTTP method
    switch (req.method) {
      case 'GET':
        return await handleGetMember(req, client);
      case 'POST':
        return await handleCreateMember(req, client);
      case 'PUT':
        return await handleUpdateMember(req, client);
      case 'DELETE':
        return await handleDeleteMember(req, client);
      default:
        console.log(`[MEMBER] Method not allowed: ${req.method}`);
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
    console.log(`[MEMBER] FATAL ERROR: ${error.message}`);
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
