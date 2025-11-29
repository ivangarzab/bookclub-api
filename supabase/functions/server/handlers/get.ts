// supabase/functions/server/handlers/get.ts
// Handles GET requests to retrieve server details

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, successResponse } from '../utils/responses.ts'

/**
 * Handles GET requests to retrieve server details
 */
export async function handleGetServer(req: Request, supabaseClient: SupabaseClient) {
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
        .select("id, name")
        .order('name', { ascending: true })

      console.log(`[SERVER-GET] All servers query result:`, {
        count: serversData?.length || 0,
        error: serversError?.message,
        servers: serversData?.map(s => ({ id: s.id, name: s.name })) || []
      });

      if (serversError) {
        console.log(`[SERVER-GET] All servers query failed - returning 500`);
        return errorResponse(serversError.message, 500)
      }

      // Get clubs for each server (using string conversion to prevent precision loss)
      console.log(`[SERVER-GET] Getting clubs for ${serversData.length} servers...`);

      const serversWithClubs = await Promise.all(
        serversData.map(async (server) => {
          console.log(`[SERVER-GET] Getting clubs for server: "${server.id}"`);

          const { data: clubsData, error: clubsError } = await supabaseClient
            .from("clubs")
            .select("id, name, discord_channel")
            .eq("server_id", server.id)

          console.log(`[SERVER-GET] Clubs for server ${server.id}:`, {
            count: clubsData?.length || 0,
            error: clubsError?.message,
            clubs: clubsData?.map(c => ({ id: c.id, name: c.name })) || []
          });

          if (clubsError) {
            console.error(`[SERVER-GET] Error fetching clubs for server ${server.id}:`, clubsError);
          }

          return {
            id: server.id,
            name: server.name,
            clubs: clubsData || []
          }
        })
      )

      console.log(`[SERVER-GET] All servers with clubs completed - returning data`);
      return successResponse({ servers: serversWithClubs })
    }

    console.log(`[SERVER-GET] Getting specific server: "${serverId}"`);

    // Get specific server data
    const { data: serverData, error: serverError } = await supabaseClient
      .from("servers")
      .select("id, name")
      .eq("id", serverId)
      .single()

    console.log(`[SERVER-GET] Server query result:`, {
      found: !!serverData,
      error: serverError?.message,
      server: serverData ? { id: serverData.id, name: serverData.name } : null
    });

    if (serverError || !serverData) {
      console.log(`[SERVER-GET] Server not found - returning 404`);
      return errorResponse(serverError?.message || 'Server not found', 404)
    }

    // Get clubs for this server
    console.log(`[SERVER-GET] Getting clubs for server: "${serverId}"`);
    const { data: clubsData, error: clubsError } = await supabaseClient
      .from("clubs")
      .select("id, name, discord_channel")
      .eq("server_id", serverId)

    console.log(`[SERVER-GET] Clubs query result:`, {
      count: clubsData?.length || 0,
      error: clubsError?.message,
      clubs: clubsData?.map(c => ({ id: c.id, name: c.name })) || []
    });

    if (clubsError) {
      console.log(`[SERVER-GET] Clubs query failed - returning 500`);
      return errorResponse(clubsError.message, 500)
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
    return successResponse({
      id: serverData.id,
      name: serverData.name,
      clubs: clubsWithDetails
    })
  } catch (error) {
    console.log(`[SERVER-GET] ERROR: ${(error as Error).message}`);
    return errorResponse((error as Error).message, 500)
  }
}
