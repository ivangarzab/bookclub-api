// supabase/functions/member/handlers/delete.ts
// Handles DELETE requests to remove a member

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.76.1'
import { errorResponse, successResponse } from '../utils/responses.ts'

/**
 * Handles DELETE requests to remove a member
 */
export async function handleDeleteMember(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[MEMBER-DELETE] Starting handleDeleteMember`);

    // Get URL parameters
    const url = new URL(req.url);
    const memberId = url.searchParams.get('id');

    console.log(`[MEMBER-DELETE] Request parameters:`, { memberId });

    if (!memberId) {
      console.log(`[MEMBER-DELETE] Missing member ID - returning 400`);
      return errorResponse('Member ID is required', 400)
    }

    // Check if member exists
    console.log(`[MEMBER-DELETE] Checking if member exists: "${memberId}"`);
    const { data: existingMember, error: checkError } = await supabaseClient
      .from("members")
      .select("id")
      .eq("id", memberId)
      .single()

    console.log(`[MEMBER-DELETE] Member existence check:`, {
      found: !!existingMember,
      error: checkError?.message
    });

    if (checkError || !existingMember) {
      console.log(`[MEMBER-DELETE] Member not found - returning 404`);
      return errorResponse('Member not found', 404)
    }

    // Start cascade deletion
    console.log(`[MEMBER-DELETE] Starting cascade deletion for member: "${memberId}"`);

    // Delete from shame list first (now club-based)
    console.log(`[MEMBER-DELETE] Deleting shame list entries for member: "${memberId}"`);
    const { error: shameError } = await supabaseClient
      .from("shamelist")
      .delete()
      .eq("member_id", memberId)

    console.log(`[MEMBER-DELETE] Shame list deletion result:`, {
      success: !shameError,
      error: shameError?.message
    });

    if (shameError) {
      console.log(`[MEMBER-DELETE] Failed to delete shame list entries - returning 500`);
      return errorResponse(`Failed to delete from shame list: ${shameError.message}`, 500)
    }

    // Delete club associations
    console.log(`[MEMBER-DELETE] Deleting club associations for member: "${memberId}"`);
    const { error: associationError } = await supabaseClient
      .from("memberclubs")
      .delete()
      .eq("member_id", memberId)

    console.log(`[MEMBER-DELETE] Club associations deletion result:`, {
      success: !associationError,
      error: associationError?.message
    });

    if (associationError) {
      console.log(`[MEMBER-DELETE] Failed to delete club associations - returning 500`);
      return errorResponse(`Failed to delete club associations: ${associationError.message}`, 500)
    }

    // Delete the member
    console.log(`[MEMBER-DELETE] Deleting member: "${memberId}"`);
    const { error: deleteError } = await supabaseClient
      .from("members")
      .delete()
      .eq("id", memberId)

    console.log(`[MEMBER-DELETE] Member deletion result:`, {
      success: !deleteError,
      error: deleteError?.message
    });

    if (deleteError) {
      console.log(`[MEMBER-DELETE] Member deletion failed - returning 500`);
      return errorResponse(deleteError.message, 500)
    }

    console.log(`[MEMBER-DELETE] Member deletion completed successfully`);

    return successResponse({
      success: true,
      message: "Member deleted successfully"
    })

  } catch (error) {
    console.log(`[MEMBER-DELETE] ERROR: ${(error as Error).message}`);
    return errorResponse((error as Error).message, 500)
  }
}
