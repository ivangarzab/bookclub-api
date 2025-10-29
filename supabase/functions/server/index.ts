// supabase/functions/server/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

/**
 * Main handler function - exported for testing
 */
export async function handler(req: Request, supabaseClient?: SupabaseClient): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log(`[SERVER] === New ${req.method} request received ===`);

    // Create Supabase client if not provided (for testing)
    const client = supabaseClient || createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Determine which operation to perform based on HTTP method
    switch (req.method) {
      case 'GET':
        return await handleGetServer(req, client);
      case 'POST':
        return await handleCreateServer(req, client);
      case 'PUT':
        return await handleUpdateServer(req, client);
      case 'DELETE':
        return await handleDeleteServer(req, client);
      default:
        console.log(`[SERVER] Method not allowed: ${req.method}`);
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
  } catch (error: any) {
    console.log(`[SERVER] FATAL ERROR: ${error.message}`);
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

// Start server (only when run directly, not when imported for testing)
if (import.meta.main) {
  serve((req) => handler(req));
}

/**
 * Handles GET requests to retrieve server details
 */
async function handleGetServer(req, supabaseClient) {
  try {
    console.log(`[SERVER-GET] Starting handleGetServer`);
    
    // Get URL parameters
    const url = new URL(req.url);
    const serverId = url.searchParams.get('id');

    console.log(`[SERVER-GET] Request parameters:`, { serverId });

    if (!serverId) {
      console.log(`[SERVER-GET] No server ID provided - getting all servers`);
      
      // If no ID provided, return all servers
      const { data: serversData, error: serversError } = await supabaseClient
        .from("servers")
        .select("id::text, name") // Cast ID to text to preserve precision
        .order('name', { ascending: true })

      console.log(`[SERVER-GET] All servers query result:`, { 
        count: serversData?.length || 0, 
        error: serversError?.message,
        servers: serversData?.map(s => ({ id: s.id, name: s.name })) || []
      });

      if (serversError) {
        console.log(`[SERVER-GET] All servers query failed - returning 500`);
        return new Response(
          JSON.stringify({ error: serversError.message }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }, 
            status: 500 
          }
        )
      }

      // Get clubs for each server (using string conversion to prevent precision loss)
      console.log(`[SERVER-GET] Getting clubs for ${serversData.length} servers...`);
      
      const serversWithClubs = await Promise.all(
        serversData.map(async (server) => {
          console.log(`[SERVER-GET] Getting clubs for server: "${server.id}"`);
          
          const { data: clubsData, error: clubsError } = await supabaseClient
            .from("clubs")
            .select("id, name, discord_channel::text") // Cast discord_channel to text too
            .eq("server_id", server.id) // server.id is now already a string

          console.log(`[SERVER-GET] Clubs for server ${server.id}:`, { 
            count: clubsData?.length || 0, 
            error: clubsError?.message,
            clubs: clubsData?.map(c => ({ id: c.id, name: c.name })) || []
          });

          if (clubsError) {
            console.error(`[SERVER-GET] Error fetching clubs for server ${server.id}:`, clubsError);
          }

          return {
            id: server.id, // Already a string now
            name: server.name,
            clubs: clubsData || []
          }
        })
      )

      console.log(`[SERVER-GET] All servers with clubs completed - returning data`);
      return new Response(
        JSON.stringify({ servers: serversWithClubs }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      )
    }

    console.log(`[SERVER-GET] Getting specific server: "${serverId}"`);
    
    // Get specific server data
    const { data: serverData, error: serverError } = await supabaseClient
      .from("servers")
      .select("id::text, name") // Cast ID to text to preserve precision
      .eq("id", serverId)
      .single()

    console.log(`[SERVER-GET] Server query result:`, { 
      found: !!serverData, 
      error: serverError?.message,
      server: serverData ? { id: serverData.id, name: serverData.name } : null
    });

    if (serverError || !serverData) {
      console.log(`[SERVER-GET] Server not found - returning 404`);
      return new Response(
        JSON.stringify({ error: serverError?.message || 'Server not found' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 404 
        }
      )
    }

    // Get clubs for this server
    console.log(`[SERVER-GET] Getting clubs for server: "${serverId}"`);
    const { data: clubsData, error: clubsError } = await supabaseClient
      .from("clubs")
      .select("id, name, discord_channel::text") // Cast discord_channel to text
      .eq("server_id", serverId)

    console.log(`[SERVER-GET] Clubs query result:`, { 
      count: clubsData?.length || 0, 
      error: clubsError?.message,
      clubs: clubsData?.map(c => ({ id: c.id, name: c.name })) || []
    });

    if (clubsError) {
      console.log(`[SERVER-GET] Clubs query failed - returning 500`);
      return new Response(
        JSON.stringify({ error: clubsError.message }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    // For each club, get member count and active session info
    console.log(`[SERVER-GET] Getting detailed info for ${clubsData.length} clubs...`);
    
    const clubsWithDetails = await Promise.all(
      clubsData.map(async (club) => {
        console.log(`[SERVER-GET] Getting details for club: "${club.id}"`);
        
        // Get member count
        const { data: memberCount } = await supabaseClient
          .from("memberclubs")
          .select("member_id", { count: 'exact' })
          .eq("club_id", club.id)

        console.log(`[SERVER-GET] Member count for club ${club.id}:`, memberCount?.length || 0);

        // Get latest session
        const { data: latestSession } = await supabaseClient
          .from("sessions")
          .select("id, due_date, books(title, author)")
          .eq("club_id", club.id)
          .order('due_date', { ascending: false })
          .limit(1)

        console.log(`[SERVER-GET] Latest session for club ${club.id}:`, { 
          found: !!latestSession?.[0],
          session: latestSession?.[0] ? { 
            id: latestSession[0].id, 
            due_date: latestSession[0].due_date 
          } : null
        });

        return {
          id: club.id,
          name: club.name,
          discord_channel: club.discord_channel,
          member_count: memberCount?.length || 0,
          latest_session: latestSession?.[0] || null
        }
      })
    )

    console.log(`[SERVER-GET] Server details completed - returning data`);
    
    // Return the server with associated data
    return new Response(
      JSON.stringify({
        id: serverData.id, // Already a string now
        name: serverData.name,
        clubs: clubsWithDetails
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
  } catch (error) {
    console.log(`[SERVER-GET] ERROR: ${error.message}`);
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
 * Handles POST requests to create a new server
 */
async function handleCreateServer(req, supabaseClient) {
  try {
    console.log(`[SERVER-POST] Starting handleCreateServer`);
    
    // Get the request body
    const data = await req.json()
    console.log(`[SERVER-POST] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.name) {
      console.log(`[SERVER-POST] Missing server name - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Server name is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      )
    }

    // Generate a server ID if not provided (Discord server IDs are typically large numbers)
    const serverId = data.id || Math.floor(Math.random() * 1000000000000000000);
    console.log(`[SERVER-POST] Using server ID: "${serverId}" (provided: ${!!data.id})`);

    // Insert server data
    console.log(`[SERVER-POST] Inserting server data:`, { id: serverId, name: data.name });
    
    const { data: serverData, error: serverError } = await supabaseClient
      .from("servers")
      .insert({
        id: serverId,
        name: data.name
      })
      .select()

    console.log(`[SERVER-POST] Server insert result:`, { 
      success: !!serverData, 
      error: serverError?.message,
      server: serverData?.[0] ? { id: serverData[0].id, name: serverData[0].name } : null
    });

    if (serverError) {
      console.log(`[SERVER-POST] Server insert failed - returning 500`);
      return new Response(
        JSON.stringify({ error: serverError.message }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    console.log(`[SERVER-POST] Server creation completed successfully`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Server created successfully",
        server: serverData[0]
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
    
  } catch (error) {
    console.log(`[SERVER-POST] ERROR: ${error.message}`);
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
 * Handles PUT requests to update an existing server
 */
async function handleUpdateServer(req, supabaseClient) {
  try {
    console.log(`[SERVER-PUT] Starting handleUpdateServer`);
    
    // Get the request body
    const data = await req.json()
    console.log(`[SERVER-PUT] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.id) {
      console.log(`[SERVER-PUT] Missing server ID - returning 400`);
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

    // Check if server exists
    console.log(`[SERVER-PUT] Checking if server exists: "${data.id}"`);
    const { data: existingServer, error: checkError } = await supabaseClient
      .from("servers")
      .select("id")
      .eq("id", data.id)
      .single()

    console.log(`[SERVER-PUT] Server existence check:`, { 
      found: !!existingServer, 
      error: checkError?.message 
    });

    if (checkError || !existingServer) {
      console.log(`[SERVER-PUT] Server not found - returning 404`);
      return new Response(
        JSON.stringify({ error: 'Server not found' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 404 
        }
      )
    }

    // Build update object with only the fields that should be updated
    const updateData = {}
    if (data.name !== undefined) updateData.name = data.name

    console.log(`[SERVER-PUT] Update data prepared:`, updateData);

    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      console.log(`[SERVER-PUT] No fields to update - returning 400`);
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

    // Update server
    console.log(`[SERVER-PUT] Updating server with data:`, updateData);
    const { data: serverData, error: updateError } = await supabaseClient
      .from("servers")
      .update(updateData)
      .eq("id", data.id)
      .select()

    console.log(`[SERVER-PUT] Server update result:`, { 
      success: !!serverData, 
      error: updateError?.message,
      server: serverData?.[0] ? { id: serverData[0].id, name: serverData[0].name } : null
    });

    if (updateError) {
      console.log(`[SERVER-PUT] Server update failed - returning 500`);
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

    console.log(`[SERVER-PUT] Server update completed successfully`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Server updated successfully",
        server: serverData[0]
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
    
  } catch (error) {
    console.log(`[SERVER-PUT] ERROR: ${error.message}`);
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
 * Handles DELETE requests to remove a server
 */
async function handleDeleteServer(req, supabaseClient) {
  try {
    console.log(`[SERVER-DELETE] Starting handleDeleteServer`);
    
    // Get URL parameters
    const url = new URL(req.url);
    const serverId = url.searchParams.get('id');

    console.log(`[SERVER-DELETE] Request parameters:`, { serverId });

    if (!serverId) {
      console.log(`[SERVER-DELETE] Missing server ID - returning 400`);
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

    // Check if server exists
    console.log(`[SERVER-DELETE] Checking if server exists: "${serverId}"`);
    const { data: existingServer, error: checkError } = await supabaseClient
      .from("servers")
      .select("id")
      .eq("id", serverId)
      .single()

    console.log(`[SERVER-DELETE] Server existence check:`, { 
      found: !!existingServer, 
      error: checkError?.message 
    });

    if (checkError || !existingServer) {
      console.log(`[SERVER-DELETE] Server not found - returning 404`);
      return new Response(
        JSON.stringify({ error: 'Server not found' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 404 
        }
      )
    }

    // Check if server has clubs
    console.log(`[SERVER-DELETE] Checking for existing clubs in server: "${serverId}"`);
    const { data: clubsData } = await supabaseClient
      .from("clubs")
      .select("id")
      .eq("server_id", serverId)

    console.log(`[SERVER-DELETE] Clubs check result:`, { 
      count: clubsData?.length || 0,
      clubs: clubsData?.map(c => c.id) || []
    });

    if (clubsData && clubsData.length > 0) {
      console.log(`[SERVER-DELETE] Server has ${clubsData.length} clubs - cannot delete`);
      return new Response(
        JSON.stringify({ 
          error: 'Cannot delete server with existing clubs. Please delete all clubs first.',
          clubs_count: clubsData.length
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

    // Delete the server
    console.log(`[SERVER-DELETE] Deleting server: "${serverId}"`);
    const { error: deleteError } = await supabaseClient
      .from("servers")
      .delete()
      .eq("id", serverId)

    console.log(`[SERVER-DELETE] Server deletion result:`, { 
      success: !deleteError, 
      error: deleteError?.message 
    });

    if (deleteError) {
      console.log(`[SERVER-DELETE] Server deletion failed - returning 500`);
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

    console.log(`[SERVER-DELETE] Server deletion completed successfully`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Server deleted successfully" 
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
    
  } catch (error) {
    console.log(`[SERVER-DELETE] ERROR: ${error.message}`);
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