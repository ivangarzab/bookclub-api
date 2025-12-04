// supabase/functions/club/handlers/update.ts
// Handles PUT requests to update an existing club

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, successResponse } from '../utils/responses.ts'
import { validateServer } from '../utils/validation.ts'

/**
 * Handles PUT requests to update an existing club
 */
export async function handleUpdateClub(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[CLUB-PUT] === New PUT request received ===`)

    // Get the request body
    const data = await req.json()
    console.log(`[CLUB-PUT] Request body:`, JSON.stringify(data, null, 2))

    // Validate required fields
    if (!data.id) {
      console.log(`[CLUB-PUT] Missing club ID - returning 400`)
      return errorResponse('Club ID is required', 400)
    }

    // Server ID is optional - only validate if provided
    if (data.server_id) {
      console.log(`[CLUB-PUT] Validating server: "${data.server_id}"`)
      const serverValidation = await validateServer(supabaseClient, data.server_id)
      console.log(`[CLUB-PUT] Server validation result:`, serverValidation)

      if (!serverValidation.valid) {
        console.log(`[CLUB-PUT] Server validation failed - returning 404`)
        return errorResponse(serverValidation.error || 'Server not found', 404)
      }
    } else {
      console.log(`[CLUB-PUT] No server_id provided - updating club independently`)
    }

    // Build update object with only the fields that should be updated
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.discord_channel !== undefined) updateData.discord_channel = data.discord_channel
    if (data.founded_date !== undefined) updateData.founded_date = data.founded_date

    console.log(`[CLUB-PUT] Update data prepared:`, updateData)

    // Check if we have either club fields to update OR shame_list updates
    const hasClubUpdates = Object.keys(updateData).length > 0
    const hasShameListUpdates = data.shame_list !== undefined

    console.log(`[CLUB-PUT] Update validation:`, {
      hasClubUpdates,
      hasShameListUpdates,
      totalUpdates: hasClubUpdates || hasShameListUpdates
    })

    if (!hasClubUpdates && !hasShameListUpdates) {
      console.log(`[CLUB-PUT] No fields to update - returning 400`)
      return errorResponse('No fields to update', 400)
    }

    // Check if club exists (optionally filtering by server)
    console.log(`[CLUB-PUT] Checking if club exists: id="${data.id}"${data.server_id ? `, server_id="${data.server_id}"` : ''}`)

    let existenceQuery = supabaseClient
      .from('clubs')
      .select('id')
      .eq('id', data.id)

    if (data.server_id) {
      existenceQuery = existenceQuery.eq('server_id', data.server_id)
    }

    const { data: existingClub, error: checkError } = await existenceQuery.single()

    console.log(`[CLUB-PUT] Club existence check:`, { found: !!existingClub, error: checkError?.message })

    if (checkError || !existingClub) {
      console.log(`[CLUB-PUT] Club not found - returning 404`)
      return errorResponse(data.server_id ? 'Club not found in this server' : 'Club not found', 404)
    }

    // Update club table only if we have club fields to update
    let clubData = null
    if (hasClubUpdates) {
      console.log(`[CLUB-PUT] Updating club with data:`, updateData)

      let updateQuery = supabaseClient
        .from('clubs')
        .update(updateData)
        .eq('id', data.id)

      if (data.server_id) {
        updateQuery = updateQuery.eq('server_id', data.server_id)
      }

      const { data: clubUpdateResult, error: updateError } = await updateQuery.select()

      console.log(`[CLUB-PUT] Club update result:`, { success: !!clubUpdateResult, error: updateError?.message })

      if (updateError) {
        console.log(`[CLUB-PUT] Club update failed - returning 500`)
        return errorResponse(updateError.message, 500)
      }

      clubData = clubUpdateResult
    } else {
      console.log(`[CLUB-PUT] No club fields to update - skipping club table update`)

      // Get current club data for response
      let getCurrentQuery = supabaseClient
        .from('clubs')
        .select('id, name, discord_channel, server_id, founded_date')
        .eq('id', data.id)

      if (data.server_id) {
        getCurrentQuery = getCurrentQuery.eq('server_id', data.server_id)
      }

      const { data: currentClub, error: getCurrentError } = await getCurrentQuery.single()

      if (getCurrentError) {
        console.log(`[CLUB-PUT] Failed to get current club data - returning 500`)
        return errorResponse(getCurrentError.message, 500)
      }

      clubData = [currentClub]
    }

    // Handle shame_list updates if provided
    let shame_list_updated = false
    if (hasShameListUpdates) {
      console.log(`[CLUB-PUT] Processing shame list update:`, data.shame_list)

      if (!Array.isArray(data.shame_list)) {
        console.log(`[CLUB-PUT] Invalid shame list format - returning 400`)
        return errorResponse('Shame list must be an array', 400)
      }

      // Get current shame list
      console.log(`[CLUB-PUT] Getting current shame list for club: "${data.id}"`)
      const { data: current_shame_list, error: get_shame_error } = await supabaseClient
        .from('shamelist')
        .select('member_id')
        .eq('club_id', data.id)

      console.log(`[CLUB-PUT] Current shame list:`, {
        count: current_shame_list?.length || 0,
        members: current_shame_list?.map(s => s.member_id) || [],
        error: get_shame_error?.message
      })

      if (get_shame_error) {
        console.log(`[CLUB-PUT] Failed to get current shame list - returning 500`)
        return errorResponse(get_shame_error.message, 500)
      }

      const current_member_ids = current_shame_list.map(item => item.member_id)

      // Members to add (in new list but not in current)
      const members_to_add = data.shame_list.filter((id: number) => !current_member_ids.includes(id))

      // Members to remove (in current but not in new list)
      const members_to_remove = current_member_ids.filter(id => !data.shame_list.includes(id))

      console.log(`[CLUB-PUT] Shame list changes:`, {
        to_add: members_to_add,
        to_remove: members_to_remove
      })

      // Add new members to shame list
      if (members_to_add.length > 0) {
        console.log(`[CLUB-PUT] Adding ${members_to_add.length} members to shame list...`)

        for (const memberId of members_to_add) {
          // Verify member exists
          const { data: memberExists, error: memberError } = await supabaseClient
            .from('members')
            .select('id')
            .eq('id', memberId)
            .single()

          if (memberError || !memberExists) {
            console.error(`[CLUB-PUT] Member ID ${memberId} not found for shame list`)
            continue
          }

          // Add to shame list
          const { error: shameError } = await supabaseClient
            .from('shamelist')
            .insert({
              club_id: data.id,
              member_id: memberId
            })

          if (shameError) {
            console.error(`[CLUB-PUT] Error adding member ${memberId} to shame list: ${shameError.message}`)
          } else {
            console.log(`[CLUB-PUT] Member ${memberId} added to shame list successfully`)
            shame_list_updated = true
          }
        }
      }

      // Remove members from shame list
      if (members_to_remove.length > 0) {
        console.log(`[CLUB-PUT] Removing ${members_to_remove.length} members from shame list...`)

        const { error: removeError } = await supabaseClient
          .from('shamelist')
          .delete()
          .eq('club_id', data.id)
          .in('member_id', members_to_remove)

        console.log(`[CLUB-PUT] Shame list removal result:`, { success: !removeError, error: removeError?.message })

        if (removeError) {
          console.error(`[CLUB-PUT] Error removing members from shame list: ${removeError.message}`)
        } else if (members_to_remove.length > 0) {
          shame_list_updated = true
        }
      }
    } else {
      console.log(`[CLUB-PUT] No shame list updates requested`)
    }

    console.log(`[CLUB-PUT] Club update completed successfully:`, {
      club: clubData[0],
      club_updated: hasClubUpdates,
      shame_list_updated: shame_list_updated
    })

    return successResponse({
      success: true,
      message: 'Club updated successfully',
      club: clubData[0],
      club_updated: hasClubUpdates,
      shame_list_updated: shame_list_updated
    })

  } catch (error) {
    console.log(`[CLUB-PUT] ERROR: ${(error as Error).message}`)
    return errorResponse((error as Error).message, 500)
  }
}
