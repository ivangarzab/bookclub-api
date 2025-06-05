// supabase/functions/session/index.ts - Updated for new schema with debug logs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    console.log(`[SESSION] === New ${req.method} request received ===`);
    
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
        console.log(`[SESSION] Method not allowed: ${req.method}`);
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { headers: { 'Content-Type': 'application/json' }, status: 405 }
        );
    }
  } catch (error) {
    console.log(`[SESSION] FATAL ERROR: ${error.message}`);
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
    console.log(`[SESSION-GET] Starting handleGetSession`);
    
    // Get URL parameters
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('id');

    console.log(`[SESSION-GET] Request parameters:`, { sessionId });

    if (!sessionId) {
      console.log(`[SESSION-GET] Missing session ID - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      );
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
      return new Response(
        JSON.stringify({ error: sessionError?.message || 'Session not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
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
      return new Response(
        JSON.stringify({ error: clubError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
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
      return new Response(
        JSON.stringify({ error: bookError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
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
      return new Response(
        JSON.stringify({ error: discussionsError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get shame list - now from club instead of session
    console.log(`[SESSION-GET] Getting shame list for club_id: "${clubData.id}"`);
    const { data: shameListData, error: shameListError } = await supabaseClient
      .from("shamelist")
      .select("member_id")
      .eq("club_id", clubData.id) // Changed from session_id to club_id

    console.log(`[SESSION-GET] Shame list query result:`, { 
      count: shameListData?.length || 0, 
      error: shameListError?.message,
      member_ids: shameListData?.map(s => s.member_id) || []
    });

    if (shameListError) {
      console.log(`[SESSION-GET] Shame list query failed - returning 500`);
      return new Response(
        JSON.stringify({ error: shameListError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get member details for shame list
    const memberIds = shameListData.map(item => item.member_id);
    let shameListMembers = [];
    
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
        return new Response(
          JSON.stringify({ error: membersError.message }),
          { headers: { 'Content-Type': 'application/json' }, status: 500 }
        )
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
    };

    console.log(`[SESSION-GET] Session details completed - returning data:`, {
      session_id: responseData.id,
      club_name: responseData.club.name,
      book_title: responseData.book.title,
      discussions_count: responseData.discussions.length,
      shame_list_count: responseData.shame_list.length
    });

    // Return the session with associated data
    return new Response(
      JSON.stringify(responseData),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.log(`[SESSION-GET] ERROR: ${error.message}`);
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
    console.log(`[SESSION-POST] Starting handleCreateSession`);
    
    // Get the request body
    const data = await req.json()
    console.log(`[SESSION-POST] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.club_id) {
      console.log(`[SESSION-POST] Missing club_id - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Club ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!data.book) {
      console.log(`[SESSION-POST] Missing book data - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Book information is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!data.book.title || !data.book.author) {
      console.log(`[SESSION-POST] Missing book title/author - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Book title and author are required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
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
      return new Response(
        JSON.stringify({ error: 'Club not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
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
      return new Response(
        JSON.stringify({ error: bookError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
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
      return new Response(
        JSON.stringify({ error: sessionError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
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
      .select("id, name, discord_channel")
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

    return new Response(
      JSON.stringify(responseData),
      { headers: { 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.log(`[SESSION-POST] ERROR: ${error.message}`);
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
    console.log(`[SESSION-PUT] Starting handleUpdateSession`);
    
    // Get the request body
    const data = await req.json()
    console.log(`[SESSION-PUT] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.id) {
      console.log(`[SESSION-PUT] Missing session ID - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
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
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
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
          return new Response(
            JSON.stringify({ error: updateBookError.message }),
            { headers: { 'Content-Type': 'application/json' }, status: 500 }
          )
        }
        
        bookUpdated = true;
      } else {
        console.log(`[SESSION-PUT] No book property updates detected`);
      }
    } else {
      console.log(`[SESSION-PUT] No book updates requested`);
    }

    // Update session data
    const sessionUpdateData = {};
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
    } else {
      console.log(`[SESSION-PUT] No session fields to update`);
    }

    // Handle discussions if provided
    let discussionsUpdated = false;
    if (data.discussions !== undefined) {
      console.log(`[SESSION-PUT] Processing discussions update:`, data.discussions);
      
      if (!Array.isArray(data.discussions)) {
        console.log(`[SESSION-PUT] Invalid discussions format - returning 400`);
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
      console.log(`[SESSION-PUT] Processing ${data.discussions.length} discussions...`);
      
      for (const discussion of data.discussions) {
        // Update existing discussions or add new ones
        if (discussion.id) {
          const isExisting = existingDiscussions.some(d => d.id === discussion.id);
          
          if (isExisting) {
            console.log(`[SESSION-PUT] Updating existing discussion: "${discussion.id}"`);
            
            // Update existing discussion
            const updateData = {};
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
                console.error(`[SESSION-PUT] Error updating discussion ${discussion.id}: ${updateError.message}`);
              } else {
                discussionsUpdated = true;
              }
            }
          } else {
            console.log(`[SESSION-PUT] Creating new discussion with provided ID: "${discussion.id}"`);
            
            // Create new discussion with provided ID
            if (!discussion.title || !discussion.date) {
              console.log(`[SESSION-PUT] Skipping invalid discussion:`, discussion);
              continue;
            }
            
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
              console.error(`[SESSION-PUT] Error adding discussion ${discussion.id}: ${insertError.message}`);
            } else {
              discussionsUpdated = true;
            }
          }
        } else {
          console.log(`[SESSION-PUT] Creating new discussion with generated ID`);
          
          // Create new discussion with generated ID
          if (!discussion.title || !discussion.date) {
            console.log(`[SESSION-PUT] Skipping invalid discussion:`, discussion);
            continue;
          }
          
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
            console.error(`[SESSION-PUT] Error adding new discussion: ${insertError.message}`);
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
      return new Response(
        JSON.stringify({ message: "No changes to apply" }),
        { headers: { 'Content-Type': 'application/json' } }
      )
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

    return new Response(
      JSON.stringify(responseData),
      { headers: { 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.log(`[SESSION-PUT] ERROR: ${error.message}`);
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
    console.log(`[SESSION-DELETE] Starting handleDeleteSession`);
    
    // Get URL parameters
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('id');

    console.log(`[SESSION-DELETE] Request parameters:`, { sessionId });

    if (!sessionId) {
      console.log(`[SESSION-DELETE] Missing session ID - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
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
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 404 }
      )
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
      return new Response(
        JSON.stringify({ error: `Failed to delete discussions: ${discussionsError.message}` }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
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
      return new Response(
        JSON.stringify({ error: deleteSessionError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
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
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[SESSION-DELETE] Session deletion completed successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Session deleted successfully" 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.log(`[SESSION-DELETE] ERROR: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}