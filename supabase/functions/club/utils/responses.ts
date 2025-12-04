// supabase/functions/club/utils/responses.ts
// Response formatting helpers

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

/**
 * Returns a standardized error response
 */
export function errorResponse(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      status
    }
  )
}

/**
 * Returns a standardized success response
 */
export function successResponse(data: unknown, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      status
    }
  )
}

/**
 * Export corsHeaders for use in handlers
 */
export { corsHeaders }
