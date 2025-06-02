// supabase/functions/club/index.ts
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
        return await handleGetClub(req, supabaseClient);
      case 'POST':
        return await handleCreateClub(req, supabaseClient);
      case 'PUT':
        return await handleUpdateClub(req, supabaseClient);
      case 'DELETE':
        return await handleDeleteClub(req, supabaseClient);
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
 * Handles GET requests to retrieve club details
 */
async function handleGetClub(req, supabaseClient) {
  try {
    // Get URL parameters
    const url = new URL(req.url);
    const clubId = url.searchParams.get('id');

    if (!clubId) {
      return new Response(
        JSON.stringify({ error: 'Club ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get club data
    const { data: clubData, error: clubError } = await supabaseClient
      .from("clubs")
      .select("*")
      .eq("id", clubId)
      .single()

    if (clubError || !clubData) {
      return new Response(
        JSON.stringify({ error: clubError?.message || 'Club not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Get all members associated with this club
    const { data: memberClubsData, error: memberClubsError } = await supabaseClient
      .from("memberclubs")
      .select("member_id")
      .eq("club_id", clubId)

    if (memberClubsError) {
      return new Response(
        JSON.stringify({ error: memberClubsError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // If no members, return the club with empty members array
    if (!memberClubsData.length) {
      return new Response(
        JSON.stringify({
          id: clubData.id,
          name: clubData.name,
          discord_channel: clubData.discord_channel,
          members: [],
          active_session: null,
          past_sessions: [],
          shame_list: []
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Extract member IDs
    const memberIds = memberClubsData.map(mc => mc.member_id)

    // Get member details
    const { data: membersData, error: membersError } = await supabaseClient
      .from("members")
      .select("*")
      .in("id", memberIds)

    if (membersError) {
      return new Response(
        JSON.stringify({ error: membersError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get club memberships for each member
    const membersWithClubs = await Promise.all(
      membersData.map(async (member) => {
        const { data: memberClubs } = await supabaseClient
          .from("memberclubs")
          .select("club_id")
          .eq("member_id", member.id)

        return {
          id: member.id,
          name: member.name,
          points: member.points,
          books_read: member.books_read,
          clubs: memberClubs?.map(mc => mc.club_id) || []
        }
      })
    )

    // Get active session for this club
    const { data: sessionsData, error: sessionsError } = await supabaseClient
      .from("sessions")
      .select("*")
      .eq("club_id", clubId)
      .order('due_date', { ascending: false })
      .limit(1)

    if (sessionsError) {
      return new Response(
        JSON.stringify({ error: sessionsError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    let active_session = null
    if (sessionsData.length > 0) {
      const session = sessionsData[0]

      // Get book for this session
      const { data: bookData, error: bookError } = await supabaseClient
        .from("books")
        .select("*")
        .eq("id", session.book_id)
        .single()

      if (bookError) {
        return new Response(
          JSON.stringify({ error: bookError.message }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Get discussions for this session
      const { data: discussionsData, error: discussionsError } = await supabaseClient
        .from("discussions")
        .select("*")
        .eq("session_id", session.id)

      if (discussionsError) {
        return new Response(
          JSON.stringify({ error: discussionsError.message }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Get shame list - now directly from the club, not from session
      const { data: shame_list_data } = await supabaseClient
        .from("shamelist")
        .select("member_id")
        .eq("club_id", clubId)

      active_session = {
        id: session.id,
        club_id: session.club_id,
        book: {
          title: bookData.title,
          author: bookData.author,
          edition: bookData.edition,
          year: bookData.year,
          isbn: bookData.isbn
        },
        due_date: session.due_date,
        discussions: discussionsData?.map(discussion => ({
          id: discussion.id,
          session_id: discussion.session_id,
          title: discussion.title,
          date: discussion.date,
          location: discussion.location
        })) || []
      }
    }

    // Get past sessions (skip the active one if it exists)
    const { data: past_sessions_data } = await supabaseClient
      .from("sessions")
      .select("id, due_date")
      .eq("club_id", clubId)
      .order('due_date', { ascending: false })
      .range(active_session ? 1 : 0, 10)

    const past_sessions = past_sessions_data || []

    // Get shame list for the club
    const { data: shame_list_data, error: shame_list_error } = await supabaseClient
      .from("shamelist")
      .select("member_id")
      .eq("club_id", clubId)

    if (shame_list_error) {
      return new Response(
        JSON.stringify({ error: shame_list_error.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const shame_list = shame_list_data?.map(item => item.member_id) || []

    // Get shame list for the club
    const { data: shameListData, error: shameListError } = await supabaseClient
      .from("shamelist")
      .select("member_id")
      .eq("club_id", clubId)

    if (shameListError) {
      return new Response(
        JSON.stringify({ error: shameListError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const shameList = shameListData?.map(item => item.member_id) || []

    // Return the full reconstructed club data
    return new Response(
      JSON.stringify({
        id: clubData.id,
        name: clubData.name,
        discord_channel: clubData.discord_channel,
        members: membersWithClubs,
        active_session: active_session,
        past_sessions: past_sessions,
        shame_list: shame_list
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
 * Handles POST requests to create a new club
 */
async function handleCreateClub(req, supabaseClient) {
  try {
    // Get the request body
    const data = await req.json()

    // Validate required fields
    if (!data.name) {
      return new Response(
        JSON.stringify({ error: 'Club name is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Generate a unique ID if not provided
    if (!data.id) {
      data.id = crypto.randomUUID()
    }

    // Insert club data
    const { data: clubData, error: clubError } = await supabaseClient
      .from("clubs")
      .insert({
        id: data.id,
        name: data.name,
        discord_channel: data.discord_channel || null
      })
      .select()

    if (clubError) {
      return new Response(
        JSON.stringify({ error: clubError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Handle optional members array
    if (data.members && Array.isArray(data.members) && data.members.length > 0) {
      // Insert each member
      for (const member of data.members) {
        // Validate member data
        if (!member.id || !member.name) {
          continue; // Skip invalid members
        }

        // Insert member
        const { error: memberError } = await supabaseClient
          .from("members")
          .upsert({
            id: member.id,
            name: member.name,
            points: member.points || 0,
            books_read: member.books_read || 0
          })

        if (memberError) {
          console.error(`Error adding member ${member.id}: ${memberError.message}`)
          continue
        }

        // Link member to club
        const { error: linkError } = await supabaseClient
          .from("memberclubs")
          .insert({
            member_id: member.id,
            club_id: data.id
          })

        if (linkError) {
          console.error(`Error linking member ${member.id} to club: ${linkError.message}`)
        }
      }
    }

    // Handle optional active_session
    if (data.active_session) {
      const session = data.active_session
      const book = session.book

      // Check required fields
      if (!session.id || !book || !book.title || !book.author) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Club created successfully but session data was incomplete",
            club: clubData[0]
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Insert book
      const { data: bookData, error: bookError } = await supabaseClient
        .from("books")
        .insert({
          title: book.title,
          author: book.author,
          edition: book.edition || null,
          year: book.year || null,
          isbn: book.isbn || null
        })
        .select()

      if (bookError) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Club created but failed to add book: " + bookError.message,
            club: clubData[0]
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Insert session
      const { error: sessionError } = await supabaseClient
        .from("sessions")
        .insert({
          id: session.id,
          club_id: data.id,
          book_id: bookData[0].id,
          due_date: session.due_date || null
        })

      if (sessionError) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Club created but failed to add session: " + sessionError.message,
            club: clubData[0]
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Add discussions if provided
      if (session.discussions && Array.isArray(session.discussions)) {
        for (const discussion of session.discussions) {
          if (!discussion.id || !discussion.title || !discussion.date) {
            continue; // Skip invalid discussions
          }

          const { error: discussionError } = await supabaseClient
            .from("discussions")
            .insert({
              id: discussion.id,
              session_id: session.id,
              title: discussion.title,
              date: discussion.date,
              location: discussion.location || null
            })

          if (discussionError) {
            console.error(`Error adding discussion: ${discussionError.message}`)
          }
        }
      }
    }

    // Handle optional shame_list - now directly connected to the club
    if (data.shame_list && Array.isArray(data.shame_list) && data.shame_list.length > 0) {
      for (const memberId of data.shame_list) {
        // Verify member exists
        const { data: memberExists, error: memberError } = await supabaseClient
          .from("members")
          .select("id")
          .eq("id", memberId)
          .single()

        if (memberError || !memberExists) {
          console.error(`Member ID ${memberId} not found for shame list`)
          continue
        }

        // Add to shame list
        const { error: shameError } = await supabaseClient
          .from("shamelist")
          .insert({
            club_id: data.id,
            member_id: memberId
          })

        if (shameError) {
          console.error(`Error adding member ${memberId} to shame list: ${shameError.message}`)
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Club created successfully",
        club: clubData[0]
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
 * Handles PUT requests to update an existing club
 */
async function handleUpdateClub(req, supabaseClient) {
  try {
    // Get the request body
    const data = await req.json()

    // Validate required fields
    if (!data.id) {
      return new Response(
        JSON.stringify({ error: 'Club ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Build update object with only the fields that should be updated
    const updateData = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.discord_channel !== undefined) updateData.discord_channel = data.discord_channel

    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No fields to update' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if club exists
    const { data: existingClub, error: checkError } = await supabaseClient
      .from("clubs")
      .select("id")
      .eq("id", data.id)
      .single()

    if (checkError || !existingClub) {
      return new Response(
        JSON.stringify({ error: 'Club not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Update club
    const { data: clubData, error: updateError } = await supabaseClient
      .from("clubs")
      .update(updateData)
      .eq("id", data.id)
      .select()

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Handle shame_list updates if provided
    let shame_list_updated = false
    if (data.shame_list !== undefined) {
      if (!Array.isArray(data.shame_list)) {
        return new Response(
          JSON.stringify({ 
            error: 'Shame list must be an array',
            partial_success: true,
            message: "Club was updated but shame list was not modified",
            club: clubData[0]
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Get current shame list
      const { data: current_shame_list, error: get_shame_error } = await supabaseClient
        .from("shamelist")
        .select("member_id")
        .eq("club_id", data.id)

      if (get_shame_error) {
        return new Response(
          JSON.stringify({ 
            error: get_shame_error.message,
            partial_success: true,
            message: "Club was updated but could not retrieve shame list",
            club: clubData[0]
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      const current_member_ids = current_shame_list.map(item => item.member_id);
      
      // Members to add (in new list but not in current)
      const members_to_add = data.shame_list.filter(id => !current_member_ids.includes(id));
      
      // Members to remove (in current but not in new list)
      const members_to_remove = current_member_ids.filter(id => !data.shame_list.includes(id));

      // Add new members to shame list
      if (members_to_add.length > 0) {
        for (const memberId of members_to_add) {
          // Verify member exists
          const { data: memberExists, error: memberError } = await supabaseClient
            .from("members")
            .select("id")
            .eq("id", memberId)
            .single()

          if (memberError || !memberExists) {
            console.error(`Member ID ${memberId} not found for shame list`)
            continue
          }

          // Add to shame list
          const { error: shameError } = await supabaseClient
            .from("shamelist")
            .insert({
              club_id: data.id,
              member_id: memberId
            })

          if (shameError) {
            console.error(`Error adding member ${memberId} to shame list: ${shameError.message}`)
          } else {
            shame_list_updated = true
          }
        }
      }

      // Remove members from shame list
      if (members_to_remove.length > 0) {
        const { error: removeError } = await supabaseClient
          .from("shamelist")
          .delete()
          .eq("club_id", data.id)
          .in("member_id", members_to_remove)

        if (removeError) {
          console.error(`Error removing members from shame list: ${removeError.message}`)
        } else if (members_to_remove.length > 0) {
          shame_list_updated = true
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Club updated successfully",
        club: clubData[0],
        shame_list_updated: shame_list_updated
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
 * Handles DELETE requests to remove a club
 */
async function handleDeleteClub(req, supabaseClient) {
  try {
    // Get URL parameters
    const url = new URL(req.url);
    const clubId = url.searchParams.get('id');

    if (!clubId) {
      return new Response(
        JSON.stringify({ error: 'Club ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if club exists
    const { data: existingClub, error: checkError } = await supabaseClient
      .from("clubs")
      .select("id")
      .eq("id", clubId)
      .single()

    if (checkError || !existingClub) {
      return new Response(
        JSON.stringify({ error: 'Club not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Get sessions to cascade delete
    const { data: sessions } = await supabaseClient
      .from("sessions")
      .select("id")
      .eq("club_id", clubId)

    const sessionIds = sessions?.map(s => s.id) || []

    // Start transaction (sequential operations that should be atomic)
    
    // 1. Delete discussions for any sessions in this club
    if (sessionIds.length > 0) {
      const { error: discussionError } = await supabaseClient
        .from("discussions")
        .delete()
        .in("session_id", sessionIds)

      if (discussionError) {
        return new Response(
          JSON.stringify({ error: `Failed to delete discussions: ${discussionError.message}` }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // 2. Delete sessions
      const { error: sessionError } = await supabaseClient
        .from("sessions")
        .delete()
        .eq("club_id", clubId)

      if (sessionError) {
        return new Response(
          JSON.stringify({ error: `Failed to delete sessions: ${sessionError.message}` }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    }

    // 3. Delete shame list entries for this club
    const { error: shame_list_error } = await supabaseClient
      .from("shamelist")
      .delete()
      .eq("club_id", clubId)

    if (shame_list_error) {
      return new Response(
        JSON.stringify({ error: `Failed to delete shame list entries: ${shame_list_error.message}` }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 4. Delete member club associations
    const { error: memberClubError } = await supabaseClient
      .from("memberclubs")
      .delete()
      .eq("club_id", clubId)

    if (memberClubError) {
      return new Response(
        JSON.stringify({ error: `Failed to delete member associations: ${memberClubError.message}` }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 5. Finally delete the club
    const { error: deleteError } = await supabaseClient
      .from("clubs")
      .delete()
      .eq("id", clubId)

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Club deleted successfully" 
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