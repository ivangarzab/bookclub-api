// supabase/functions/server/handlers/update.ts
// Handles PUT requests to update an existing server

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, successResponse } from '../utils/responses.ts'

/**
 * Handles PUT requests to update an existing server
 */
export async function handleUpdateServer(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[SERVER-PUT] Starting handleUpdateServer`);

    // Get the request body
    const data = await req.json()
    console.log(`[SERVER-PUT] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.id) {
      console.log(`[SERVER-PUT] Missing server ID - returning 400`);
      return errorResponse('Server ID is required', 400)
    }

    // Check if server exists
    console.log(`[SERVER-PUT] Checking if server exists: "${data.id}"`);
    const { data: existingServer, error: checkError } = await supabaseClient
      .from("servers")
      .select("id")
      .eq("id", data.id)
      .single()

    console.log(`[SERVER-PUT] Server existence check:`, {
      found: !!existingServer,
      error: checkError?.message
    });

    if (checkError || !existingServer) {
      console.log(`[SERVER-PUT] Server not found - returning 404`);
      return errorResponse('Server not found', 404)
    }

    // Build update object with only the fields that should be updated
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name

    console.log(`[SERVER-PUT] Update data prepared:`, updateData);

    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      console.log(`[SERVER-PUT] No fields to update - returning 400`);
      return errorResponse('No fields to update', 400)
    }

    // Update server
    console.log(`[SERVER-PUT] Updating server with data:`, updateData);
    const { data: serverData, error: updateError } = await supabaseClient
      .from("servers")
      .update(updateData)
      .eq("id", data.id)
      .select()

    console.log(`[SERVER-PUT] Server update result:`, {
      success: !!serverData,
      error: updateError?.message,
      server: serverData?.[0] ? { id: serverData[0].id, name: serverData[0].name } : null
    });

    if (updateError) {
      console.log(`[SERVER-PUT] Server update failed - returning 500`);
      return errorResponse(updateError.message, 500)
    }

    console.log(`[SERVER-PUT] Server update completed successfully`);

    return successResponse({
      success: true,
      message: "Server updated successfully",
      server: serverData[0]
    })

  } catch (error) {
    console.log(`[SERVER-PUT] ERROR: ${(error as Error).message}`);
    return errorResponse((error as Error).message, 500)
  }
}
