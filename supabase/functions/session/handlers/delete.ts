// supabase/functions/session/handlers/delete.ts
// Handles DELETE requests to remove a session

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.76.1'
import { errorResponse, successResponse, corsHeaders } from '../utils/responses.ts'

/**
 * Handles DELETE requests to remove a session
 */
export async function handleDeleteSession(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[SESSION-DELETE] Starting handleDeleteSession`);

    // Get URL parameters
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('id');

    console.log(`[SESSION-DELETE] Request parameters:`, { sessionId });

    if (!sessionId) {
      console.log(`[SESSION-DELETE] Missing session ID - returning 400`);
      return errorResponse('Session ID is required', 400)
    }

    // Check if session exists and get book_id for later deletion
    console.log(`[SESSION-DELETE] Checking if session exists: "${sessionId}"`);
    const { data: existingSession, error: sessionError } = await supabaseClient
      .from("sessions")
      .select("id, book_id")
      .eq("id", sessionId)
      .single()

    console.log(`[SESSION-DELETE] Session existence check:`, {
      found: !!existingSession,
      error: sessionError?.message,
      session: existingSession ? { id: existingSession.id, book_id: existingSession.book_id } : null
    });

    if (sessionError || !existingSession) {
      console.log(`[SESSION-DELETE] Session not found - returning 404`);
      return errorResponse('Session not found', 404)
    }

    // Store the book_id for later
    const bookId = existingSession.book_id;
    console.log(`[SESSION-DELETE] Will delete book_id: ${bookId} after session deletion`);

    // Delete discussions first
    console.log(`[SESSION-DELETE] Deleting discussions for session: "${sessionId}"`);
    const { error: discussionsError } = await supabaseClient
      .from("discussions")
      .delete()
      .eq("session_id", sessionId)

    console.log(`[SESSION-DELETE] Discussions deletion result:`, {
      success: !discussionsError,
      error: discussionsError?.message
    });

    if (discussionsError) {
      console.log(`[SESSION-DELETE] Failed to delete discussions - returning 500`);
      return errorResponse(`Failed to delete discussions: ${discussionsError.message}`, 500)
    }

    // Delete the session
    console.log(`[SESSION-DELETE] Deleting session: "${sessionId}"`);
    const { error: deleteSessionError } = await supabaseClient
      .from("sessions")
      .delete()
      .eq("id", sessionId)

    console.log(`[SESSION-DELETE] Session deletion result:`, {
      success: !deleteSessionError,
      error: deleteSessionError?.message
    });

    if (deleteSessionError) {
      console.log(`[SESSION-DELETE] Session deletion failed - returning 500`);
      return errorResponse(deleteSessionError.message, 500)
    }

    // Delete the book
    // TODO: Note: You might want to check if this book is used by other sessions before deleting
    console.log(`[SESSION-DELETE] Deleting book: ${bookId}`);
    const { error: deleteBookError } = await supabaseClient
      .from("books")
      .delete()
      .eq("id", bookId)

    console.log(`[SESSION-DELETE] Book deletion result:`, {
      success: !deleteBookError,
      error: deleteBookError?.message
    });

    if (deleteBookError) {
      console.log(`[SESSION-DELETE] Book deletion failed - returning partial success`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Session deleted but could not delete associated book",
          warning: deleteBookError.message
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      )
    }

    console.log(`[SESSION-DELETE] Session deletion completed successfully`);

    return successResponse({
      success: true,
      message: "Session deleted successfully"
    })

  } catch (error) {
    console.log(`[SESSION-DELETE] ERROR: ${(error as Error).message}`);
    return errorResponse((error as Error).message, 500)
  }
}
