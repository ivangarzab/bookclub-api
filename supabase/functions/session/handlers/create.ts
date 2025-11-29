// supabase/functions/session/handlers/create.ts
// Handles POST requests to create a new session

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, successResponse } from '../utils/responses.ts'

/**
 * Handles POST requests to create a new session
 */
export async function handleCreateSession(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[SESSION-POST] Starting handleCreateSession`);

    // Get the request body
    const data = await req.json()
    console.log(`[SESSION-POST] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.club_id) {
      console.log(`[SESSION-POST] Missing club_id - returning 400`);
      return errorResponse('Club ID is required', 400)
    }

    if (!data.book) {
      console.log(`[SESSION-POST] Missing book data - returning 400`);
      return errorResponse('Book information is required', 400)
    }

    if (!data.book.title || !data.book.author) {
      console.log(`[SESSION-POST] Missing book title/author - returning 400`);
      return errorResponse('Book title and author are required', 400)
    }

    // Check if club exists
    console.log(`[SESSION-POST] Checking if club exists: "${data.club_id}" (type: ${typeof data.club_id})`);
    const { data: clubData, error: clubError } = await supabaseClient
      .from("clubs")
      .select("id")
      .eq("id", data.club_id)
      .single()

    console.log(`[SESSION-POST] Club existence check:`, {
      found: !!clubData,
      error: clubError?.message,
      club: clubData ? { id: clubData.id } : null
    });

    if (clubError || !clubData) {
      console.log(`[SESSION-POST] Club not found - returning 404`);
      return errorResponse('Club not found', 404)
    }

    // Insert book data first
    console.log(`[SESSION-POST] Inserting book data:`, {
      title: data.book.title,
      author: data.book.author,
      edition: data.book.edition || null,
      year: data.book.year || null,
      isbn: data.book.isbn || null
    });

    const { data: bookData, error: bookError } = await supabaseClient
      .from("books")
      .insert({
        title: data.book.title,
        author: data.book.author,
        edition: data.book.edition || null,
        year: data.book.year || null,
        isbn: data.book.isbn || null
      })
      .select()

    console.log(`[SESSION-POST] Book insert result:`, {
      success: !!bookData,
      error: bookError?.message,
      book: bookData?.[0] ? { id: bookData[0].id, title: bookData[0].title } : null
    });

    if (bookError) {
      console.log(`[SESSION-POST] Book insert failed - returning 500`);
      return errorResponse(bookError.message, 500)
    }

    // Generate a session ID if not provided
    const sessionId = data.id || crypto.randomUUID();
    console.log(`[SESSION-POST] Using session ID: "${sessionId}" (provided: ${!!data.id})`);

    // Insert session data (removing default_channel which is now on club level)
    console.log(`[SESSION-POST] Inserting session data:`, {
      id: sessionId,
      club_id: data.club_id,
      club_id_type: typeof data.club_id,
      book_id: bookData[0].id,
      due_date: data.due_date || null
    });

    const { data: sessionData, error: sessionError } = await supabaseClient
      .from("sessions")
      .insert({
        id: sessionId,
        club_id: data.club_id,
        book_id: bookData[0].id,
        due_date: data.due_date || null
      })
      .select()

    console.log(`[SESSION-POST] Session insert result:`, {
      success: !!sessionData,
      error: sessionError?.message,
      session: sessionData?.[0] ? {
        id: sessionData[0].id,
        club_id: sessionData[0].club_id,
        book_id: sessionData[0].book_id,
        due_date: sessionData[0].due_date
      } : null
    });

    if (sessionError) {
      console.log(`[SESSION-POST] Session insert failed - returning 500`);
      return errorResponse(sessionError.message, 500)
    }

    // Insert discussions if provided
    let discussions = [];
    if (data.discussions && Array.isArray(data.discussions) && data.discussions.length > 0) {
      console.log(`[SESSION-POST] Processing ${data.discussions.length} discussions...`);

      for (const discussion of data.discussions) {
        if (!discussion.title || !discussion.date) {
          console.log(`[SESSION-POST] Skipping invalid discussion:`, discussion);
          continue; // Skip invalid discussions
        }

        const discussionId = discussion.id || crypto.randomUUID();
        console.log(`[SESSION-POST] Inserting discussion:`, {
          id: discussionId,
          session_id: sessionId,
          title: discussion.title,
          date: discussion.date,
          location: discussion.location || null
        });

        const { data: discussionData, error: discussionError } = await supabaseClient
          .from("discussions")
          .insert({
            id: discussionId,
            session_id: sessionId,
            title: discussion.title,
            date: discussion.date,
            location: discussion.location || null
          })
          .select()

        console.log(`[SESSION-POST] Discussion insert result:`, {
          success: !!discussionData,
          error: discussionError?.message,
          discussion: discussionData?.[0] ? {
            id: discussionData[0].id,
            title: discussionData[0].title
          } : null
        });

        if (discussionError) {
          console.error(`[SESSION-POST] Error adding discussion: ${discussionError.message}`);
          continue;
        }

        discussions.push(discussionData[0]);
      }
    } else {
      console.log(`[SESSION-POST] No discussions to process`);
    }

    // Note: Shame list is now at club level, so we don't add it here for sessions
    console.log(`[SESSION-POST] Shame list is now managed at club level - skipping`);

    // Get club info
    console.log(`[SESSION-POST] Getting full club data for response`);
    const { data: fullClubData, error: fullClubError } = await supabaseClient
      .from("clubs")
      .select("id, name, discord_channel::text")
      .eq("id", data.club_id)
      .single()

    console.log(`[SESSION-POST] Full club data result:`, {
      found: !!fullClubData,
      error: fullClubError?.message,
      club: fullClubData ? { id: fullClubData.id, name: fullClubData.name } : null
    });

    if (fullClubError) {
      console.error(`[SESSION-POST] Error getting full club data: ${fullClubError.message}`);
    }

    const responseData = {
      success: true,
      message: "Session created successfully",
      session: {
        id: sessionId,
        club: fullClubData || { id: data.club_id },
        book: {
          id: bookData[0].id,
          title: bookData[0].title,
          author: bookData[0].author,
          edition: bookData[0].edition,
          year: bookData[0].year,
          isbn: bookData[0].isbn
        },
        due_date: sessionData[0].due_date,
        discussions: discussions
      }
    };

    console.log(`[SESSION-POST] Session creation completed successfully:`, {
      session_id: responseData.session.id,
      club_id: responseData.session.club.id,
      book_title: responseData.session.book.title,
      discussions_count: responseData.session.discussions.length
    });

    return successResponse(responseData)

  } catch (error) {
    console.log(`[SESSION-POST] ERROR: ${(error as Error).message}`);
    return errorResponse((error as Error).message, 500)
  }
}
