// supabase/functions/member/handlers/get.ts
// Handles GET requests to retrieve member details

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, successResponse } from '../utils/responses.ts'

/**
 * Handles GET requests to retrieve member details
 */
export async function handleGetMember(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[MEMBER-GET] Starting handleGetMember`);

    // Get URL parameters
    const url = new URL(req.url);
    const memberId = url.searchParams.get('id');
    const userId = url.searchParams.get('user_id');

    console.log(`[MEMBER-GET] Request parameters:`, { memberId, userId });

    // Validate that we have either id or user_id
    if (!memberId && !userId) {
      console.log(`[MEMBER-GET] Missing both member ID and user ID - returning 400`);
      return errorResponse('Either Member ID or User ID is required', 400)
    }

    let memberData;
    let memberError;

    if (userId) {
      // Search by user_id (new functionality)
      console.log(`[MEMBER-GET] Querying member by user_id: "${userId}"`);
      const result = await supabaseClient
        .from("members")
        .select("*")
        .eq("user_id", userId)
        .single()

      memberData = result.data;
      memberError = result.error;
    } else {
      // Search by member id (existing functionality)
      console.log(`[MEMBER-GET] Querying member by id: "${memberId}"`);
      const result = await supabaseClient
        .from("members")
        .select("*")
        .eq("id", memberId)
        .single()

      memberData = result.data;
      memberError = result.error;
    }

    console.log(`[MEMBER-GET] Member query result:`, {
      found: !!memberData,
      error: memberError?.message,
      member: memberData ? {
        id: memberData.id,
        name: memberData.name,
        points: memberData.points,
        books_read: memberData.books_read,
        user_id: memberData.user_id,
        role: memberData.role,
      } : null
    });

    if (memberError || !memberData) {
      console.log(`[MEMBER-GET] Member not found - returning 404`);
      return errorResponse(memberError?.message || 'Member not found', 404)
    }

    // Get clubs this member belongs to
    console.log(`[MEMBER-GET] Getting club associations for member: "${memberData.id}"`);
    const { data: memberClubs, error: memberClubsError } = await supabaseClient
      .from("memberclubs")
      .select("club_id")
      .eq("member_id", memberData.id)

    console.log(`[MEMBER-GET] Member clubs query result:`, {
      count: memberClubs?.length || 0,
      error: memberClubsError?.message,
      club_ids: memberClubs?.map(mc => mc.club_id) || []
    });

    if (memberClubsError) {
      console.log(`[MEMBER-GET] Member clubs query failed - returning 500`);
      return errorResponse(memberClubsError.message, 500)
    }

    // Get club details
    const clubIds = memberClubs.map(mc => mc.club_id);
    let clubs: Array<Record<string, unknown>> = [];

    if (clubIds.length > 0) {
      console.log(`[MEMBER-GET] Getting details for ${clubIds.length} clubs:`, clubIds);

      const { data: clubsData, error: clubsError } = await supabaseClient
        .from("clubs")
        .select("id, name, discord_channel, server_id")
        .in("id", clubIds)

      console.log(`[MEMBER-GET] Clubs details query result:`, {
        count: clubsData?.length || 0,
        error: clubsError?.message,
        clubs: clubsData?.map(c => ({ id: c.id, name: c.name })) || []
      });

      if (clubsError) {
        console.log(`[MEMBER-GET] Clubs details query failed - returning 500`);
        return errorResponse(clubsError.message, 500)
      }

      clubs = clubsData;
    } else {
      console.log(`[MEMBER-GET] Member belongs to no clubs`);
    }

    // Get shame list entries for this member (now from club level)
    console.log(`[MEMBER-GET] Getting shame list entries for member: "${memberData.id}"`);
    const { data: shameData, error: shameError } = await supabaseClient
      .from("shamelist")
      .select("club_id")
      .eq("member_id", memberData.id)

    console.log(`[MEMBER-GET] Shame list query result:`, {
      count: shameData?.length || 0,
      error: shameError?.message,
      shame_club_ids: shameData?.map(s => s.club_id) || []
    });

    if (shameError) {
      console.log(`[MEMBER-GET] Shame list query failed - returning 500`);
      return errorResponse(shameError.message, 500)
    }

    // Get club info for shame list
    const shameClubIds = shameData.map(s => s.club_id);
    let shameClubs: Array<Record<string, unknown>> = [];

    if (shameClubIds.length > 0) {
      console.log(`[MEMBER-GET] Getting details for ${shameClubIds.length} shame clubs:`, shameClubIds);

      const { data: clubsData, error: clubsError } = await supabaseClient
        .from("clubs")
        .select("id, name, discord_channel, server_id")
        .in("id", shameClubIds)

      console.log(`[MEMBER-GET] Shame clubs details query result:`, {
        count: clubsData?.length || 0,
        error: clubsError?.message,
        clubs: clubsData?.map(c => ({ id: c.id, name: c.name })) || []
      });

      if (clubsError) {
        console.log(`[MEMBER-GET] Shame clubs details query failed - returning 500`);
        return errorResponse(clubsError.message, 500)
      }

      shameClubs = clubsData;
    } else {
      console.log(`[MEMBER-GET] Member is not on any shame lists`);
    }

    const responseData = {
      id: memberData.id,
      name: memberData.name,
      points: memberData.points,
      books_read: memberData.books_read,
      user_id: memberData.user_id,
      role: memberData.role,
      handle: memberData.handle,
      created_at: memberData.created_at,
      clubs: clubs,
      shame_clubs: shameClubs
    };

    console.log(`[MEMBER-GET] Member details completed - returning data:`, {
      member_id: responseData.id,
      member_name: responseData.name,
      user_id: responseData.user_id,
      role: responseData.role,
      clubs_count: responseData.clubs.length,
      shame_clubs_count: responseData.shame_clubs.length,
      points: responseData.points,
      books_read: responseData.books_read
    });

    // Return the member with associated data
    return successResponse(responseData)
  } catch (error) {
    console.log(`[MEMBER-GET] ERROR: ${(error as Error).message}`);
    return errorResponse((error as Error).message, 500)
  }
}
