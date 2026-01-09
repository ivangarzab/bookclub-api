// supabase/functions/server/handlers/delete.ts
// Handles DELETE requests to remove a server

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.76.1'
import { errorResponse, successResponse, corsHeaders } from '../utils/responses.ts'

/**
 * Handles DELETE requests to remove a server
 */
export async function handleDeleteServer(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[SERVER-DELETE] Starting handleDeleteServer`);

    // Get URL parameters
    const url = new URL(req.url);
    const serverId = url.searchParams.get('id');

    console.log(`[SERVER-DELETE] Request parameters:`, { serverId });

    if (!serverId) {
      console.log(`[SERVER-DELETE] Missing server ID - returning 400`);
      return errorResponse('Server ID is required', 400)
    }

    // Check if server exists
    console.log(`[SERVER-DELETE] Checking if server exists: "${serverId}"`);
    const { data: existingServer, error: checkError } = await supabaseClient
      .from("servers")
      .select("id")
      .eq("id", serverId)
      .single()

    console.log(`[SERVER-DELETE] Server existence check:`, {
      found: !!existingServer,
      error: checkError?.message
    });

    if (checkError || !existingServer) {
      console.log(`[SERVER-DELETE] Server not found - returning 404`);
      return errorResponse('Server not found', 404)
    }

    // Check if server has clubs
    console.log(`[SERVER-DELETE] Checking for existing clubs in server: "${serverId}"`);
    const { data: clubsData } = await supabaseClient
      .from("clubs")
      .select("id")
      .eq("server_id", serverId)

    console.log(`[SERVER-DELETE] Clubs check result:`, {
      count: clubsData?.length || 0,
      clubs: clubsData?.map(c => c.id) || []
    });

    if (clubsData && clubsData.length > 0) {
      console.log(`[SERVER-DELETE] Server has ${clubsData.length} clubs - cannot delete`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cannot delete server with existing clubs. Please delete all clubs first.',
          clubs_count: clubsData.length
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          },
          status: 400
        }
      )
    }

    // Delete the server
    console.log(`[SERVER-DELETE] Deleting server: "${serverId}"`);
    const { error: deleteError } = await supabaseClient
      .from("servers")
      .delete()
      .eq("id", serverId)

    console.log(`[SERVER-DELETE] Server deletion result:`, {
      success: !deleteError,
      error: deleteError?.message
    });

    if (deleteError) {
      console.log(`[SERVER-DELETE] Server deletion failed - returning 500`);
      return errorResponse(deleteError.message, 500)
    }

    console.log(`[SERVER-DELETE] Server deletion completed successfully`);

    return successResponse({
      success: true,
      message: "Server deleted successfully"
    })

  } catch (error) {
    console.log(`[SERVER-DELETE] ERROR: ${(error as Error).message}`);
    return errorResponse((error as Error).message, 500)
  }
}
