// supabase/functions/club/handlers/create.ts
// Handles POST requests to create a new club

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse, successResponse } from '../utils/responses.ts'
import { validateServer } from '../utils/validation.ts'

/**
 * Handles POST requests to create a new club
 */
export async function handleCreateClub(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[CLUB-POST] === New POST request received ===`)

    // Get the request body
    const data = await req.json()
    console.log(`[CLUB-POST] Request body:`, JSON.stringify(data, null, 2))

    // Validate required fields
    if (!data.name) {
      console.log(`[CLUB-POST] Missing club name - returning 400`)
      return errorResponse('Club name is required', 400)
    }

    // Server ID is optional - only validate if provided (Discord integration)
    if (data.server_id) {
      console.log(`[CLUB-POST] Validating server: "${data.server_id}"`)
      const serverValidation = await validateServer(supabaseClient, data.server_id)
      console.log(`[CLUB-POST] Server validation result:`, serverValidation)

      if (!serverValidation.valid) {
        console.log(`[CLUB-POST] Server validation failed - returning 404`)
        return errorResponse(serverValidation.error || 'Server not found', 404)
      }
    } else {
      console.log(`[CLUB-POST] Creating club without Discord server association (mobile use case)`)
    }

    // Generate a unique ID if not provided
    if (!data.id) {
      data.id = crypto.randomUUID()
      console.log(`[CLUB-POST] Generated club ID: "${data.id}"`)
    } else {
      console.log(`[CLUB-POST] Using provided club ID: "${data.id}"`)
    }

    // Insert club data with optional server_id and founded_date
    console.log(`[CLUB-POST] Inserting club data:`, {
      id: data.id,
      name: data.name,
      discord_channel: data.discord_channel || null,
      server_id: data.server_id || null,
      founded_date: data.founded_date || null
    })

    const { data: clubData, error: clubError } = await supabaseClient
      .from('clubs')
      .insert({
        id: data.id,
        name: data.name,
        discord_channel: data.discord_channel || null,
        server_id: data.server_id || null,  // Allow NULL for mobile-only clubs
        founded_date: data.founded_date || null
      })
      .select()

    console.log(`[CLUB-POST] Club insert result:`, { success: !!clubData, error: clubError?.message })

    if (clubError) {
      console.log(`[CLUB-POST] Club insert failed - returning 500`)
      return errorResponse(clubError.message, 500)
    }

    // Handle optional members array
    if (data.members && Array.isArray(data.members) && data.members.length > 0) {
      console.log(`[CLUB-POST] Processing ${data.members.length} members...`)

      // Insert each member
      for (const member of data.members) {
        console.log(`[CLUB-POST] Processing member:`, member)

        // Validate member data
        if (!member.id || !member.name) {
          console.log(`[CLUB-POST] Skipping invalid member:`, member)
          continue // Skip invalid members
        }

        // Insert member
        const { error: memberError } = await supabaseClient
          .from('members')
          .upsert({
            id: member.id,
            name: member.name,
            points: member.points || 0,
            books_read: member.books_read || 0
          })

        if (memberError) {
          console.error(`[CLUB-POST] Error adding member ${member.id}: ${memberError.message}`)
          continue
        } else {
          console.log(`[CLUB-POST] Member ${member.id} upserted successfully`)
        }

        // Link member to club
        const { error: linkError } = await supabaseClient
          .from('memberclubs')
          .insert({
            member_id: member.id,
            club_id: data.id
          })

        if (linkError) {
          console.error(`[CLUB-POST] Error linking member ${member.id} to club: ${linkError.message}`)
        } else {
          console.log(`[CLUB-POST] Member ${member.id} linked to club successfully`)
        }
      }
    } else {
      console.log(`[CLUB-POST] No members to process`)
    }

    // Handle optional active_session
    if (data.active_session) {
      console.log(`[CLUB-POST] Processing active session...`)
      const session = data.active_session
      const book = session.book

      // Check required fields
      if (!session.id || !book || !book.title || !book.author) {
        console.log(`[CLUB-POST] Incomplete session data - skipping session creation`)
        return successResponse({
          success: true,
          message: 'Club created successfully but session data was incomplete',
          club: clubData[0]
        })
      }

      // Insert book
      console.log(`[CLUB-POST] Inserting book:`, book)
      const { data: bookData, error: bookError } = await supabaseClient
        .from('books')
        .insert({
          title: book.title,
          author: book.author,
          edition: book.edition || null,
          year: book.year || null,
          isbn: book.isbn || null,
          page_count: book.page_count || null
        })
        .select()

      console.log(`[CLUB-POST] Book insert result:`, { success: !!bookData, error: bookError?.message })

      if (bookError) {
        console.log(`[CLUB-POST] Book insert failed`)
        return successResponse({
          success: true,
          message: 'Club created but failed to add book: ' + bookError.message,
          club: clubData[0]
        })
      }

      // Insert session
      console.log(`[CLUB-POST] Inserting session:`, {
        id: session.id,
        club_id: data.id,
        book_id: bookData[0].id,
        due_date: session.due_date || null
      })

      const { error: sessionError } = await supabaseClient
        .from('sessions')
        .insert({
          id: session.id,
          club_id: data.id,
          book_id: bookData[0].id,
          due_date: session.due_date || null
        })

      console.log(`[CLUB-POST] Session insert result:`, { success: !sessionError, error: sessionError?.message })

      if (sessionError) {
        console.log(`[CLUB-POST] Session insert failed`)
        return successResponse({
          success: true,
          message: 'Club created but failed to add session: ' + sessionError.message,
          club: clubData[0]
        })
      }

      // Add discussions if provided
      if (session.discussions && Array.isArray(session.discussions)) {
        console.log(`[CLUB-POST] Processing ${session.discussions.length} discussions...`)

        for (const discussion of session.discussions) {
          if (!discussion.id || !discussion.title || !discussion.date) {
            console.log(`[CLUB-POST] Skipping invalid discussion:`, discussion)
            continue // Skip invalid discussions
          }

          console.log(`[CLUB-POST] Inserting discussion:`, discussion)
          const { error: discussionError } = await supabaseClient
            .from('discussions')
            .insert({
              id: discussion.id,
              session_id: session.id,
              title: discussion.title,
              date: discussion.date,
              location: discussion.location || null
            })

          if (discussionError) {
            console.error(`[CLUB-POST] Error adding discussion: ${discussionError.message}`)
          } else {
            console.log(`[CLUB-POST] Discussion ${discussion.id} added successfully`)
          }
        }
      } else {
        console.log(`[CLUB-POST] No discussions to process`)
      }
    } else {
      console.log(`[CLUB-POST] No active session to process`)
    }

    // Handle optional shame_list
    if (data.shame_list && Array.isArray(data.shame_list) && data.shame_list.length > 0) {
      console.log(`[CLUB-POST] Processing ${data.shame_list.length} shame list entries...`)

      for (const memberId of data.shame_list) {
        // Verify member exists
        const { data: memberExists, error: memberError } = await supabaseClient
          .from('members')
          .select('id')
          .eq('id', memberId)
          .single()

        if (memberError || !memberExists) {
          console.error(`[CLUB-POST] Member ID ${memberId} not found for shame list`)
          continue
        }

        // Add to shame list
        const { error: shameError } = await supabaseClient
          .from('shamelist')
          .insert({
            club_id: data.id,
            member_id: memberId
          })

        if (shameError) {
          console.error(`[CLUB-POST] Error adding member ${memberId} to shame list: ${shameError.message}`)
        } else {
          console.log(`[CLUB-POST] Member ${memberId} added to shame list successfully`)
        }
      }
    } else {
      console.log(`[CLUB-POST] No shame list to process`)
    }

    console.log(`[CLUB-POST] Club creation completed successfully:`, clubData[0])
    return successResponse({
      success: true,
      message: 'Club created successfully',
      club: clubData[0]
    })

  } catch (error) {
    console.log(`[CLUB-POST] ERROR: ${(error as Error).message}`)
    return errorResponse((error as Error).message, 500)
  }
}
