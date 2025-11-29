// supabase/functions/club/index.ts - Refactored with modular handlers
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './utils/responses.ts'
import { handleGetClub } from './handlers/get.ts'
import { handleCreateClub } from './handlers/create.ts'
import { handleUpdateClub } from './handlers/update.ts'
import { handleDeleteClub } from './handlers/delete.ts'

/**
 * Main handler function - exported for testing
 */
export async function handler(req: Request, supabaseClient?: SupabaseClient): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client if not provided (for testing)
    const client = supabaseClient || createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Determine which operation to perform based on HTTP method
    switch (req.method) {
      case 'GET':
        return await handleGetClub(req, client)
      case 'POST':
        return await handleCreateClub(req, client)
      case 'PUT':
        return await handleUpdateClub(req, client)
      case 'DELETE':
        return await handleDeleteClub(req, client)
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            },
            status: 405
          }
        )
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
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
  serve((req) => handler(req))
}
