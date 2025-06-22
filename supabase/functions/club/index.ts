// supabase/functions/club/index.ts - Updated with CORS support
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

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
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }, 
            status: 405 
          }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }, 
        status: 500 
      }
    )
  }
})

/**
 * Helper function to validate server exists
 */
async function validateServer(supabaseClient, serverId) {
  const { data: serverData, error: serverError } = await supabaseClient
    .from("servers")
    .select("id")
    .eq("id", serverId)
    .single()

  if (serverError || !serverData) {
    return { valid: false, error: 'Server not found or not registered' };
  }
  
  return { valid: true };
}

/**
 * Handles GET requests to retrieve club details
 */
async function handleGetClub(req, supabaseClient) {
  try {
    console.log(`[CLUB-GET] === New GET request received ===`);
    
    // Get URL parameters
    const url = new URL(req.url);
    const clubId = url.searchParams.get('id');
    const serverId = url.searchParams.get('server_id');
    const discordChannel = url.searchParams.get('discord_channel');

    console.log(`[CLUB-GET] Request parameters:`, { clubId, serverId, discordChannel });

    // Search by discord_channel
    if (discordChannel) {
      console.log(`[CLUB-GET] Searching by discord_channel: "${discordChannel}"`);
      
      if (!serverId) {
        console.log(`[CLUB-GET] Missing server_id for discord_channel search - returning 400`);
        return new Response(
          JSON.stringify({ error: 'Server ID is required when searching by discord_channel' }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }, 
            status: 400 
          }
        );
      }

      // Validate server exists
      console.log(`[CLUB-GET] Validating server: "${serverId}"`);
      const serverValidation = await validateServer(supabaseClient, serverId);
      console.log(`[CLUB-GET] Server validation result:`, serverValidation);
      
      if (!serverValidation.valid) {
        console.log(`[CLUB-GET] Server validation failed - returning 404`);
        return new Response(
          JSON.stringify({ error: serverValidation.error }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }, 
            status: 404 
          }
        );
      }

      // Find club by discord_channel and server_id
      console.log(`[CLUB-GET] Searching for club with discord_channel: "${discordChannel}" and server_id: "${serverId}"`);
      const { data: clubData, error: clubError } = await supabaseClient
        .from("clubs")
        .select("*")
        .eq("discord_channel", discordChannel)
        .eq("server_id", serverId)
        .single()

      console.log(`[CLUB-GET] Discord channel search result:`, { found: !!clubData, error: clubError?.message });

      if (clubError || !clubData) {
        console.log(`[CLUB-GET] Club not found by discord_channel - returning 404`);
        return new Response(
          JSON.stringify({ 
            error: clubError?.message || 'Club not found with this discord channel in the specified server' 
          }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }, 
            status: 404 
          }
        )
      }

      console.log(`[CLUB-GET] Found club by discord_channel: "${clubData.id}" - getting full details`);
      // Use the found club's ID to get full club details
      return await getFullClubDetails(supabaseClient, clubData.id, serverId);
    }

    // Original logic for ID-based search
    console.log(`[CLUB-GET] Searching by club ID`);
    
    if (!clubId) {
      console.log(`[CLUB-GET] Missing club_id - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Club ID is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      );
    }

    if (!serverId) {
      console.log(`[CLUB-GET] Missing server_id - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Server ID is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      );
    }

    // Validate server exists
    console.log(`[CLUB-GET] Validating server: "${serverId}"`);
    const serverValidation = await validateServer(supabaseClient, serverId);
    console.log(`[CLUB-GET] Server validation result:`, serverValidation);
    
    if (!serverValidation.valid) {
      console.log(`[CLUB-GET] Server validation failed - returning 404`);
      return new Response(
        JSON.stringify({ error: serverValidation.error }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 404 
        }
      );
    }

    console.log(`[CLUB-GET] Getting full club details for ID: "${clubId}"`);
    return await getFullClubDetails(supabaseClient, clubId, serverId);
    
  } catch (error) {
    console.log(`[CLUB-GET] ERROR: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }, 
        status: 500 
      }
    )
  }
}

/**
 * Helper function to get full club details by club ID and server ID
 */
async function getFullClubDetails(supabaseClient, clubId, serverId) {
  console.log(`[CLUB-GET] Starting getFullClubDetails - clubId: "${clubId}", serverId: "${serverId}"`);
  
  // Get club data with server verification
  console.log(`[CLUB-GET] Querying club table for id: "${clubId}" and server_id: "${serverId}"`);
  const { data: clubData, error: clubError } = await supabaseClient
    .from("clubs")
    .select("*")
    .eq("id", clubId)
    .eq("server_id", serverId)
    .single()

  console.log(`[CLUB-GET] Club query result:`, { found: !!clubData, error: clubError?.message });

  if (clubError || !clubData) {
    console.log(`[CLUB-GET] Club not found - returning 404`);
    return new Response(
      JSON.stringify({ error: clubError?.message || 'Club not found in this server' }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }, 
        status: 404 
      }
    )
  }

  // Get all members associated with this club
  console.log(`[CLUB-GET] Querying memberclubs for club_id: "${clubId}"`);
  const { data: memberClubsData, error: memberClubsError } = await supabaseClient
    .from("memberclubs")
    .select("member_id")
    .eq("club_id", clubId)

  console.log(`[CLUB-GET] MemberClubs query result:`, { count: memberClubsData?.length || 0, error: memberClubsError?.message });

  if (memberClubsError) {
    console.log(`[CLUB-GET] MemberClubs query failed - returning 500`);
    return new Response(
      JSON.stringify({ error: memberClubsError.message }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }, 
        status: 500 
      }
    )
  }

  // If no members, return the club with empty members array
  if (!memberClubsData.length) {
    console.log(`[CLUB-GET] No members found - returning minimal club data`);
    return new Response(
      JSON.stringify({
        id: clubData.id,
        name: clubData.name,
        discord_channel: clubData.discord_channel,
        server_id: clubData.server_id,
        members: [],
        active_session: null,
        past_sessions: [],
        shame_list: []
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
  }

  // Extract member IDs
  const memberIds = memberClubsData.map(mc => mc.member_id)
  console.log(`[CLUB-GET] Found member IDs:`, memberIds);

  // Get member details
  console.log(`[CLUB-GET] Querying members table for IDs:`, memberIds);
  const { data: membersData, error: membersError } = await supabaseClient
    .from("members")
    .select("*")
    .in("id", memberIds)

  console.log(`[CLUB-GET] Members query result:`, { count: membersData?.length || 0, error: membersError?.message });

  if (membersError) {
    console.log(`[CLUB-GET] Members query failed - returning 500`);
    return new Response(
      JSON.stringify({ error: membersError.message }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }, 
        status: 500 
      }
    )
  }

  // Get club memberships for each member
  console.log(`[CLUB-GET] Building member details with club associations...`);
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
  console.log(`[CLUB-GET] Querying sessions for club_id: "${clubId}" (type: ${typeof clubId})`);
  const { data: sessionsData, error: sessionsError } = await supabaseClient
    .from("sessions")
    .select("*")
    .eq("club_id", clubId)
    .order('due_date', { ascending: false })
    .limit(1)

  console.log(`[CLUB-GET] Sessions query result:`, { 
    count: sessionsData?.length || 0, 
    error: sessionsError?.message,
    sessions: sessionsData?.map(s => ({ id: s.id, club_id: s.club_id, due_date: s.due_date })) || []
  });

  // Let's also check what sessions exist for debugging
  const { data: allSessions } = await supabaseClient
    .from("sessions")
    .select("id, club_id, due_date")

  console.log(`[CLUB-GET] All sessions in database:`, allSessions?.map(s => ({ 
    id: s.id, 
    club_id: s.club_id, 
    club_id_type: typeof s.club_id,
    due_date: s.due_date 
  })) || []);

  if (sessionsError) {
    console.log(`[CLUB-GET] Sessions query failed - returning 500`);
    return new Response(
      JSON.stringify({ error: sessionsError.message }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }, 
        status: 500 
      }
    )
  }

  let active_session = null
  if (sessionsData.length > 0) {
    console.log(`[CLUB-GET] Found active session - building session details...`);
    const session = sessionsData[0]

    // Get book for this session
    console.log(`[CLUB-GET] Querying book for book_id: ${session.book_id}`);
    const { data: bookData, error: bookError } = await supabaseClient
      .from("books")
      .select("*")
      .eq("id", session.book_id)
      .single()

    console.log(`[CLUB-GET] Book query result:`, { found: !!bookData, error: bookError?.message });

    if (bookError) {
      console.log(`[CLUB-GET] Book query failed - returning 500`);
      return new Response(
        JSON.stringify({ error: bookError.message }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    // Get discussions for this session
    console.log(`[CLUB-GET] Querying discussions for session_id: ${session.id}`);
    const { data: discussionsData, error: discussionsError } = await supabaseClient
      .from("discussions")
      .select("*")
      .eq("session_id", session.id)

    console.log(`[CLUB-GET] Discussions query result:`, { count: discussionsData?.length || 0, error: discussionsError?.message });

    if (discussionsError) {
      console.log(`[CLUB-GET] Discussions query failed - returning 500`);
      return new Response(
        JSON.stringify({ error: discussionsError.message }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

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
    console.log(`[CLUB-GET] Active session built:`, { id: active_session.id, book_title: active_session.book.title });
  } else {
    console.log(`[CLUB-GET] No active session found`);
  }

  // Get past sessions (skip the active one if it exists)
  console.log(`[CLUB-GET] Querying past sessions...`);
  const { data: past_sessions_data } = await supabaseClient
    .from("sessions")
    .select("id, due_date")
    .eq("club_id", clubId)
    .order('due_date', { ascending: false })
    .range(active_session ? 1 : 0, 10)

  const past_sessions = past_sessions_data || []
  console.log(`[CLUB-GET] Past sessions found:`, past_sessions.length);

  // Get shame list for the club
  console.log(`[CLUB-GET] Querying shame list for club_id: "${clubId}"`);
  const { data: shame_list_data, error: shame_list_error } = await supabaseClient
    .from("shamelist")
    .select("member_id")
    .eq("club_id", clubId)

  console.log(`[CLUB-GET] Shame list query result:`, { count: shame_list_data?.length || 0, error: shame_list_error?.message });

  if (shame_list_error) {
    console.log(`[CLUB-GET] Shame list query failed - returning 500`);
    return new Response(
      JSON.stringify({ error: shame_list_error.message }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }, 
        status: 500 
      }
    )
  }

  const shame_list = shame_list_data?.map(item => item.member_id) || []

  // Build final response
  const response_data = {
    id: clubData.id,
    name: clubData.name,
    discord_channel: clubData.discord_channel,
    server_id: clubData.server_id,
    members: membersWithClubs,
    active_session: active_session,
    past_sessions: past_sessions,
    shame_list: shame_list
  };

  console.log(`[CLUB-GET] Final response summary:`, {
    club_name: response_data.name,
    member_count: response_data.members.length,
    has_active_session: !!response_data.active_session,
    past_sessions_count: response_data.past_sessions.length,
    shame_list_count: response_data.shame_list.length
  });

  // Return the full reconstructed club data
  return new Response(
    JSON.stringify(response_data),
    { 
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      } 
    }
  )
}

/**
 * Handles POST requests to create a new club
 */
async function handleCreateClub(req, supabaseClient) {
  try {
    console.log(`[CLUB-POST] === New POST request received ===`);
    
    // Get the request body
    const data = await req.json()
    console.log(`[CLUB-POST] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.name) {
      console.log(`[CLUB-POST] Missing club name - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Club name is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      )
    }

    if (!data.server_id) {
      console.log(`[CLUB-POST] Missing server_id - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Server ID is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      )
    }

    // Validate server exists
    console.log(`[CLUB-POST] Validating server: "${data.server_id}"`);
    const serverValidation = await validateServer(supabaseClient, data.server_id);
    console.log(`[CLUB-POST] Server validation result:`, serverValidation);
    
    if (!serverValidation.valid) {
      console.log(`[CLUB-POST] Server validation failed - returning 404`);
      return new Response(
        JSON.stringify({ error: serverValidation.error }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 404 
        }
      );
    }

    // Generate a unique ID if not provided
    if (!data.id) {
      data.id = crypto.randomUUID()
      console.log(`[CLUB-POST] Generated club ID: "${data.id}"`);
    } else {
      console.log(`[CLUB-POST] Using provided club ID: "${data.id}"`);
    }

    // Insert club data with server_id
    console.log(`[CLUB-POST] Inserting club data:`, {
      id: data.id,
      name: data.name,
      discord_channel: data.discord_channel || null,
      server_id: data.server_id
    });
    
    const { data: clubData, error: clubError } = await supabaseClient
      .from("clubs")
      .insert({
        id: data.id,
        name: data.name,
        discord_channel: data.discord_channel || null,
        server_id: data.server_id
      })
      .select()

    console.log(`[CLUB-POST] Club insert result:`, { success: !!clubData, error: clubError?.message });

    if (clubError) {
      console.log(`[CLUB-POST] Club insert failed - returning 500`);
      return new Response(
        JSON.stringify({ error: clubError.message }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    // Handle optional members array
    if (data.members && Array.isArray(data.members) && data.members.length > 0) {
      console.log(`[CLUB-POST] Processing ${data.members.length} members...`);
      
      // Insert each member
      for (const member of data.members) {
        console.log(`[CLUB-POST] Processing member:`, member);
        
        // Validate member data
        if (!member.id || !member.name) {
          console.log(`[CLUB-POST] Skipping invalid member:`, member);
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
          console.error(`[CLUB-POST] Error adding member ${member.id}: ${memberError.message}`)
          continue
        } else {
          console.log(`[CLUB-POST] Member ${member.id} upserted successfully`);
        }

        // Link member to club
        const { error: linkError } = await supabaseClient
          .from("memberclubs")
          .insert({
            member_id: member.id,
            club_id: data.id
          })

        if (linkError) {
          console.error(`[CLUB-POST] Error linking member ${member.id} to club: ${linkError.message}`)
        } else {
          console.log(`[CLUB-POST] Member ${member.id} linked to club successfully`);
        }
      }
    } else {
      console.log(`[CLUB-POST] No members to process`);
    }

    // Handle optional active_session
    if (data.active_session) {
      console.log(`[CLUB-POST] Processing active session...`);
      const session = data.active_session
      const book = session.book

      // Check required fields
      if (!session.id || !book || !book.title || !book.author) {
        console.log(`[CLUB-POST] Incomplete session data - skipping session creation`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Club created successfully but session data was incomplete",
            club: clubData[0]
          }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        )
      }

      // Insert book
      console.log(`[CLUB-POST] Inserting book:`, book);
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

      console.log(`[CLUB-POST] Book insert result:`, { success: !!bookData, error: bookError?.message });

      if (bookError) {
        console.log(`[CLUB-POST] Book insert failed`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Club created but failed to add book: " + bookError.message,
            club: clubData[0]
          }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        )
      }

      // Insert session
      console.log(`[CLUB-POST] Inserting session:`, {
        id: session.id,
        club_id: data.id,
        book_id: bookData[0].id,
        due_date: session.due_date || null
      });
      
      const { error: sessionError } = await supabaseClient
        .from("sessions")
        .insert({
          id: session.id,
          club_id: data.id,
          book_id: bookData[0].id,
          due_date: session.due_date || null
        })

      console.log(`[CLUB-POST] Session insert result:`, { success: !sessionError, error: sessionError?.message });

      if (sessionError) {
        console.log(`[CLUB-POST] Session insert failed`);
        return new Response(
          JSON.stringify({
            success: true,
            message: "Club created but failed to add session: " + sessionError.message,
            club: clubData[0]
          }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        )
      }

      // Add discussions if provided
      if (session.discussions && Array.isArray(session.discussions)) {
        console.log(`[CLUB-POST] Processing ${session.discussions.length} discussions...`);
        
        for (const discussion of session.discussions) {
          if (!discussion.id || !discussion.title || !discussion.date) {
            console.log(`[CLUB-POST] Skipping invalid discussion:`, discussion);
            continue; // Skip invalid discussions
          }

          console.log(`[CLUB-POST] Inserting discussion:`, discussion);
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
            console.error(`[CLUB-POST] Error adding discussion: ${discussionError.message}`);
          } else {
            console.log(`[CLUB-POST] Discussion ${discussion.id} added successfully`);
          }
        }
      } else {
        console.log(`[CLUB-POST] No discussions to process`);
      }
    } else {
      console.log(`[CLUB-POST] No active session to process`);
    }

    // Handle optional shame_list
    if (data.shame_list && Array.isArray(data.shame_list) && data.shame_list.length > 0) {
      console.log(`[CLUB-POST] Processing ${data.shame_list.length} shame list entries...`);
      
      for (const memberId of data.shame_list) {
        // Verify member exists
        const { data: memberExists, error: memberError } = await supabaseClient
          .from("members")
          .select("id")
          .eq("id", memberId)
          .single()

        if (memberError || !memberExists) {
          console.error(`[CLUB-POST] Member ID ${memberId} not found for shame list`)
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
          console.error(`[CLUB-POST] Error adding member ${memberId} to shame list: ${shameError.message}`)
        } else {
          console.log(`[CLUB-POST] Member ${memberId} added to shame list successfully`);
        }
      }
    } else {
      console.log(`[CLUB-POST] No shame list to process`);
    }

    console.log(`[CLUB-POST] Club creation completed successfully:`, clubData[0]);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Club created successfully",
        club: clubData[0]
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
    
  } catch (error) {
    console.log(`[CLUB-POST] ERROR: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }, 
        status: 500 
      }
    )
  }
}

/**
 * Handles PUT requests to update an existing club
 */
async function handleUpdateClub(req, supabaseClient) {
  try {
    console.log(`[CLUB-PUT] === New PUT request received ===`);
    
    // Get the request body
    const data = await req.json()
    console.log(`[CLUB-PUT] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.id) {
      console.log(`[CLUB-PUT] Missing club ID - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Club ID is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      )
    }

    if (!data.server_id) {
      console.log(`[CLUB-PUT] Missing server_id - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Server ID is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      )
    }

    // Validate server exists
    console.log(`[CLUB-PUT] Validating server: "${data.server_id}"`);
    const serverValidation = await validateServer(supabaseClient, data.server_id);
    console.log(`[CLUB-PUT] Server validation result:`, serverValidation);
    
    if (!serverValidation.valid) {
      console.log(`[CLUB-PUT] Server validation failed - returning 404`);
      return new Response(
        JSON.stringify({ error: serverValidation.error }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 404 
        }
      );
    }

    // Build update object with only the fields that should be updated
    const updateData = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.discord_channel !== undefined) updateData.discord_channel = data.discord_channel

    console.log(`[CLUB-PUT] Update data prepared:`, updateData);

    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      console.log(`[CLUB-PUT] No fields to update - returning 400`);
      return new Response(
        JSON.stringify({ error: 'No fields to update' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      )
    }

    // Check if club exists in this server
    console.log(`[CLUB-PUT] Checking if club exists: id="${data.id}", server_id="${data.server_id}"`);
    const { data: existingClub, error: checkError } = await supabaseClient
      .from("clubs")
      .select("id")
      .eq("id", data.id)
      .eq("server_id", data.server_id)
      .single()

    console.log(`[CLUB-PUT] Club existence check:`, { found: !!existingClub, error: checkError?.message });

    if (checkError || !existingClub) {
      console.log(`[CLUB-PUT] Club not found - returning 404`);
      return new Response(
        JSON.stringify({ error: 'Club not found in this server' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 404 
        }
      )
    }

    // Update club
    console.log(`[CLUB-PUT] Updating club with data:`, updateData);
    const { data: clubData, error: updateError } = await supabaseClient
      .from("clubs")
      .update(updateData)
      .eq("id", data.id)
      .eq("server_id", data.server_id)
      .select()

    console.log(`[CLUB-PUT] Club update result:`, { success: !!clubData, error: updateError?.message });

    if (updateError) {
      console.log(`[CLUB-PUT] Club update failed - returning 500`);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    // Handle shame_list updates if provided
    let shame_list_updated = false
    if (data.shame_list !== undefined) {
      console.log(`[CLUB-PUT] Processing shame list update:`, data.shame_list);
      
      if (!Array.isArray(data.shame_list)) {
        console.log(`[CLUB-PUT] Invalid shame list format - returning 400`);
        return new Response(
          JSON.stringify({ 
            error: 'Shame list must be an array',
            partial_success: true,
            message: "Club was updated but shame list was not modified",
            club: clubData[0]
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

      // Get current shame list
      console.log(`[CLUB-PUT] Getting current shame list for club: "${data.id}"`);
      const { data: current_shame_list, error: get_shame_error } = await supabaseClient
        .from("shamelist")
        .select("member_id")
        .eq("club_id", data.id)

      console.log(`[CLUB-PUT] Current shame list:`, { 
        count: current_shame_list?.length || 0, 
        members: current_shame_list?.map(s => s.member_id) || [],
        error: get_shame_error?.message 
      });

      if (get_shame_error) {
        console.log(`[CLUB-PUT] Failed to get current shame list - returning 500`);
        return new Response(
          JSON.stringify({ 
            error: get_shame_error.message,
            partial_success: true,
            message: "Club was updated but could not retrieve shame list",
            club: clubData[0]
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

      const current_member_ids = current_shame_list.map(item => item.member_id);
      
      // Members to add (in new list but not in current)
      const members_to_add = data.shame_list.filter(id => !current_member_ids.includes(id));
      
      // Members to remove (in current but not in new list)
      const members_to_remove = current_member_ids.filter(id => !data.shame_list.includes(id));

      console.log(`[CLUB-PUT] Shame list changes:`, { 
        to_add: members_to_add, 
        to_remove: members_to_remove 
      });

      // Add new members to shame list
      if (members_to_add.length > 0) {
        console.log(`[CLUB-PUT] Adding ${members_to_add.length} members to shame list...`);
        
        for (const memberId of members_to_add) {
          // Verify member exists
          const { data: memberExists, error: memberError } = await supabaseClient
            .from("members")
            .select("id")
            .eq("id", memberId)
            .single()

          if (memberError || !memberExists) {
            console.error(`[CLUB-PUT] Member ID ${memberId} not found for shame list`)
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
            console.error(`[CLUB-PUT] Error adding member ${memberId} to shame list: ${shameError.message}`)
          } else {
            console.log(`[CLUB-PUT] Member ${memberId} added to shame list successfully`);
            shame_list_updated = true
          }
        }
      }

      // Remove members from shame list
      if (members_to_remove.length > 0) {
        console.log(`[CLUB-PUT] Removing ${members_to_remove.length} members from shame list...`);
        
        const { error: removeError } = await supabaseClient
          .from("shamelist")
          .delete()
          .eq("club_id", data.id)
          .in("member_id", members_to_remove)

        console.log(`[CLUB-PUT] Shame list removal result:`, { success: !removeError, error: removeError?.message });

        if (removeError) {
          console.error(`[CLUB-PUT] Error removing members from shame list: ${removeError.message}`)
        } else if (members_to_remove.length > 0) {
          shame_list_updated = true
        }
      }
    } else {
      console.log(`[CLUB-PUT] No shame list updates requested`);
    }

    console.log(`[CLUB-PUT] Club update completed successfully:`, {
      club: clubData[0],
      shame_list_updated: shame_list_updated
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Club updated successfully",
        club: clubData[0],
        shame_list_updated: shame_list_updated
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
    
  } catch (error) {
    console.log(`[CLUB-PUT] ERROR: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }, 
        status: 500 
      }
    )
  }
}

/**
 * Handles DELETE requests to remove a club
 */
async function handleDeleteClub(req, supabaseClient) {
  try {
    console.log(`[CLUB-DELETE] === New DELETE request received ===`);
    
    // Get URL parameters
    const url = new URL(req.url);
    const clubId = url.searchParams.get('id');
    const serverId = url.searchParams.get('server_id');

    console.log(`[CLUB-DELETE] Request parameters:`, { clubId, serverId });

    if (!clubId) {
      console.log(`[CLUB-DELETE] Missing club ID - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Club ID is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      )
    }

    if (!serverId) {
      console.log(`[CLUB-DELETE] Missing server_id - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Server ID is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      )
    }

    // Validate server exists
    console.log(`[CLUB-DELETE] Validating server: "${serverId}"`);
    const serverValidation = await validateServer(supabaseClient, serverId);
    console.log(`[CLUB-DELETE] Server validation result:`, serverValidation);
    
    if (!serverValidation.valid) {
      console.log(`[CLUB-DELETE] Server validation failed - returning 404`);
      return new Response(
        JSON.stringify({ error: serverValidation.error }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 404 
        }
      );
    }

    // Check if club exists in this server
    console.log(`[CLUB-DELETE] Checking if club exists: id="${clubId}", server_id="${serverId}"`);
    const { data: existingClub, error: checkError } = await supabaseClient
      .from("clubs")
      .select("id")
      .eq("id", clubId)
      .eq("server_id", serverId)
      .single()

    console.log(`[CLUB-DELETE] Club existence check:`, { found: !!existingClub, error: checkError?.message });

    if (checkError || !existingClub) {
      console.log(`[CLUB-DELETE] Club not found - returning 404`);
      return new Response(
        JSON.stringify({ error: 'Club not found in this server' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 404 
        }
      )
    }

    // Get sessions to cascade delete
    console.log(`[CLUB-DELETE] Getting sessions for club: "${clubId}"`);
    const { data: sessions } = await supabaseClient
      .from("sessions")
      .select("id")
      .eq("club_id", clubId)

    const sessionIds = sessions?.map(s => s.id) || []
    console.log(`[CLUB-DELETE] Found sessions to delete:`, sessionIds);

    // Start cascade deletion
    console.log(`[CLUB-DELETE] Starting cascade deletion process...`);
    
    // 1. Delete discussions for any sessions in this club
    if (sessionIds.length > 0) {
      console.log(`[CLUB-DELETE] Deleting discussions for ${sessionIds.length} sessions...`);
      
      const { error: discussionError } = await supabaseClient
        .from("discussions")
        .delete()
        .in("session_id", sessionIds)

      console.log(`[CLUB-DELETE] Discussions deletion result:`, { success: !discussionError, error: discussionError?.message });

      if (discussionError) {
        console.log(`[CLUB-DELETE] Failed to delete discussions - returning 500`);
        return new Response(
          JSON.stringify({ error: `Failed to delete discussions: ${discussionError.message}` }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }, 
            status: 500 
          }
        )
      }

      // 2. Delete sessions
      console.log(`[CLUB-DELETE] Deleting ${sessionIds.length} sessions...`);
      const { error: sessionError } = await supabaseClient
        .from("sessions")
        .delete()
        .eq("club_id", clubId)

      console.log(`[CLUB-DELETE] Sessions deletion result:`, { success: !sessionError, error: sessionError?.message });

      if (sessionError) {
        console.log(`[CLUB-DELETE] Failed to delete sessions - returning 500`);
        return new Response(
          JSON.stringify({ error: `Failed to delete sessions: ${sessionError.message}` }),
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
      console.log(`[CLUB-DELETE] No sessions to delete`);
    }

    // 3. Delete shame list entries for this club
    console.log(`[CLUB-DELETE] Deleting shame list entries for club: "${clubId}"`);
    const { error: shame_list_error } = await supabaseClient
      .from("shamelist")
      .delete()
      .eq("club_id", clubId)

    console.log(`[CLUB-DELETE] Shame list deletion result:`, { success: !shame_list_error, error: shame_list_error?.message });

    if (shame_list_error) {
      console.log(`[CLUB-DELETE] Failed to delete shame list entries - returning 500`);
      return new Response(
        JSON.stringify({ error: `Failed to delete shame list entries: ${shame_list_error.message}` }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    // 4. Delete member club associations
    console.log(`[CLUB-DELETE] Deleting member associations for club: "${clubId}"`);
    const { error: memberClubError } = await supabaseClient
      .from("memberclubs")
      .delete()
      .eq("club_id", clubId)

    console.log(`[CLUB-DELETE] Member associations deletion result:`, { success: !memberClubError, error: memberClubError?.message });

    if (memberClubError) {
      console.log(`[CLUB-DELETE] Failed to delete member associations - returning 500`);
      return new Response(
        JSON.stringify({ error: `Failed to delete member associations: ${memberClubError.message}` }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    // 5. Finally delete the club
    console.log(`[CLUB-DELETE] Deleting club: "${clubId}"`);
    const { error: deleteError } = await supabaseClient
      .from("clubs")
      .delete()
      .eq("id", clubId)
      .eq("server_id", serverId)

    console.log(`[CLUB-DELETE] Club deletion result:`, { success: !deleteError, error: deleteError?.message });

    if (deleteError) {
      console.log(`[CLUB-DELETE] Failed to delete club - returning 500`);
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    console.log(`[CLUB-DELETE] Club deletion completed successfully`);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Club deleted successfully" 
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
    
  } catch (error) {
    console.log(`[CLUB-DELETE] ERROR: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }, 
        status: 500 
      }
    )
  }
}