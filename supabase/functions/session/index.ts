// supabase/functions/session/index.ts - Updated for new schema
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
        return await handleGetSession(req, supabaseClient);
      case 'POST':
        return await handleCreateSession(req, supabaseClient);
      case 'PUT':
        return await handleUpdateSession(req, supabaseClient);
      case 'DELETE':
        return await handleDeleteSession(req, supabaseClient);
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
 * Handles GET requests to retrieve session details
 */
async function handleGetSession(req, supabaseClient) {
  try {
    // Get URL parameters
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('id');

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get session data
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single()

    if (sessionError || !sessionData) {
      return new Response(
        JSON.stringify({ error: sessionError?.message || 'Session not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Get club information - now including discord_channel
    const { data: clubData, error: clubError } = await supabaseClient
      .from("clubs")
      .select("id, name, discord_channel")
      .eq("id", sessionData.club_id)
      .single()

    if (clubError) {
      return new Response(
        JSON.stringify({ error: clubError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get book information
    const { data: bookData, error: bookError } = await supabaseClient
      .from("books")
      .select("*")
      .eq("id", sessionData.book_id)
      .single()

    if (bookError) {
      return new Response(
        JSON.stringify({ error: bookError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get discussions
    const { data: discussionsData, error: discussionsError } = await supabaseClient
      .from("discussions")
      .select("*")
      .eq("session_id", sessionId)
      .order("date", { ascending: true })

    if (discussionsError) {
      return new Response(
        JSON.stringify({ error: discussionsError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get shame list - now from club instead of session
    const { data: shameListData, error: shameListError } = await supabaseClient
      .from("shamelist")
      .select("member_id")
      .eq("club_id", clubData.id) // Changed from session_id to club_id

    if (shameListError) {
      return new Response(
        JSON.stringify({ error: shameListError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get member details for shame list
    const memberIds = shameListData.map(item => item.member_id);
    let shameListMembers = [];
    
    if (memberIds.length > 0) {
      const { data: membersData, error: membersError } = await supabaseClient
        .from("members")
        .select("id, name")
        .in("id", memberIds)

      if (membersError) {
        return new Response(
          JSON.stringify({ error: membersError.message }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }
      
      shameListMembers = membersData;
    }

    // Return the session with associated data
    return new Response(
      JSON.stringify({
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
          isbn: bookData.isbn
        },
        due_date: sessionData.due_date,
        discussions: discussionsData.map(discussion => ({
          id: discussion.id,
          title: discussion.title,
          date: discussion.date,
          location: discussion.location
        })),
        shame_list: shameListMembers
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
 * Handles POST requests to create a new session
 */
async function handleCreateSession(req, supabaseClient) {
  try {
    // Get the request body
    const data = await req.json()

    // Validate required fields
    if (!data.club_id) {
      return new Response(
        JSON.stringify({ error: 'Club ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!data.book) {
      return new Response(
        JSON.stringify({ error: 'Book information is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!data.book.title || !data.book.author) {
      return new Response(
        JSON.stringify({ error: 'Book title and author are required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if club exists
    const { data: clubData, error: clubError } = await supabaseClient
      .from("clubs")
      .select("id")
      .eq("id", data.club_id)
      .single()

    if (clubError || !clubData) {
      return new Response(
        JSON.stringify({ error: 'Club not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Insert book data first
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

    if (bookError) {
      return new Response(
        JSON.stringify({ error: bookError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Generate a session ID if not provided
    const sessionId = data.id || crypto.randomUUID();

    // Insert session data (removing default_channel which is now on club level)
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from("sessions")
      .insert({
        id: sessionId,
        club_id: data.club_id,
        book_id: bookData[0].id,
        due_date: data.due_date || null
      })
      .select()

    if (sessionError) {
      return new Response(
        JSON.stringify({ error: sessionError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Insert discussions if provided
    let discussions = [];
    if (data.discussions && Array.isArray(data.discussions) && data.discussions.length > 0) {
      for (const discussion of data.discussions) {
        if (!discussion.title || !discussion.date) {
          continue; // Skip invalid discussions
        }

        const discussionId = discussion.id || crypto.randomUUID();
        
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

        if (discussionError) {
          console.error(`Error adding discussion: ${discussionError.message}`);
          continue;
        }
        
        discussions.push(discussionData[0]);
      }
    }

    // Note: Shame list is now at club level, so we don't add it here for sessions

    // Get club info
    const { data: fullClubData, error: fullClubError } = await supabaseClient
      .from("clubs")
      .select("id, name, discord_channel")
      .eq("id", data.club_id)
      .single()

    if (fullClubError) {
      console.error(`Error getting full club data: ${fullClubError.message}`);
    }

    return new Response(
      JSON.stringify({ 
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
 * Handles PUT requests to update an existing session
 */
async function handleUpdateSession(req, supabaseClient) {
  try {
    // Get the request body
    const data = await req.json()

    // Validate required fields
    if (!data.id) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if session exists
    const { data: existingSession, error: sessionError } = await supabaseClient
      .from("sessions")
      .select("id, book_id")
      .eq("id", data.id)
      .single()

    if (sessionError || !existingSession) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Handle book updates if provided
    let bookId = existingSession.book_id;
    let bookUpdated = false;
    
    if (data.book) {
      // Check if at least one book property is provided
      const hasBookUpdates = ['title', 'author', 'edition', 'year', 'isbn'].some(prop => 
        data.book[prop] !== undefined
      );
      
      if (hasBookUpdates) {
        // Get current book data
        const { data: currentBook, error: bookError } = await supabaseClient
          .from("books")
          .select("*")
          .eq("id", existingSession.book_id)
          .single()

        if (bookError) {
          return new Response(
            JSON.stringify({ error: bookError.message }),
            { headers: { 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        // Update book with new values or keep existing ones
        const bookUpdateData = {
          title: data.book.title !== undefined ? data.book.title : currentBook.title,
          author: data.book.author !== undefined ? data.book.author : currentBook.author,
          edition: data.book.edition !== undefined ? data.book.edition : currentBook.edition,
          year: data.book.year !== undefined ? data.book.year : currentBook.year,
          isbn: data.book.isbn !== undefined ? data.book.isbn : currentBook.isbn
        };

        const { error: updateBookError } = await supabaseClient
          .from("books")
          .update(bookUpdateData)
          .eq("id", existingSession.book_id)

        if (updateBookError) {
          return new Response(
            JSON.stringify({ error: updateBookError.message }),
            { headers: { 'Content-Type': 'application/json' }, status: 500 }
          )
        }
        
        bookUpdated = true;
      }
    }

    // Update session data
    const sessionUpdateData = {};
    if (data.club_id !== undefined) {
      // Verify club exists
      const { data: clubData, error: clubError } = await supabaseClient
        .from("clubs")
        .select("id")
        .eq("id", data.club_id)
        .single()

      if (clubError || !clubData) {
        return new Response(
          JSON.stringify({ 
            error: 'Club not found',
            partial_success: bookUpdated,
            message: bookUpdated ? "Book was updated but session club_id was not" : null
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 404 }
        )
      }
      
      sessionUpdateData.club_id = data.club_id;
    }
    
    if (data.due_date !== undefined) sessionUpdateData.due_date = data.due_date;

    let sessionUpdated = false;
    if (Object.keys(sessionUpdateData).length > 0) {
      const { error: updateSessionError } = await supabaseClient
        .from("sessions")
        .update(sessionUpdateData)
        .eq("id", data.id)

      if (updateSessionError) {
        return new Response(
          JSON.stringify({ 
            error: updateSessionError.message,
            partial_success: bookUpdated,
            message: bookUpdated ? "Book was updated but session was not" : null
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }
      
      sessionUpdated = true;
    }

    // Handle discussions if provided
    let discussionsUpdated = false;
    if (data.discussions !== undefined) {
      if (!Array.isArray(data.discussions)) {
        return new Response(
          JSON.stringify({ 
            error: 'Discussions must be an array',
            partial_success: bookUpdated || sessionUpdated,
            message: "Some updates were applied but discussions were not modified"
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Get existing discussions
      const { data: existingDiscussions, error: getDiscussionsError } = await supabaseClient
        .from("discussions")
        .select("id")
        .eq("session_id", data.id)

      if (getDiscussionsError) {
        return new Response(
          JSON.stringify({ 
            error: getDiscussionsError.message,
            partial_success: bookUpdated || sessionUpdated,
            message: "Some updates were applied but could not retrieve discussions"
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Handle each discussion in the update
      for (const discussion of data.discussions) {
        // Update existing discussions or add new ones
        if (discussion.id) {
          const isExisting = existingDiscussions.some(d => d.id === discussion.id);
          
          if (isExisting) {
            // Update existing discussion
            const updateData = {};
            if (discussion.title !== undefined) updateData.title = discussion.title;
            if (discussion.date !== undefined) updateData.date = discussion.date;
            if (discussion.location !== undefined) updateData.location = discussion.location;

            if (Object.keys(updateData).length > 0) {
              const { error: updateError } = await supabaseClient
                .from("discussions")
                .update(updateData)
                .eq("id", discussion.id)

              if (updateError) {
                console.error(`Error updating discussion ${discussion.id}: ${updateError.message}`);
              } else {
                discussionsUpdated = true;
              }
            }
          } else {
            // Create new discussion with provided ID
            if (!discussion.title || !discussion.date) continue;
            
            const { error: insertError } = await supabaseClient
              .from("discussions")
              .insert({
                id: discussion.id,
                session_id: data.id,
                title: discussion.title,
                date: discussion.date,
                location: discussion.location || null
              })

            if (insertError) {
              console.error(`Error adding discussion ${discussion.id}: ${insertError.message}`);
            } else {
              discussionsUpdated = true;
            }
          }
        } else {
          // Create new discussion with generated ID
          if (!discussion.title || !discussion.date) continue;
          
          const { error: insertError } = await supabaseClient
            .from("discussions")
            .insert({
              id: crypto.randomUUID(),
              session_id: data.id,
              title: discussion.title,
              date: discussion.date,
              location: discussion.location || null
            })

          if (insertError) {
            console.error(`Error adding new discussion: ${insertError.message}`);
          } else {
            discussionsUpdated = true;
          }
        }
      }

      // If a discussion_ids_to_delete array is provided, delete those discussions
      if (data.discussion_ids_to_delete && Array.isArray(data.discussion_ids_to_delete) && data.discussion_ids_to_delete.length > 0) {
        const { error: deleteError } = await supabaseClient
          .from("discussions")
          .delete()
          .in("id", data.discussion_ids_to_delete)
          .eq("session_id", data.id) // Ensure we only delete discussions from this session

        if (deleteError) {
          console.error(`Error deleting discussions: ${deleteError.message}`);
        } else if (data.discussion_ids_to_delete.length > 0) {
          discussionsUpdated = true;
        }
      }
    }

    // Note: Shame list management is now at the club level, not session level

    // If nothing was updated
    if (!bookUpdated && !sessionUpdated && !discussionsUpdated) {
      return new Response(
        JSON.stringify({ message: "No changes to apply" }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Session updated successfully",
        updates: {
          book: bookUpdated,
          session: sessionUpdated,
          discussions: discussionsUpdated
        }
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
 * Handles DELETE requests to remove a session
 */
async function handleDeleteSession(req, supabaseClient) {
  try {
    // Get URL parameters
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('id');

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if session exists and get book_id for later deletion
    const { data: existingSession, error: sessionError } = await supabaseClient
      .from("sessions")
      .select("id, book_id")
      .eq("id", sessionId)
      .single()

    if (sessionError || !existingSession) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Store the book_id for later
    const bookId = existingSession.book_id;

    // Delete discussions first
    const { error: discussionsError } = await supabaseClient
      .from("discussions")
      .delete()
      .eq("session_id", sessionId)

    if (discussionsError) {
      return new Response(
        JSON.stringify({ error: `Failed to delete discussions: ${discussionsError.message}` }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Delete the session
    const { error: deleteSessionError } = await supabaseClient
      .from("sessions")
      .delete()
      .eq("id", sessionId)

    if (deleteSessionError) {
      return new Response(
        JSON.stringify({ error: deleteSessionError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Delete the book
    // TODO: Note: You might want to check if this book is used by other sessions before deleting
    const { error: deleteBookError } = await supabaseClient
      .from("books")
      .delete()
      .eq("id", bookId)

    if (deleteBookError) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Session deleted but could not delete associated book",
          warning: deleteBookError.message
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Session deleted successfully" 
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