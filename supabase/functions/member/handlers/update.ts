// supabase/functions/member/handlers/update.ts
// Handles PUT requests to update an existing member

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, successResponse, corsHeaders } from '../utils/responses.ts'

/**
 * Handles PUT requests to update an existing member
 */
export async function handleUpdateMember(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[MEMBER-PUT] Starting handleUpdateMember`);

    // Get the request body
    const data = await req.json()
    console.log(`[MEMBER-PUT] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.id) {
      console.log(`[MEMBER-PUT] Missing member ID - returning 400`);
      return errorResponse('Member ID is required', 400)
    }

    // Check if member exists
    console.log(`[MEMBER-PUT] Checking if member exists: "${data.id}"`);
    const { data: existingMember, error: checkError } = await supabaseClient
      .from("members")
      .select("id")
      .eq("id", data.id)
      .single()

    console.log(`[MEMBER-PUT] Member existence check:`, {
      found: !!existingMember,
      error: checkError?.message
    });

    if (checkError || !existingMember) {
      console.log(`[MEMBER-PUT] Member not found - returning 404`);
      return errorResponse('Member not found', 404)
    }

    // Build update object with only the fields that should be updated
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.points !== undefined) updateData.points = data.points
    if (data.books_read !== undefined) updateData.books_read = data.books_read
    if (data.handle !== undefined) updateData.handle = data.handle

    console.log(`[MEMBER-PUT] Member update data prepared:`, updateData);

    let updatedMember = { id: data.id };
    let clubsUpdated = false;

    // Update member data if there are fields to update
    if (Object.keys(updateData).length > 0) {
      console.log(`[MEMBER-PUT] Updating member with data:`, updateData);

      const { data: memberData, error: updateError } = await supabaseClient
        .from("members")
        .update(updateData)
        .eq("id", data.id)
        .select()

      console.log(`[MEMBER-PUT] Member update result:`, {
        success: !!memberData,
        error: updateError?.message,
        member: memberData?.[0] ? {
          id: memberData[0].id,
          name: memberData[0].name
        } : null
      });

      if (updateError) {
        console.log(`[MEMBER-PUT] Member update failed - returning 500`);
        return errorResponse(updateError.message, 500)
      }

      updatedMember = memberData[0];
    } else {
      console.log(`[MEMBER-PUT] No member fields to update`);
    }

    // Handle club associations if provided
    if (data.clubs !== undefined) {
      console.log(`[MEMBER-PUT] Processing club associations update:`, data.clubs);

      if (!Array.isArray(data.clubs)) {
        console.log(`[MEMBER-PUT] Invalid clubs format - returning 400`);
        return errorResponse('Clubs must be an array', 400)
      }

      // Get existing club associations
      console.log(`[MEMBER-PUT] Getting existing club associations for member: "${data.id}"`);
      const { data: existingAssociations, error: getError } = await supabaseClient
        .from("memberclubs")
        .select("club_id")
        .eq("member_id", data.id)

      console.log(`[MEMBER-PUT] Existing associations result:`, {
        count: existingAssociations?.length || 0,
        error: getError?.message,
        club_ids: existingAssociations?.map(a => a.club_id) || []
      });

      if (getError) {
        console.log(`[MEMBER-PUT] Failed to get existing associations - returning 500`);
        return errorResponse(getError.message, 500)
      }

      const existingClubIds = existingAssociations.map(a => a.club_id);

      // Clubs to add (in new list but not in existing)
      const clubsToAdd = data.clubs.filter((id: string) => !existingClubIds.includes(id));

      // Clubs to remove (in existing but not in new list)
      const clubsToRemove = existingClubIds.filter((id: string) => !data.clubs.includes(id));

      console.log(`[MEMBER-PUT] Club changes:`, {
        to_add: clubsToAdd,
        to_remove: clubsToRemove
      });

      // Add new associations
      if (clubsToAdd.length > 0) {
        console.log(`[MEMBER-PUT] Adding ${clubsToAdd.length} new club associations...`);

        // Verify all club IDs exist
        const { data: validClubs, error: verifyError } = await supabaseClient
          .from("clubs")
          .select("id")
          .in("id", clubsToAdd)

        console.log(`[MEMBER-PUT] Club verification for new associations:`, {
          requested_count: clubsToAdd.length,
          found_count: validClubs?.length || 0,
          error: verifyError?.message,
          found_clubs: validClubs?.map(c => c.id) || []
        });

        if (verifyError) {
          console.log(`[MEMBER-PUT] Club verification failed - returning 500`);
          return errorResponse(verifyError.message, 500)
        }

        const validClubIds = validClubs.map(c => c.id);
        const invalidClubs = clubsToAdd.filter((id: string) => !validClubIds.includes(id));

        console.log(`[MEMBER-PUT] Club validation:`, {
          valid_clubs: validClubIds,
          invalid_clubs: invalidClubs
        });

        if (invalidClubs.length > 0) {
          console.log(`[MEMBER-PUT] Some clubs don't exist - returning 400`);
          return errorResponse(`The following clubs do not exist: ${invalidClubs.join(', ')}`, 400)
        }

        // Add new associations
        const newAssociations = validClubIds.map((clubId: string) => ({
          member_id: data.id,
          club_id: clubId
        }));

        if (newAssociations.length > 0) {
          console.log(`[MEMBER-PUT] Inserting ${newAssociations.length} new associations:`, newAssociations);

          const { error: addError } = await supabaseClient
            .from("memberclubs")
            .insert(newAssociations)

          console.log(`[MEMBER-PUT] New associations insert result:`, {
            success: !addError,
            error: addError?.message
          });

          if (addError) {
            console.log(`[MEMBER-PUT] Failed to add new associations - returning 500`);
            return errorResponse(addError.message, 500)
          }

          clubsUpdated = true;
        }
      }

      // Remove old associations
      if (clubsToRemove.length > 0) {
        console.log(`[MEMBER-PUT] Removing ${clubsToRemove.length} old associations:`, clubsToRemove);

        const { error: removeError } = await supabaseClient
          .from("memberclubs")
          .delete()
          .eq("member_id", data.id)
          .in("club_id", clubsToRemove)

        console.log(`[MEMBER-PUT] Remove associations result:`, {
          success: !removeError,
          error: removeError?.message
        });

        if (removeError) {
          console.log(`[MEMBER-PUT] Failed to remove associations - returning 500`);
          return errorResponse(removeError.message, 500)
        }

        clubsUpdated = true;
      }
    } else {
      console.log(`[MEMBER-PUT] No club associations update requested`);
    }

    // If nothing was updated
    if (Object.keys(updateData).length === 0 && !clubsUpdated) {
      console.log(`[MEMBER-PUT] No changes to apply`);
      return successResponse({
        success: true,
        message: "No changes to apply"
      })
    }

    const responseData = {
      success: true,
      message: "Member updated successfully",
      member: updatedMember,
      clubs_updated: clubsUpdated
    };

    console.log(`[MEMBER-PUT] Member update completed successfully:`, {
      member_id: responseData.member.id,
      fields_updated: Object.keys(updateData),
      clubs_updated: responseData.clubs_updated
    });

    return successResponse(responseData)

  } catch (error) {
    console.log(`[MEMBER-PUT] ERROR: ${(error as Error).message}`);
    return errorResponse((error as Error).message, 500)
  }
}
