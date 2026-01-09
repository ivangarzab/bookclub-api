// supabase/functions/club/handlers/delete.ts
// Handles DELETE requests to remove a club

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.76.1'
import { errorResponse, successResponse } from '../utils/responses.ts'
import { validateServer } from '../utils/validation.ts'

/**
 * Handles DELETE requests to remove a club
 */
export async function handleDeleteClub(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[CLUB-DELETE] === New DELETE request received ===`)

    // Get URL parameters
    const url = new URL(req.url)
    const clubId = url.searchParams.get('id')
    const serverId = url.searchParams.get('server_id')

    console.log(`[CLUB-DELETE] Request parameters:`, { clubId, serverId })

    if (!clubId) {
      console.log(`[CLUB-DELETE] Missing club ID - returning 400`)
      return errorResponse('Club ID is required', 400)
    }

    // Server ID is optional - only validate if provided
    if (serverId) {
      console.log(`[CLUB-DELETE] Validating server: "${serverId}"`)
      const serverValidation = await validateServer(supabaseClient, serverId)
      console.log(`[CLUB-DELETE] Server validation result:`, serverValidation)

      if (!serverValidation.valid) {
        console.log(`[CLUB-DELETE] Server validation failed - returning 404`)
        return errorResponse(serverValidation.error || 'Server not found', 404)
      }
    } else {
      console.log(`[CLUB-DELETE] No server_id provided - deleting club independently`)
    }

    // Check if club exists (optionally filtering by server)
    console.log(`[CLUB-DELETE] Checking if club exists: id="${clubId}"${serverId ? `, server_id="${serverId}"` : ''}`)

    let existenceQuery = supabaseClient
      .from('clubs')
      .select('id')
      .eq('id', clubId)

    if (serverId) {
      existenceQuery = existenceQuery.eq('server_id', serverId)
    }

    const { data: existingClub, error: checkError } = await existenceQuery.single()

    console.log(`[CLUB-DELETE] Club existence check:`, { found: !!existingClub, error: checkError?.message })

    if (checkError || !existingClub) {
      console.log(`[CLUB-DELETE] Club not found - returning 404`)
      return errorResponse(serverId ? 'Club not found in this server' : 'Club not found', 404)
    }

    // Get sessions to cascade delete
    console.log(`[CLUB-DELETE] Getting sessions for club: "${clubId}"`)
    const { data: sessions } = await supabaseClient
      .from('sessions')
      .select('id')
      .eq('club_id', clubId)

    const sessionIds = sessions?.map(s => s.id) || []
    console.log(`[CLUB-DELETE] Found sessions to delete:`, sessionIds)

    // Start cascade deletion
    console.log(`[CLUB-DELETE] Starting cascade deletion process...`)

    // 1. Delete discussions for any sessions in this club
    if (sessionIds.length > 0) {
      console.log(`[CLUB-DELETE] Deleting discussions for ${sessionIds.length} sessions...`)

      const { error: discussionError } = await supabaseClient
        .from('discussions')
        .delete()
        .in('session_id', sessionIds)

      console.log(`[CLUB-DELETE] Discussions deletion result:`, { success: !discussionError, error: discussionError?.message })

      if (discussionError) {
        console.log(`[CLUB-DELETE] Failed to delete discussions - returning 500`)
        return errorResponse(`Failed to delete discussions: ${discussionError.message}`, 500)
      }

      // 2. Delete sessions
      console.log(`[CLUB-DELETE] Deleting ${sessionIds.length} sessions...`)
      const { error: sessionError } = await supabaseClient
        .from('sessions')
        .delete()
        .eq('club_id', clubId)

      console.log(`[CLUB-DELETE] Sessions deletion result:`, { success: !sessionError, error: sessionError?.message })

      if (sessionError) {
        console.log(`[CLUB-DELETE] Failed to delete sessions - returning 500`)
        return errorResponse(`Failed to delete sessions: ${sessionError.message}`, 500)
      }
    } else {
      console.log(`[CLUB-DELETE] No sessions to delete`)
    }

    // 3. Delete shame list entries for this club
    console.log(`[CLUB-DELETE] Deleting shame list entries for club: "${clubId}"`)
    const { error: shame_list_error } = await supabaseClient
      .from('shamelist')
      .delete()
      .eq('club_id', clubId)

    console.log(`[CLUB-DELETE] Shame list deletion result:`, { success: !shame_list_error, error: shame_list_error?.message })

    if (shame_list_error) {
      console.log(`[CLUB-DELETE] Failed to delete shame list entries - returning 500`)
      return errorResponse(`Failed to delete shame list entries: ${shame_list_error.message}`, 500)
    }

    // 4. Delete member club associations
    console.log(`[CLUB-DELETE] Deleting member associations for club: "${clubId}"`)
    const { error: memberClubError } = await supabaseClient
      .from('memberclubs')
      .delete()
      .eq('club_id', clubId)

    console.log(`[CLUB-DELETE] Member associations deletion result:`, { success: !memberClubError, error: memberClubError?.message })

    if (memberClubError) {
      console.log(`[CLUB-DELETE] Failed to delete member associations - returning 500`)
      return errorResponse(`Failed to delete member associations: ${memberClubError.message}`, 500)
    }

    // 5. Finally delete the club
    console.log(`[CLUB-DELETE] Deleting club: "${clubId}"`)

    let deleteQuery = supabaseClient
      .from('clubs')
      .delete()
      .eq('id', clubId)

    if (serverId) {
      deleteQuery = deleteQuery.eq('server_id', serverId)
    }

    const { error: deleteError } = await deleteQuery

    console.log(`[CLUB-DELETE] Club deletion result:`, { success: !deleteError, error: deleteError?.message })

    if (deleteError) {
      console.log(`[CLUB-DELETE] Failed to delete club - returning 500`)
      return errorResponse(deleteError.message, 500)
    }

    console.log(`[CLUB-DELETE] Club deletion completed successfully`)
    return successResponse({
      success: true,
      message: 'Club deleted successfully'
    })

  } catch (error) {
    console.log(`[CLUB-DELETE] ERROR: ${(error as Error).message}`)
    return errorResponse((error as Error).message, 500)
  }
}
