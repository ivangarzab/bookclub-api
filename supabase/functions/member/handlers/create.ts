// supabase/functions/member/handlers/create.ts
// Handles POST requests to create a new member

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, successResponse, corsHeaders } from '../utils/responses.ts'

/**
 * Handles POST requests to create a new member
 */
export async function handleCreateMember(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[MEMBER-POST] Starting handleCreateMember`);

    // Get the request body
    const data = await req.json()
    console.log(`[MEMBER-POST] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.name) {
      console.log(`[MEMBER-POST] Missing member name - returning 400`);
      return errorResponse('Member name is required', 400)
    }

    if (data.clubs && (!Array.isArray(data.clubs) || data.clubs.length === 0)) {
      console.log(`[MEMBER-POST] Invalid clubs field - returning 400`);
      return errorResponse('The clubs field must be an array with at least one club ID', 400)
    }

    // Handle member ID generation if not provided
    let memberId;
    if (data.id) {
      memberId = data.id;
      console.log(`[MEMBER-POST] Using provided member ID: ${memberId}`);
    } else {
      console.log(`[MEMBER-POST] Generating member ID - getting highest existing ID`);

      // Get the highest existing ID and increment by 1
      const { data: maxIdResult, error: idError } = await supabaseClient
        .from("members")
        .select("id")
        .order("id", { ascending: false })
        .limit(1);

      console.log(`[MEMBER-POST] Max ID query result:`, {
        found: !!maxIdResult?.length,
        error: idError?.message,
        max_id: maxIdResult?.[0]?.id || null
      });

      if (idError) {
        console.log(`[MEMBER-POST] Failed to generate ID - returning 500`);
        return errorResponse(`Failed to generate ID: ${idError.message}`, 500)
      }

      // If no members exist yet, start with ID 1, otherwise increment the highest ID
      memberId = maxIdResult && maxIdResult.length > 0 ? maxIdResult[0].id + 1 : 1;
      console.log(`[MEMBER-POST] Generated member ID: ${memberId}`);
    }

    // Insert member data with the generated or provided ID
    console.log(`[MEMBER-POST] Inserting member data:`, {
      id: memberId,
      name: data.name,
      points: data.points || 0,
      books_read: data.books_read || 0
    });

    const { data: memberData, error: memberError } = await supabaseClient
      .from("members")
      .insert({
        id: memberId,
        name: data.name,
        points: data.points || 0,
        books_read: data.books_read || 0
      })
      .select()

    console.log(`[MEMBER-POST] Member insert result:`, {
      success: !!memberData,
      error: memberError?.message,
      member: memberData?.[0] ? {
        id: memberData[0].id,
        name: memberData[0].name
      } : null
    });

    if (memberError) {
      console.log(`[MEMBER-POST] Member insert failed - returning 500`);
      return errorResponse(memberError.message, 500)
    }

    // Get the inserted member's ID
    const newMemberId = memberData[0].id;
    console.log(`[MEMBER-POST] New member created with ID: ${newMemberId}`);

    // Associate member with clubs
    if (data.clubs && data.clubs.length > 0) {
      console.log(`[MEMBER-POST] Processing ${data.clubs.length} club associations:`, data.clubs);

      // Verify all club IDs exist
      const { data: existingClubs, error: clubsError } = await supabaseClient
        .from("clubs")
        .select("id")
        .in("id", data.clubs)

      console.log(`[MEMBER-POST] Club verification result:`, {
        requested_count: data.clubs.length,
        found_count: existingClubs?.length || 0,
        error: clubsError?.message,
        found_clubs: existingClubs?.map(c => c.id) || []
      });

      if (clubsError) {
        console.log(`[MEMBER-POST] Club verification failed - returning partial success`);
        return new Response(
          JSON.stringify({
            error: clubsError.message,
            partial_success: true,
            message: "Member created but failed to verify clubs",
            member: memberData[0]
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            },
            status: 500
          }
        )
      }

      // Check if all club IDs exist
      const existingClubIds = existingClubs.map(c => c.id);
      const nonExistentClubs = data.clubs.filter((id: string) => !existingClubIds.includes(id));

      console.log(`[MEMBER-POST] Club validation:`, {
        existing_clubs: existingClubIds,
        non_existent_clubs: nonExistentClubs
      });

      if (nonExistentClubs.length > 0) {
        console.log(`[MEMBER-POST] Some clubs don't exist - returning partial success`);
        return new Response(
          JSON.stringify({
            error: `The following clubs do not exist: ${nonExistentClubs.join(', ')}`,
            partial_success: true,
            message: "Member created but not associated with all clubs",
            member: memberData[0]
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

      // Insert club associations
      const memberClubData = data.clubs.map((clubId: string) => ({
        member_id: newMemberId,
        club_id: clubId
      }));

      console.log(`[MEMBER-POST] Inserting ${memberClubData.length} club associations:`, memberClubData);

      const { error: associationError } = await supabaseClient
        .from("memberclubs")
        .insert(memberClubData)

      console.log(`[MEMBER-POST] Club associations insert result:`, {
        success: !associationError,
        error: associationError?.message
      });

      if (associationError) {
        console.log(`[MEMBER-POST] Club associations failed - returning partial success`);
        return new Response(
          JSON.stringify({
            error: associationError.message,
            partial_success: true,
            message: "Member created but failed to associate with clubs",
            member: memberData[0]
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            },
            status: 500
          }
        )
      }
    } else {
      console.log(`[MEMBER-POST] No club associations to process`);
    }

    const responseData = {
      success: true,
      message: "Member created successfully",
      member: {
        ...memberData[0],
        clubs: data.clubs || []
      }
    };

    console.log(`[MEMBER-POST] Member creation completed successfully:`, {
      member_id: responseData.member.id,
      member_name: responseData.member.name,
      clubs_associated: responseData.member.clubs.length
    });

    return successResponse(responseData)

  } catch (error) {
    console.log(`[MEMBER-POST] ERROR: ${(error as Error).message}`);
    return errorResponse((error as Error).message, 500)
  }
}
