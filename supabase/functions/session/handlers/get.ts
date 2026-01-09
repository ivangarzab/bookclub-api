// supabase/functions/session/handlers/get.ts
// Handles GET requests to retrieve session details

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.76.1'
import { errorResponse, successResponse } from '../utils/responses.ts'

/**
 * Handles GET requests to retrieve session details
 */
export async function handleGetSession(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[SESSION-GET] Starting handleGetSession`);

    // Get URL parameters
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('id');

    console.log(`[SESSION-GET] Request parameters:`, { sessionId });

    if (!sessionId) {
      console.log(`[SESSION-GET] Missing session ID - returning 400`);
      return errorResponse('Session ID is required', 400);
    }

    // Get session data
    console.log(`[SESSION-GET] Querying session: "${sessionId}"`);
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single()

    console.log(`[SESSION-GET] Session query result:`, {
      found: !!sessionData,
      error: sessionError?.message,
      session: sessionData ? {
        id: sessionData.id,
        club_id: sessionData.club_id,
        book_id: sessionData.book_id,
        due_date: sessionData.due_date
      } : null
    });

    if (sessionError || !sessionData) {
      console.log(`[SESSION-GET] Session not found - returning 404`);
      return errorResponse(sessionError?.message || 'Session not found', 404)
    }

    // Get club information - now including discord_channel
    console.log(`[SESSION-GET] Getting club info for club_id: "${sessionData.club_id}"`);
    const { data: clubData, error: clubError } = await supabaseClient
      .from("clubs")
      .select("id, name, discord_channel")
      .eq("id", sessionData.club_id)
      .single()

    console.log(`[SESSION-GET] Club query result:`, {
      found: !!clubData,
      error: clubError?.message,
      club: clubData ? { id: clubData.id, name: clubData.name } : null
    });

    if (clubError) {
      console.log(`[SESSION-GET] Club query failed - returning 500`);
      return errorResponse(clubError.message, 500)
    }

    // Get book information
    console.log(`[SESSION-GET] Getting book info for book_id: ${sessionData.book_id}`);
    const { data: bookData, error: bookError } = await supabaseClient
      .from("books")
      .select("*")
      .eq("id", sessionData.book_id)
      .single()

    console.log(`[SESSION-GET] Book query result:`, {
      found: !!bookData,
      error: bookError?.message,
      book: bookData ? { id: bookData.id, title: bookData.title, author: bookData.author } : null
    });

    if (bookError) {
      console.log(`[SESSION-GET] Book query failed - returning 500`);
      return errorResponse(bookError.message, 500)
    }

    // Get discussions
    console.log(`[SESSION-GET] Getting discussions for session_id: "${sessionId}"`);
    const { data: discussionsData, error: discussionsError } = await supabaseClient
      .from("discussions")
      .select("*")
      .eq("session_id", sessionId)
      .order("date", { ascending: true })

    console.log(`[SESSION-GET] Discussions query result:`, {
      count: discussionsData?.length || 0,
      error: discussionsError?.message,
      discussions: discussionsData?.map(d => ({ id: d.id, title: d.title, date: d.date })) || []
    });

    if (discussionsError) {
      console.log(`[SESSION-GET] Discussions query failed - returning 500`);
      return errorResponse(discussionsError.message, 500)
    }

    // Get shame list - now from club instead of session
    console.log(`[SESSION-GET] Getting shame list for club_id: "${clubData.id}"`);
    const { data: shameListData, error: shameListError } = await supabaseClient
      .from("shamelist")
      .select("member_id")
      .eq("club_id", clubData.id)

    console.log(`[SESSION-GET] Shame list query result:`, {
      count: shameListData?.length || 0,
      error: shameListError?.message,
      member_ids: shameListData?.map(s => s.member_id) || []
    });

    if (shameListError) {
      console.log(`[SESSION-GET] Shame list query failed - returning 500`);
      return errorResponse(shameListError.message, 500)
    }

    // Get member details for shame list
    const memberIds = shameListData.map(item => item.member_id);
    let shameListMembers: Array<Record<string, unknown>> = [];

    if (memberIds.length > 0) {
      console.log(`[SESSION-GET] Getting member details for shame list:`, memberIds);

      const { data: membersData, error: membersError } = await supabaseClient
        .from("members")
        .select("id, name")
        .in("id", memberIds)

      console.log(`[SESSION-GET] Shame list members query result:`, {
        count: membersData?.length || 0,
        error: membersError?.message,
        members: membersData?.map(m => ({ id: m.id, name: m.name })) || []
      });

      if (membersError) {
        console.log(`[SESSION-GET] Shame list members query failed - returning 500`);
        return errorResponse(membersError.message, 500)
      }

      shameListMembers = membersData;
    } else {
      console.log(`[SESSION-GET] No members in shame list`);
    }

    const responseData = {
      id: sessionData.id,
      club: {
        ...clubData,
        // Include discord_channel from club data
      },
      book: {
        id: bookData.id,
        title: bookData.title,
        author: bookData.author,
        edition: bookData.edition,
        year: bookData.year,
        isbn: bookData.isbn,
        page_count: bookData.page_count
      },
      due_date: sessionData.due_date,
      discussions: discussionsData.map(discussion => ({
        id: discussion.id,
        session_id: discussion.session_id,
        title: discussion.title,
        date: discussion.date,
        location: discussion.location
      })),
      shame_list: shameListMembers
    };

    console.log(`[SESSION-GET] Session details completed - returning data:`, {
      session_id: responseData.id,
      club_name: responseData.club.name,
      book_title: responseData.book.title,
      discussions_count: responseData.discussions.length,
      shame_list_count: responseData.shame_list.length
    });

    // Return the session with associated data
    return successResponse(responseData)
  } catch (error) {
    console.log(`[SESSION-GET] ERROR: ${(error as Error).message}`);
    return errorResponse((error as Error).message, 500)
  }
}
