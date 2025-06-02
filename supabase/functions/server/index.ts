// supabase/functions/server/index.ts
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
        return await handleGetServer(req, supabaseClient);
      case 'POST':
        return await handleCreateServer(req, supabaseClient);
      case 'PUT':
        return await handleUpdateServer(req, supabaseClient);
      case 'DELETE':
        return await handleDeleteServer(req, supabaseClient);
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
 * Handles GET requests to retrieve server details
 */
async function handleGetServer(req, supabaseClient) {
  try {
    // Get URL parameters
    const url = new URL(req.url);
    const serverId = url.searchParams.get('id');

    if (!serverId) {
      // If no ID provided, return all servers
      const { data: serversData, error: serversError } = await supabaseClient
        .from("servers")
        .select("*")
        .order('name', { ascending: true })

      if (serversError) {
        return new Response(
          JSON.stringify({ error: serversError.message }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Get clubs for each server
      const serversWithClubs = await Promise.all(
        serversData.map(async (server) => {
          const { data: clubsData } = await supabaseClient
            .from("clubs")
            .select("id, name, discord_channel")
            .eq("server_id", server.id)

          return {
            id: server.id,
            name: server.name,
            clubs: clubsData || []
          }
        })
      )

      return new Response(
        JSON.stringify({ servers: serversWithClubs }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get specific server data
    const { data: serverData, error: serverError } = await supabaseClient
      .from("servers")
      .select("*")
      .eq("id", serverId)
      .single()

    if (serverError || !serverData) {
      return new Response(
        JSON.stringify({ error: serverError?.message || 'Server not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Get clubs for this server
    const { data: clubsData, error: clubsError } = await supabaseClient
      .from("clubs")
      .select("*")
      .eq("server_id", serverId)

    if (clubsError) {
      return new Response(
        JSON.stringify({ error: clubsError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // For each club, get member count and active session info
    const clubsWithDetails = await Promise.all(
      clubsData.map(async (club) => {
        // Get member count
        const { data: memberCount } = await supabaseClient
          .from("memberclubs")
          .select("member_id", { count: 'exact' })
          .eq("club_id", club.id)

        // Get latest session
        const { data: latestSession } = await supabaseClient
          .from("sessions")
          .select("id, due_date, books(title, author)")
          .eq("club_id", club.id)
          .order('due_date', { ascending: false })
          .limit(1)

        return {
          id: club.id,
          name: club.name,
          discord_channel: club.discord_channel,
          member_count: memberCount?.length || 0,
          latest_session: latestSession?.[0] || null
        }
      })
    )

    // Return the server with associated data
    return new Response(
      JSON.stringify({
        id: serverData.id,
        name: serverData.name,
        clubs: clubsWithDetails
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
 * Handles POST requests to create a new server
 */
async function handleCreateServer(req, supabaseClient) {
  try {
    // Get the request body
    const data = await req.json()

    // Validate required fields
    if (!data.name) {
      return new Response(
        JSON.stringify({ error: 'Server name is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Generate a server ID if not provided (Discord server IDs are typically large numbers)
    const serverId = data.id || Math.floor(Math.random() * 1000000000000000000);

    // Insert server data
    const { data: serverData, error: serverError } = await supabaseClient
      .from("servers")
      .insert({
        id: serverId,
        name: data.name
      })
      .select()

    if (serverError) {
      return new Response(
        JSON.stringify({ error: serverError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Server created successfully",
        server: serverData[0]
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
 * Handles PUT requests to update an existing server
 */
async function handleUpdateServer(req, supabaseClient) {
  try {
    // Get the request body
    const data = await req.json()

    // Validate required fields
    if (!data.id) {
      return new Response(
        JSON.stringify({ error: 'Server ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if server exists
    const { data: existingServer, error: checkError } = await supabaseClient
      .from("servers")
      .select("id")
      .eq("id", data.id)
      .single()

    if (checkError || !existingServer) {
      return new Response(
        JSON.stringify({ error: 'Server not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Build update object with only the fields that should be updated
    const updateData = {}
    if (data.name !== undefined) updateData.name = data.name

    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No fields to update' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Update server
    const { data: serverData, error: updateError } = await supabaseClient
      .from("servers")
      .update(updateData)
      .eq("id", data.id)
      .select()

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Server updated successfully",
        server: serverData[0]
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
 * Handles DELETE requests to remove a server
 */
async function handleDeleteServer(req, supabaseClient) {
  try {
    // Get URL parameters
    const url = new URL(req.url);
    const serverId = url.searchParams.get('id');

    if (!serverId) {
      return new Response(
        JSON.stringify({ error: 'Server ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if server exists
    const { data: existingServer, error: checkError } = await supabaseClient
      .from("servers")
      .select("id")
      .eq("id", serverId)
      .single()

    if (checkError || !existingServer) {
      return new Response(
        JSON.stringify({ error: 'Server not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Check if server has clubs
    const { data: clubsData } = await supabaseClient
      .from("clubs")
      .select("id")
      .eq("server_id", serverId)

    if (clubsData && clubsData.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Cannot delete server with existing clubs. Please delete all clubs first.',
          clubs_count: clubsData.length
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Delete the server
    const { error: deleteError } = await supabaseClient
      .from("servers")
      .delete()
      .eq("id", serverId)

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Server deleted successfully" 
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