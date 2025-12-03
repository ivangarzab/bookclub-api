// supabase/functions/club/handlers/get.ts
// Handles GET requests to retrieve club details

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, successResponse, corsHeaders } from '../utils/responses.ts'
import { validateServer } from '../utils/validation.ts'

/**
 * Handles GET requests to retrieve club details
 */
export async function handleGetClub(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[CLUB-GET] === New GET request received ===`)

    // Get URL parameters
    const url = new URL(req.url)
    const clubId = url.searchParams.get('id')
    const serverId = url.searchParams.get('server_id')
    const discordChannel = url.searchParams.get('discord_channel')

    console.log(`[CLUB-GET] Request parameters:`, { clubId, serverId, discordChannel })

    // Search by discord_channel
    if (discordChannel) {
      console.log(`[CLUB-GET] Searching by discord_channel: "${discordChannel}"`)

      if (!serverId) {
        console.log(`[CLUB-GET] Missing server_id for discord_channel search - returning 400`)
        return errorResponse('Server ID is required when searching by discord_channel', 400)
      }

      // Validate server exists
      console.log(`[CLUB-GET] Validating server: "${serverId}"`)
      const serverValidation = await validateServer(supabaseClient, serverId)
      console.log(`[CLUB-GET] Server validation result:`, serverValidation)

      if (!serverValidation.valid) {
        console.log(`[CLUB-GET] Server validation failed - returning 404`)
        return errorResponse(serverValidation.error || 'Server not found', 404)
      }

      // Find club by discord_channel and server_id
      console.log(`[CLUB-GET] Searching for club with discord_channel: "${discordChannel}" and server_id: "${serverId}"`)
      const { data: clubData, error: clubError } = await supabaseClient
        .from('clubs')
        .select('id, name, discord_channel, server_id, founded_date')
        .eq('discord_channel', discordChannel)
        .eq('server_id', serverId)
        .single()

      console.log(`[CLUB-GET] Discord channel search result:`, { found: !!clubData, error: clubError?.message })

      if (clubError || !clubData) {
        console.log(`[CLUB-GET] Club not found by discord_channel - returning 404`)
        return errorResponse(
          clubError?.message || 'Club not found with this discord channel in the specified server',
          404
        )
      }

      console.log(`[CLUB-GET] Found club by discord_channel: "${clubData.id}" - getting full details`)
      // Use the found club's ID to get full club details
      return await getFullClubDetails(supabaseClient, clubData.id, serverId)
    }

    // Original logic for ID-based search
    console.log(`[CLUB-GET] Searching by club ID`)

    if (!clubId) {
      console.log(`[CLUB-GET] Missing club_id - returning 400`)
      return errorResponse('Club ID is required', 400)
    }

    // Server ID is optional when querying by club_id (mobile use case)
    if (serverId) {
      console.log(`[CLUB-GET] Validating server: "${serverId}"`)
      const serverValidation = await validateServer(supabaseClient, serverId)
      console.log(`[CLUB-GET] Server validation result:`, serverValidation)

      if (!serverValidation.valid) {
        console.log(`[CLUB-GET] Server validation failed - returning 404`)
        return errorResponse(serverValidation.error || 'Server not found', 404)
      }
    } else {
      console.log(`[CLUB-GET] No server_id provided - fetching club independently (mobile use case)`)
    }

    console.log(`[CLUB-GET] Getting full club details for ID: "${clubId}"`)
    return await getFullClubDetails(supabaseClient, clubId, serverId)

  } catch (error) {
    console.log(`[CLUB-GET] ERROR: ${(error as Error).message}`)
    return errorResponse((error as Error).message, 500)
  }
}

/**
 * Helper function to get full club details by club ID and optional server ID
 */
async function getFullClubDetails(supabaseClient: SupabaseClient, clubId: string, serverId?: string | null) {
  console.log(`[CLUB-GET] Starting getFullClubDetails - clubId: "${clubId}", serverId: "${serverId || 'none'}"`)

  // Get club data with optional server verification
  console.log(`[CLUB-GET] Querying club table for id: "${clubId}"${serverId ? ` and server_id: "${serverId}"` : ''}`)

  // Build query dynamically based on whether server_id is provided
  let clubQuery = supabaseClient
    .from('clubs')
    .select('id, name, discord_channel, server_id, founded_date')
    .eq('id', clubId)

  // Only filter by server_id if provided (Discord use case)
  if (serverId) {
    clubQuery = clubQuery.eq('server_id', serverId)
  }

  const { data: clubData, error: clubError } = await clubQuery.single()

  console.log(`[CLUB-GET] Club query result:`, { found: !!clubData, error: clubError?.message })

  if (clubError || !clubData) {
    console.log(`[CLUB-GET] Club not found - returning 404`)
    return errorResponse(
      clubError?.message || (serverId ? 'Club not found in this server' : 'Club not found'),
      404
    )
  }

  // Get all members associated with this club
  console.log(`[CLUB-GET] Querying memberclubs for club_id: "${clubId}"`)
  const { data: memberClubsData, error: memberClubsError } = await supabaseClient
    .from('memberclubs')
    .select('member_id')
    .eq('club_id', clubId)

  console.log(`[CLUB-GET] MemberClubs query result:`, { count: memberClubsData?.length || 0, error: memberClubsError?.message })

  if (memberClubsError) {
    console.log(`[CLUB-GET] MemberClubs query failed - returning 500`)
    return errorResponse(memberClubsError.message, 500)
  }

  // Process members (might be empty, that's fine)
  let membersWithClubs: Array<Record<string, unknown>> = []

  if (memberClubsData && memberClubsData.length > 0) {
    // Extract member IDs
    const memberIds = memberClubsData.map((mc: Record<string, unknown>) => mc.member_id)
    console.log(`[CLUB-GET] Found member IDs:`, memberIds)

    // Get member details
    console.log(`[CLUB-GET] Querying members table for IDs:`, memberIds)
    const { data: membersData, error: membersError } = await supabaseClient
      .from('members')
      .select('*')
      .in('id', memberIds)

    console.log(`[CLUB-GET] Members query result:`, { count: membersData?.length || 0, error: membersError?.message })

    if (membersError) {
      console.log(`[CLUB-GET] Members query failed - returning 500`)
      return errorResponse(membersError.message, 500)
    }

    // Get club memberships for each member
    console.log(`[CLUB-GET] Building member details with club associations...`)
    membersWithClubs = await Promise.all(
      membersData.map(async (member: Record<string, unknown>) => {
        const { data: memberClubs } = await supabaseClient
          .from('memberclubs')
          .select('club_id')
          .eq('member_id', member.id)

        return {
          id: member.id,
          name: member.name,
          points: member.points,
          books_read: member.books_read,
          handle: member.handle,
          created_at: member.created_at,
          clubs: memberClubs?.map((mc: Record<string, unknown>) => mc.club_id) || []
        }
      })
    )
  } else {
    console.log(`[CLUB-GET] No members found - will continue with empty members array`)
  }

  // Get active session for this club (regardless of member count)
  console.log(`[CLUB-GET] Querying sessions for club_id: "${clubId}" (type: ${typeof clubId})`)
  const { data: sessionsData, error: sessionsError } = await supabaseClient
    .from('sessions')
    .select('*')
    .eq('club_id', clubId)
    .order('due_date', { ascending: false })
    .limit(1)

  console.log(`[CLUB-GET] Sessions query result:`, {
    count: sessionsData?.length || 0,
    error: sessionsError?.message,
    sessions: sessionsData?.map(s => ({ id: s.id, club_id: s.club_id, due_date: s.due_date })) || []
  })

  // Let's also check what sessions exist for debugging
  const { data: allSessions } = await supabaseClient
    .from('sessions')
    .select('id, club_id, due_date')

  console.log(`[CLUB-GET] All sessions in database:`, allSessions?.map(s => ({
    id: s.id,
    club_id: s.club_id,
    club_id_type: typeof s.club_id,
    due_date: s.due_date
  })) || [])

  if (sessionsError) {
    console.log(`[CLUB-GET] Sessions query failed - returning 500`)
    return errorResponse(sessionsError.message, 500)
  }

  let active_session = null
  if (sessionsData && sessionsData.length > 0) {
    console.log(`[CLUB-GET] Found active session - building session details...`)
    const session = sessionsData[0]

    // Get book for this session
    console.log(`[CLUB-GET] Querying book for book_id: ${session.book_id}`)
    const { data: bookData, error: bookError } = await supabaseClient
      .from('books')
      .select('*')
      .eq('id', session.book_id)
      .single()

    console.log(`[CLUB-GET] Book query result:`, { found: !!bookData, error: bookError?.message })

    if (bookError) {
      console.log(`[CLUB-GET] Book query failed - returning 500`)
      return errorResponse(bookError.message, 500)
    }

    // Get discussions for this session
    console.log(`[CLUB-GET] Querying discussions for session_id: ${session.id}`)
    const { data: discussionsData, error: discussionsError } = await supabaseClient
      .from('discussions')
      .select('*')
      .eq('session_id', session.id)

    console.log(`[CLUB-GET] Discussions query result:`, { count: discussionsData?.length || 0, error: discussionsError?.message })

    if (discussionsError) {
      console.log(`[CLUB-GET] Discussions query failed - returning 500`)
      return errorResponse(discussionsError.message, 500)
    }

    active_session = {
      id: session.id,
      club_id: session.club_id,
      book: {
        title: bookData.title,
        author: bookData.author,
        edition: bookData.edition,
        year: bookData.year,
        isbn: bookData.isbn,
        page_count: bookData.page_count
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
    console.log(`[CLUB-GET] Active session built:`, { id: active_session.id, book_title: active_session.book.title })
  } else {
    console.log(`[CLUB-GET] No active session found`)
  }

  // Get past sessions (skip the active one if it exists)
  console.log(`[CLUB-GET] Querying past sessions...`)
  const { data: past_sessions_data } = await supabaseClient
    .from('sessions')
    .select('id, due_date')
    .eq('club_id', clubId)
    .order('due_date', { ascending: false })
    .range(active_session ? 1 : 0, 10)

  const past_sessions = past_sessions_data || []
  console.log(`[CLUB-GET] Past sessions found:`, past_sessions.length)

  // Get shame list for the club
  console.log(`[CLUB-GET] Querying shame list for club_id: "${clubId}"`)
  const { data: shame_list_data, error: shame_list_error } = await supabaseClient
    .from('shamelist')
    .select('member_id')
    .eq('club_id', clubId)

  console.log(`[CLUB-GET] Shame list query result:`, { count: shame_list_data?.length || 0, error: shame_list_error?.message })

  if (shame_list_error) {
    console.log(`[CLUB-GET] Shame list query failed - returning 500`)
    return errorResponse(shame_list_error.message, 500)
  }

  const shame_list = shame_list_data?.map(item => item.member_id) || []

  // Build final response
  const response_data = {
    id: clubData.id,
    name: clubData.name,
    discord_channel: clubData.discord_channel,
    server_id: clubData.server_id,
    founded_date: clubData.founded_date,
    members: membersWithClubs,
    active_session: active_session,
    past_sessions: past_sessions,
    shame_list: shame_list
  }

  console.log(`[CLUB-GET] Final response summary:`, {
    club_name: response_data.name,
    member_count: response_data.members.length,
    has_active_session: !!response_data.active_session,
    past_sessions_count: response_data.past_sessions.length,
    shame_list_count: response_data.shame_list.length
  })

  // Return the full reconstructed club data
  return successResponse(response_data)
}
