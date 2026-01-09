// supabase/functions/session/handlers/update.ts
// Handles PUT requests to update an existing session

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.76.1'
import { errorResponse, successResponse, corsHeaders } from '../utils/responses.ts'
import { validateDiscussionsArray } from '../utils/validation.ts'

/**
 * Handles PUT requests to update an existing session
 */
export async function handleUpdateSession(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[SESSION-PUT] Starting handleUpdateSession`);

    // Get the request body
    const data = await req.json()
    console.log(`[SESSION-PUT] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.id) {
      console.log(`[SESSION-PUT] Missing session ID - returning 400`);
      return errorResponse('Session ID is required', 400)
    }

    // Check if session exists
    console.log(`[SESSION-PUT] Checking if session exists: "${data.id}"`);
    const { data: existingSession, error: sessionError } = await supabaseClient
      .from("sessions")
      .select("id, book_id")
      .eq("id", data.id)
      .single()

    console.log(`[SESSION-PUT] Session existence check:`, {
      found: !!existingSession,
      error: sessionError?.message,
      session: existingSession ? { id: existingSession.id, book_id: existingSession.book_id } : null
    });

    if (sessionError || !existingSession) {
      console.log(`[SESSION-PUT] Session not found - returning 404`);
      return errorResponse('Session not found', 404)
    }

    // Handle book updates if provided
    let bookId = existingSession.book_id;
    let bookUpdated = false;

    if (data.book) {
      console.log(`[SESSION-PUT] Processing book updates:`, data.book);

      // Check if at least one book property is provided
      const hasBookUpdates = ['title', 'author', 'edition', 'year', 'isbn'].some(prop =>
        data.book[prop] !== undefined
      );

      if (hasBookUpdates) {
        console.log(`[SESSION-PUT] Book updates detected - getting current book data`);

        // Get current book data
        const { data: currentBook, error: bookError } = await supabaseClient
          .from("books")
          .select("*")
          .eq("id", existingSession.book_id)
          .single()

        console.log(`[SESSION-PUT] Current book data:`, {
          found: !!currentBook,
          error: bookError?.message,
          book: currentBook ? { id: currentBook.id, title: currentBook.title } : null
        });

        if (bookError) {
          console.log(`[SESSION-PUT] Failed to get current book - returning 500`);
          return errorResponse(bookError.message, 500)
        }

        // Update book with new values or keep existing ones
        const bookUpdateData = {
          title: data.book.title !== undefined ? data.book.title : currentBook.title,
          author: data.book.author !== undefined ? data.book.author : currentBook.author,
          edition: data.book.edition !== undefined ? data.book.edition : currentBook.edition,
          year: data.book.year !== undefined ? data.book.year : currentBook.year,
          isbn: data.book.isbn !== undefined ? data.book.isbn : currentBook.isbn
        };

        console.log(`[SESSION-PUT] Updating book with data:`, bookUpdateData);

        const { error: updateBookError } = await supabaseClient
          .from("books")
          .update(bookUpdateData)
          .eq("id", existingSession.book_id)

        console.log(`[SESSION-PUT] Book update result:`, {
          success: !updateBookError,
          error: updateBookError?.message
        });

        if (updateBookError) {
          console.log(`[SESSION-PUT] Book update failed - returning 500`);
          return errorResponse(updateBookError.message, 500)
        }

        bookUpdated = true;
      } else {
        console.log(`[SESSION-PUT] No book property updates detected`);
      }
    } else {
      console.log(`[SESSION-PUT] No book updates requested`);
    }

    // Update session data
    const sessionUpdateData: Record<string, unknown> = {};
    if (data.club_id !== undefined) {
      console.log(`[SESSION-PUT] Club ID update requested: "${data.club_id}"`);

      // Verify club exists
      const { data: clubData, error: clubError } = await supabaseClient
        .from("clubs")
        .select("id")
        .eq("id", data.club_id)
        .single()

      console.log(`[SESSION-PUT] Club verification:`, {
        found: !!clubData,
        error: clubError?.message
      });

      if (clubError || !clubData) {
        console.log(`[SESSION-PUT] Club not found - returning 404`);
        return errorResponse('Club not found', 404)
      }

      sessionUpdateData.club_id = data.club_id;
    }

    if (data.due_date !== undefined) {
      console.log(`[SESSION-PUT] Due date update requested: "${data.due_date}"`);
      sessionUpdateData.due_date = data.due_date;
    }

    console.log(`[SESSION-PUT] Session update data prepared:`, sessionUpdateData);

    let sessionUpdated = false;
    if (Object.keys(sessionUpdateData).length > 0) {
      console.log(`[SESSION-PUT] Updating session with data:`, sessionUpdateData);

      const { error: updateSessionError } = await supabaseClient
        .from("sessions")
        .update(sessionUpdateData)
        .eq("id", data.id)

      console.log(`[SESSION-PUT] Session update result:`, {
        success: !updateSessionError,
        error: updateSessionError?.message
      });

      if (updateSessionError) {
        console.log(`[SESSION-PUT] Session update failed - returning 500`);
        return errorResponse(updateSessionError.message, 500)
      }

      sessionUpdated = true;
    } else {
      console.log(`[SESSION-PUT] No session fields to update`);
    }

    // Handle discussions if provided
    let discussionsUpdated = false;
    if (data.discussions !== undefined) {
      console.log(`[SESSION-PUT] Processing discussions update:`, data.discussions);

      const validation = validateDiscussionsArray(data.discussions)
      if (!validation.valid) {
        console.log(`[SESSION-PUT] Invalid discussion at index ${validation.invalidIndex} - returning 400`);
        return errorResponse(validation.error || 'Invalid discussion data', 400)
      }

      // Get existing discussions
      console.log(`[SESSION-PUT] Getting existing discussions for session: "${data.id}"`);
      const { data: existingDiscussions, error: getDiscussionsError } = await supabaseClient
        .from("discussions")
        .select("id")
        .eq("session_id", data.id)

      console.log(`[SESSION-PUT] Existing discussions:`, {
        count: existingDiscussions?.length || 0,
        error: getDiscussionsError?.message,
        discussion_ids: existingDiscussions?.map(d => d.id) || []
      });

      if (getDiscussionsError) {
        console.log(`[SESSION-PUT] Failed to get existing discussions - returning 500`);
        return errorResponse(getDiscussionsError.message, 500)
      }

      // Handle each discussion in the update
      console.log(`[SESSION-PUT] Processing ${data.discussions.length} discussions...`);

      for (const discussion of data.discussions) {
        // Update existing discussions or add new ones
        if (discussion.id) {
          const isExisting = existingDiscussions.some(d => d.id === discussion.id);

          if (isExisting) {
            console.log(`[SESSION-PUT] Updating existing discussion: "${discussion.id}"`);

            // Update existing discussion
            const updateData: Record<string, unknown> = {};
            if (discussion.title !== undefined) updateData.title = discussion.title;
            if (discussion.date !== undefined) updateData.date = discussion.date;
            if (discussion.location !== undefined) updateData.location = discussion.location;

            console.log(`[SESSION-PUT] Discussion update data:`, updateData);

            if (Object.keys(updateData).length > 0) {
              const { error: updateError } = await supabaseClient
                .from("discussions")
                .update(updateData)
                .eq("id", discussion.id)

              console.log(`[SESSION-PUT] Discussion update result:`, {
                success: !updateError,
                error: updateError?.message
              });

              if (updateError) {
                console.error(`[SESSION-PUT] Warning: Discussion update failed: ${updateError.message}`);
                // Continue - don't fail the entire update
              } else {
                discussionsUpdated = true;
              }
            }
          } else {
            console.log(`[SESSION-PUT] Creating new discussion with provided ID: "${discussion.id}"`);

            // Create new discussion with provided ID
            const { error: insertError } = await supabaseClient
              .from("discussions")
              .insert({
                id: discussion.id,
                session_id: data.id,
                title: discussion.title,
                date: discussion.date,
                location: discussion.location || null
              })

            console.log(`[SESSION-PUT] New discussion insert result:`, {
              success: !insertError,
              error: insertError?.message
            });

            if (insertError) {
              console.error(`[SESSION-PUT] Warning: Discussion insert failed: ${insertError.message}`);
              // Continue - don't fail the entire update
            } else {
              discussionsUpdated = true;
            }
          }
        } else {
          console.log(`[SESSION-PUT] Creating new discussion with generated ID`);

          // Create new discussion with generated ID
          const { error: insertError } = await supabaseClient
            .from("discussions")
            .insert({
              id: crypto.randomUUID(),
              session_id: data.id,
              title: discussion.title,
              date: discussion.date,
              location: discussion.location || null
            })

          console.log(`[SESSION-PUT] New discussion (generated ID) insert result:`, {
            success: !insertError,
            error: insertError?.message
          });

          if (insertError) {
            console.error(`[SESSION-PUT] Warning: Discussion insert failed: ${insertError.message}`);
            // Continue - don't fail the entire update
          } else {
            discussionsUpdated = true;
          }
        }
      }

      // If a discussion_ids_to_delete array is provided, delete those discussions
      if (data.discussion_ids_to_delete && Array.isArray(data.discussion_ids_to_delete) && data.discussion_ids_to_delete.length > 0) {
        console.log(`[SESSION-PUT] Deleting discussions:`, data.discussion_ids_to_delete);

        const { error: deleteError } = await supabaseClient
          .from("discussions")
          .delete()
          .in("id", data.discussion_ids_to_delete)
          .eq("session_id", data.id) // Ensure we only delete discussions from this session

        console.log(`[SESSION-PUT] Discussion deletion result:`, {
          success: !deleteError,
          error: deleteError?.message
        });

        if (deleteError) {
          console.error(`[SESSION-PUT] Error deleting discussions: ${deleteError.message}`);
        } else if (data.discussion_ids_to_delete.length > 0) {
          discussionsUpdated = true;
        }
      }
    } else {
      console.log(`[SESSION-PUT] No discussions updates requested`);
    }

    // Note: Shame list management is now at the club level, not session level
    console.log(`[SESSION-PUT] Shame list is now managed at club level - skipping`);

    // If nothing was updated
    if (!bookUpdated && !sessionUpdated && !discussionsUpdated) {
      console.log(`[SESSION-PUT] No changes applied - returning message`);
      return successResponse({
        success: true,
        message: "No changes to apply"
      })
    }

    const responseData = {
      success: true,
      message: "Session updated successfully",
      updates: {
        book: bookUpdated,
        session: sessionUpdated,
        discussions: discussionsUpdated
      }
    };

    console.log(`[SESSION-PUT] Session update completed successfully:`, responseData.updates);

    return successResponse(responseData)

  } catch (error) {
    console.log(`[SESSION-PUT] ERROR: ${(error as Error).message}`);
    return errorResponse((error as Error).message, 500)
  }
}
