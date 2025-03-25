// supabase/functions/member/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Determine which operation to perform based on HTTP method
    switch (req.method) {
      case 'GET':
        return await handleGetMember(req, supabaseClient);
      case 'POST':
        return await handleCreateMember(req, supabaseClient);
      case 'PUT':
        return await handleUpdateMember(req, supabaseClient);
      case 'DELETE':
        return await handleDeleteMember(req, supabaseClient);
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { headers: { 'Content-Type': 'application/json' }, status: 405 }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

/**
 * Handles GET requests to retrieve member details
 */
async function handleGetMember(req, supabaseClient) {
  try {
    // Get URL parameters
    const url = new URL(req.url);
    const memberId = url.searchParams.get('id');

    if (!memberId) {
      return new Response(
        JSON.stringify({ error: 'Member ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get member data
    const { data: memberData, error: memberError } = await supabaseClient
      .from("members")
      .select("*")
      .eq("id", memberId)
      .single()

    if (memberError || !memberData) {
      return new Response(
        JSON.stringify({ error: memberError?.message || 'Member not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Get clubs this member belongs to
    const { data: memberClubs, error: memberClubsError } = await supabaseClient
      .from("memberclubs")
      .select("club_id")
      .eq("member_id", memberId)

    if (memberClubsError) {
      return new Response(
        JSON.stringify({ error: memberClubsError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get club details
    const clubIds = memberClubs.map(mc => mc.club_id);
    let clubs = [];
    
    if (clubIds.length > 0) {
      const { data: clubsData, error: clubsError } = await supabaseClient
        .from("clubs")
        .select("id, name")
        .in("id", clubIds)

      if (clubsError) {
        return new Response(
          JSON.stringify({ error: clubsError.message }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }
      
      clubs = clubsData;
    }

    // Get shame list entries for this member
    const { data: shameData, error: shameError } = await supabaseClient
      .from("shamelist")
      .select("session_id")
      .eq("member_id", memberId)

    if (shameError) {
      return new Response(
        JSON.stringify({ error: shameError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get session details for shame list
    const shameSessionIds = shameData.map(s => s.session_id);
    let shameSessions = [];
    
    if (shameSessionIds.length > 0) {
      const { data: sessionsData, error: sessionsError } = await supabaseClient
        .from("sessions")
        .select(`
          id,
          duedate,
          club_id,
          books (
            title,
            author
          )
        `)
        .in("id", shameSessionIds)

      if (sessionsError) {
        return new Response(
          JSON.stringify({ error: sessionsError.message }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }
      
      shameSessions = sessionsData.map(session => ({
        id: session.id,
        duedate: session.duedate,
        club_id: session.club_id,
        book: session.books
      }));
    }

    // Return the member with associated data
    return new Response(
      JSON.stringify({
        id: memberData.id,
        name: memberData.name,
        points: memberData.points,
        numberofbooksread: memberData.numberofbooksread,
        clubs: clubs,
        shameSessions: shameSessions
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}

/**
 * Handles POST requests to create a new member
 */
async function handleCreateMember(req, supabaseClient) {
  try {
    // Get the request body
    const data = await req.json()

    // Validate required fields
    if (!data.name) {
      return new Response(
        JSON.stringify({ error: 'Member name is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (data.clubs && (!Array.isArray(data.clubs) || data.clubs.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'The clubs field must be an array with at least one club ID' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if member ID is provided, otherwise use an auto-incrementing ID
    const memberId = data.id || undefined;

    // Insert member data
    const { data: memberData, error: memberError } = await supabaseClient
      .from("members")
      .insert({
        id: memberId,
        name: data.name,
        points: data.points || 0,
        numberofbooksread: data.numberOfBooksRead || 0
      })
      .select()

    if (memberError) {
      return new Response(
        JSON.stringify({ error: memberError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get the inserted member's ID
    const newMemberId = memberData[0].id;

    // Associate member with clubs
    if (data.clubs && data.clubs.length > 0) {
      // Verify all club IDs exist
      const { data: existingClubs, error: clubsError } = await supabaseClient
        .from("clubs")
        .select("id")
        .in("id", data.clubs)

      if (clubsError) {
        return new Response(
          JSON.stringify({ 
            error: clubsError.message,
            partialSuccess: true,
            message: "Member created but failed to verify clubs",
            member: memberData[0]
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Check if all club IDs exist
      const existingClubIds = existingClubs.map(c => c.id);
      const nonExistentClubs = data.clubs.filter(id => !existingClubIds.includes(id));
      
      if (nonExistentClubs.length > 0) {
        return new Response(
          JSON.stringify({ 
            error: `The following clubs do not exist: ${nonExistentClubs.join(', ')}`,
            partialSuccess: true,
            message: "Member created but not associated with all clubs",
            member: memberData[0]
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Insert club associations
      const memberClubData = data.clubs.map(clubId => ({
        member_id: newMemberId,
        club_id: clubId
      }));

      const { error: associationError } = await supabaseClient
        .from("memberclubs")
        .insert(memberClubData)

      if (associationError) {
        return new Response(
          JSON.stringify({ 
            error: associationError.message,
            partialSuccess: true,
            message: "Member created but failed to associate with clubs",
            member: memberData[0]
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Member created successfully",
        member: {
          ...memberData[0],
          clubs: data.clubs || []
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}

/**
 * Handles PUT requests to update an existing member
 */
async function handleUpdateMember(req, supabaseClient) {
  try {
    // Get the request body
    const data = await req.json()

    // Validate required fields
    if (!data.id) {
      return new Response(
        JSON.stringify({ error: 'Member ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if member exists
    const { data: existingMember, error: checkError } = await supabaseClient
      .from("members")
      .select("id")
      .eq("id", data.id)
      .single()

    if (checkError || !existingMember) {
      return new Response(
        JSON.stringify({ error: 'Member not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Build update object with only the fields that should be updated
    const updateData = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.points !== undefined) updateData.points = data.points
    if (data.numberOfBooksRead !== undefined) updateData.numberOfBooksRead = data.numberOfBooksRead

    let updatedMember = { id: data.id };
    let clubsUpdated = false;

    // Update member data if there are fields to update
    if (Object.keys(updateData).length > 0) {
      const { data: memberData, error: updateError } = await supabaseClient
        .from("members")
        .update(updateData)
        .eq("id", data.id)
        .select()

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      updatedMember = memberData[0];
    }

    // Handle club associations if provided
    if (data.clubs !== undefined) {
      if (!Array.isArray(data.clubs)) {
        return new Response(
          JSON.stringify({ 
            error: 'Clubs must be an array',
            partialSuccess: Object.keys(updateData).length > 0,
            message: "Some member fields updated but clubs not modified",
            member: updatedMember
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Get existing club associations
      const { data: existingAssociations, error: getError } = await supabaseClient
        .from("memberclubs")
        .select("club_id")
        .eq("member_id", data.id)

      if (getError) {
        return new Response(
          JSON.stringify({ 
            error: getError.message,
            partialSuccess: Object.keys(updateData).length > 0,
            message: "Member updated but failed to retrieve existing club associations",
            member: updatedMember
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      const existingClubIds = existingAssociations.map(a => a.club_id);
      
      // Clubs to add (in new list but not in existing)
      const clubsToAdd = data.clubs.filter(id => !existingClubIds.includes(id));
      
      // Clubs to remove (in existing but not in new list)
      const clubsToRemove = existingClubIds.filter(id => !data.clubs.includes(id));

      // Add new associations
      if (clubsToAdd.length > 0) {
        // Verify all club IDs exist
        const { data: validClubs, error: verifyError } = await supabaseClient
          .from("clubs")
          .select("id")
          .in("id", clubsToAdd)

        if (verifyError) {
          return new Response(
            JSON.stringify({ 
              error: verifyError.message,
              partialSuccess: Object.keys(updateData).length > 0,
              message: "Member updated but failed to verify club IDs",
              member: updatedMember
            }),
            { headers: { 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        const validClubIds = validClubs.map(c => c.id);
        const invalidClubs = clubsToAdd.filter(id => !validClubIds.includes(id));
        
        if (invalidClubs.length > 0) {
          return new Response(
            JSON.stringify({ 
              error: `The following clubs do not exist: ${invalidClubs.join(', ')}`,
              partialSuccess: Object.keys(updateData).length > 0,
              message: "Member updated but clubs not completely modified",
              member: updatedMember
            }),
            { headers: { 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // Add new associations
        const newAssociations = validClubIds.map(clubId => ({
          member_id: data.id,
          club_id: clubId
        }));

        if (newAssociations.length > 0) {
          const { error: addError } = await supabaseClient
            .from("memberclubs")
            .insert(newAssociations)

          if (addError) {
            return new Response(
              JSON.stringify({ 
                error: addError.message,
                partialSuccess: Object.keys(updateData).length > 0,
                message: "Member updated but failed to add new club associations",
                member: updatedMember
              }),
              { headers: { 'Content-Type': 'application/json' }, status: 500 }
            )
          }
          
          clubsUpdated = true;
        }
      }

      // Remove old associations
      if (clubsToRemove.length > 0) {
        const { error: removeError } = await supabaseClient
          .from("memberclubs")
          .delete()
          .eq("member_id", data.id)
          .in("club_id", clubsToRemove)

        if (removeError) {
          return new Response(
            JSON.stringify({ 
              error: removeError.message,
              partialSuccess: Object.keys(updateData).length > 0 || clubsToAdd.length > 0,
              message: "Member updated but failed to remove some club associations",
              member: updatedMember
            }),
            { headers: { 'Content-Type': 'application/json' }, status: 500 }
          )
        }
        
        clubsUpdated = true;
      }
    }

    // If nothing was updated
    if (Object.keys(updateData).length === 0 && !clubsUpdated) {
      return new Response(
        JSON.stringify({ message: "No changes to apply" }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Member updated successfully",
        member: updatedMember,
        clubsUpdated: clubsUpdated
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}

/**
 * Handles DELETE requests to remove a member
 */
async function handleDeleteMember(req, supabaseClient) {
  try {
    // Get URL parameters
    const url = new URL(req.url);
    const memberId = url.searchParams.get('id');

    if (!memberId) {
      return new Response(
        JSON.stringify({ error: 'Member ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if member exists
    const { data: existingMember, error: checkError } = await supabaseClient
      .from("members")
      .select("id")
      .eq("id", memberId)
      .single()

    if (checkError || !existingMember) {
      return new Response(
        JSON.stringify({ error: 'Member not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Delete from shame list first
    const { error: shameError } = await supabaseClient
      .from("shamelist")
      .delete()
      .eq("member_id", memberId)

    if (shameError) {
      return new Response(
        JSON.stringify({ error: `Failed to delete from shame list: ${shameError.message}` }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Delete club associations
    const { error: associationError } = await supabaseClient
      .from("memberclubs")
      .delete()
      .eq("member_id", memberId)

    if (associationError) {
      return new Response(
        JSON.stringify({ error: `Failed to delete club associations: ${associationError.message}` }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Delete the member
    const { error: deleteError } = await supabaseClient
      .from("members")
      .delete()
      .eq("id", memberId)

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Member deleted successfully" 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}