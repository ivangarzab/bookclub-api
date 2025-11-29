// supabase/functions/server/handlers/create.ts
// Handles POST requests to create a new server

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, successResponse } from '../utils/responses.ts'

/**
 * Handles POST requests to create a new server
 */
export async function handleCreateServer(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[SERVER-POST] Starting handleCreateServer`);

    // Get the request body
    const data = await req.json()
    console.log(`[SERVER-POST] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.name) {
      console.log(`[SERVER-POST] Missing server name - returning 400`);
      return errorResponse('Server name is required', 400)
    }

    // Generate a server ID if not provided (Discord server IDs are typically large numbers)
    const serverId = data.id || Math.floor(Math.random() * 1000000000000000000);
    console.log(`[SERVER-POST] Using server ID: "${serverId}" (provided: ${!!data.id})`);

    // Insert server data
    console.log(`[SERVER-POST] Inserting server data:`, { id: serverId, name: data.name });

    const { data: serverData, error: serverError } = await supabaseClient
      .from("servers")
      .insert({
        id: serverId,
        name: data.name
      })
      .select()

    console.log(`[SERVER-POST] Server insert result:`, {
      success: !!serverData,
      error: serverError?.message,
      server: serverData?.[0] ? { id: serverData[0].id, name: serverData[0].name } : null
    });

    if (serverError) {
      console.log(`[SERVER-POST] Server insert failed - returning 500`);
      return errorResponse(serverError.message, 500)
    }

    console.log(`[SERVER-POST] Server creation completed successfully`);

    return successResponse({
      success: true,
      message: "Server created successfully",
      server: serverData[0]
    })

  } catch (error) {
    console.log(`[SERVER-POST] ERROR: ${(error as Error).message}`);
    return errorResponse((error as Error).message, 500)
  }
}
