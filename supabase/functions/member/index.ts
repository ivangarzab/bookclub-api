// supabase/functions/member/index.ts - Updated for new schema with debug logs and CORS
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    console.log(`[MEMBER] === New ${req.method} request received ===`);

    // Create Supabase client if not provided (for testing)
    const client = supabaseClient || createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Determine which operation to perform based on HTTP method
    switch (req.method) {
      case 'GET':
        return await handleGetMember(req, client);
      case 'POST':
        return await handleCreateMember(req, client);
      case 'PUT':
        return await handleUpdateMember(req, client);
      case 'DELETE':
        return await handleDeleteMember(req, client);
      default:
        console.log(`[MEMBER] Method not allowed: ${req.method}`);
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
    console.log(`[MEMBER] FATAL ERROR: ${error.message}`);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
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
 * Handles GET requests to retrieve member details
 */
async function handleGetMember(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[MEMBER-GET] Starting handleGetMember`);
    
    // Get URL parameters
    const url = new URL(req.url);
    const memberId = url.searchParams.get('id');
    const userId = url.searchParams.get('user_id');

    console.log(`[MEMBER-GET] Request parameters:`, { memberId, userId });

    // Validate that we have either id or user_id
    if (!memberId && !userId) {
      console.log(`[MEMBER-GET] Missing both member ID and user ID - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Either Member ID or User ID is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      );
    }

    let memberData;
    let memberError;

    if (userId) {
      // Search by user_id (new functionality)
      console.log(`[MEMBER-GET] Querying member by user_id: "${userId}"`);
      const result = await supabaseClient
        .from("members")
        .select("*")
        .eq("user_id", userId)
        .single()
      
      memberData = result.data;
      memberError = result.error;
    } else {
      // Search by member id (existing functionality)
      console.log(`[MEMBER-GET] Querying member by id: "${memberId}"`);
      const result = await supabaseClient
        .from("members")
        .select("*")
        .eq("id", memberId)
        .single()
      
      memberData = result.data;
      memberError = result.error;
    }

    console.log(`[MEMBER-GET] Member query result:`, { 
      found: !!memberData, 
      error: memberError?.message,
      member: memberData ? { 
        id: memberData.id, 
        name: memberData.name, 
        points: memberData.points,
        books_read: memberData.books_read,
        user_id: memberData.user_id,
        role: memberData.role,
      } : null
    });

    if (memberError || !memberData) {
      console.log(`[MEMBER-GET] Member not found - returning 404`);
      return new Response(
        JSON.stringify({ error: memberError?.message || 'Member not found' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 404 
        }
      )
    }

    // Get clubs this member belongs to
    console.log(`[MEMBER-GET] Getting club associations for member: "${memberData.id}"`);
    const { data: memberClubs, error: memberClubsError } = await supabaseClient
      .from("memberclubs")
      .select("club_id")
      .eq("member_id", memberData.id)

    console.log(`[MEMBER-GET] Member clubs query result:`, { 
      count: memberClubs?.length || 0, 
      error: memberClubsError?.message,
      club_ids: memberClubs?.map(mc => mc.club_id) || []
    });

    if (memberClubsError) {
      console.log(`[MEMBER-GET] Member clubs query failed - returning 500`);
      return new Response(
        JSON.stringify({ error: memberClubsError.message }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    // Get club details
    const clubIds = memberClubs.map(mc => mc.club_id);
    let clubs: Array<Record<string, unknown>> = [];
    
    if (clubIds.length > 0) {
      console.log(`[MEMBER-GET] Getting details for ${clubIds.length} clubs:`, clubIds);

      const { data: clubsData, error: clubsError } = await supabaseClient
        .from("clubs")
        .select("id, name, discord_channel::text")
        .in("id", clubIds)

      console.log(`[MEMBER-GET] Clubs details query result:`, { 
        count: clubsData?.length || 0, 
        error: clubsError?.message,
        clubs: clubsData?.map(c => ({ id: c.id, name: c.name })) || []
      });

      if (clubsError) {
        console.log(`[MEMBER-GET] Clubs details query failed - returning 500`);
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
      
      clubs = clubsData;
    } else {
      console.log(`[MEMBER-GET] Member belongs to no clubs`);
    }

    // Get shame list entries for this member (now from club level)
    console.log(`[MEMBER-GET] Getting shame list entries for member: "${memberData.id}"`);
    const { data: shameData, error: shameError } = await supabaseClient
      .from("shamelist")
      .select("club_id")
      .eq("member_id", memberData.id)

    console.log(`[MEMBER-GET] Shame list query result:`, { 
      count: shameData?.length || 0, 
      error: shameError?.message,
      shame_club_ids: shameData?.map(s => s.club_id) || []
    });

    if (shameError) {
      console.log(`[MEMBER-GET] Shame list query failed - returning 500`);
      return new Response(
        JSON.stringify({ error: shameError.message }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    // Get club info for shame list
    const shameClubIds = shameData.map(s => s.club_id);
    let shameClubs: Array<Record<string, unknown>> = [];
    
    if (shameClubIds.length > 0) {
      console.log(`[MEMBER-GET] Getting details for ${shameClubIds.length} shame clubs:`, shameClubIds);

      const { data: clubsData, error: clubsError } = await supabaseClient
        .from("clubs")
        .select("id, name, discord_channel::text")
        .in("id", shameClubIds)

      console.log(`[MEMBER-GET] Shame clubs details query result:`, { 
        count: clubsData?.length || 0, 
        error: clubsError?.message,
        clubs: clubsData?.map(c => ({ id: c.id, name: c.name })) || []
      });

      if (clubsError) {
        console.log(`[MEMBER-GET] Shame clubs details query failed - returning 500`);
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
      
      shameClubs = clubsData;
    } else {
      console.log(`[MEMBER-GET] Member is not on any shame lists`);
    }

    const responseData = {
      id: memberData.id,
      name: memberData.name,
      points: memberData.points,
      books_read: memberData.books_read,
      user_id: memberData.user_id,
      role: memberData.role,
      clubs: clubs,
      shame_clubs: shameClubs
    };

    console.log(`[MEMBER-GET] Member details completed - returning data:`, {
      member_id: responseData.id,
      member_name: responseData.name,
      user_id: responseData.user_id,
      role: responseData.role,
      clubs_count: responseData.clubs.length,
      shame_clubs_count: responseData.shame_clubs.length,
      points: responseData.points,
      books_read: responseData.books_read
    });

    // Return the member with associated data
    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
  } catch (error) {
    console.log(`[MEMBER-GET] ERROR: ${(error as Error).message}`);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
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
 * Handles POST requests to create a new member
 */
async function handleCreateMember(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[MEMBER-POST] Starting handleCreateMember`);
    
    // Get the request body
    const data = await req.json()
    console.log(`[MEMBER-POST] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.name) {
      console.log(`[MEMBER-POST] Missing member name - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Member name is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      )
    }

    if (data.clubs && (!Array.isArray(data.clubs) || data.clubs.length === 0)) {
      console.log(`[MEMBER-POST] Invalid clubs field - returning 400`);
      return new Response(
        JSON.stringify({ error: 'The clubs field must be an array with at least one club ID' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      )
    }

    // Handle member ID generation if not provided
    let memberId;
    if (data.id) {
      memberId = data.id;
      console.log(`[MEMBER-POST] Using provided member ID: ${memberId}`);
    } else {
      console.log(`[MEMBER-POST] Generating member ID - getting highest existing ID`);
      
      // Get the highest existing ID and increment by 1
      const { data: maxIdResult, error: idError } = await supabaseClient
        .from("members")
        .select("id")
        .order("id", { ascending: false })
        .limit(1);
      
      console.log(`[MEMBER-POST] Max ID query result:`, { 
        found: !!maxIdResult?.length, 
        error: idError?.message,
        max_id: maxIdResult?.[0]?.id || null
      });
      
      if (idError) {
        console.log(`[MEMBER-POST] Failed to generate ID - returning 500`);
        return new Response(
          JSON.stringify({ error: `Failed to generate ID: ${idError.message}` }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }, 
            status: 500 
          }
        )
      }
      
      // If no members exist yet, start with ID 1, otherwise increment the highest ID
      memberId = maxIdResult && maxIdResult.length > 0 ? maxIdResult[0].id + 1 : 1;
      console.log(`[MEMBER-POST] Generated member ID: ${memberId}`);
    }

    // Insert member data with the generated or provided ID
    console.log(`[MEMBER-POST] Inserting member data:`, {
      id: memberId,
      name: data.name,
      points: data.points || 0,
      books_read: data.books_read || 0
    });
    
    const { data: memberData, error: memberError } = await supabaseClient
      .from("members")
      .insert({
        id: memberId,
        name: data.name,
        points: data.points || 0,
        books_read: data.books_read || 0
      })
      .select()

    console.log(`[MEMBER-POST] Member insert result:`, { 
      success: !!memberData, 
      error: memberError?.message,
      member: memberData?.[0] ? { 
        id: memberData[0].id, 
        name: memberData[0].name 
      } : null
    });

    if (memberError) {
      console.log(`[MEMBER-POST] Member insert failed - returning 500`);
      return new Response(
        JSON.stringify({ error: memberError.message }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    // Get the inserted member's ID
    const newMemberId = memberData[0].id;
    console.log(`[MEMBER-POST] New member created with ID: ${newMemberId}`);

    // Associate member with clubs
    if (data.clubs && data.clubs.length > 0) {
      console.log(`[MEMBER-POST] Processing ${data.clubs.length} club associations:`, data.clubs);
      
      // Verify all club IDs exist
      const { data: existingClubs, error: clubsError } = await supabaseClient
        .from("clubs")
        .select("id")
        .in("id", data.clubs)

      console.log(`[MEMBER-POST] Club verification result:`, { 
        requested_count: data.clubs.length,
        found_count: existingClubs?.length || 0,
        error: clubsError?.message,
        found_clubs: existingClubs?.map(c => c.id) || []
      });

      if (clubsError) {
        console.log(`[MEMBER-POST] Club verification failed - returning partial success`);
        return new Response(
          JSON.stringify({ 
            error: clubsError.message,
            partial_success: true,
            message: "Member created but failed to verify clubs",
            member: memberData[0]
          }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }, 
            status: 500 
          }
        )
      }

      // Check if all club IDs exist
      const existingClubIds = existingClubs.map(c => c.id);
      const nonExistentClubs = data.clubs.filter((id: string) => !existingClubIds.includes(id));
      
      console.log(`[MEMBER-POST] Club validation:`, {
        existing_clubs: existingClubIds,
        non_existent_clubs: nonExistentClubs
      });
      
      if (nonExistentClubs.length > 0) {
        console.log(`[MEMBER-POST] Some clubs don't exist - returning partial success`);
        return new Response(
          JSON.stringify({ 
            error: `The following clubs do not exist: ${nonExistentClubs.join(', ')}`,
            partial_success: true,
            message: "Member created but not associated with all clubs",
            member: memberData[0]
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

      // Insert club associations
      const memberClubData = data.clubs.map((clubId: string) => ({
        member_id: newMemberId,
        club_id: clubId
      }));

      console.log(`[MEMBER-POST] Inserting ${memberClubData.length} club associations:`, memberClubData);

      const { error: associationError } = await supabaseClient
        .from("memberclubs")
        .insert(memberClubData)

      console.log(`[MEMBER-POST] Club associations insert result:`, { 
        success: !associationError, 
        error: associationError?.message 
      });

      if (associationError) {
        console.log(`[MEMBER-POST] Club associations failed - returning partial success`);
        return new Response(
          JSON.stringify({ 
            error: associationError.message,
            partial_success: true,
            message: "Member created but failed to associate with clubs",
            member: memberData[0]
          }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }, 
            status: 500 
          }
        )
      }
    } else {
      console.log(`[MEMBER-POST] No club associations to process`);
    }

    const responseData = {
      success: true, 
      message: "Member created successfully",
      member: {
        ...memberData[0],
        clubs: data.clubs || []
      }
    };

    console.log(`[MEMBER-POST] Member creation completed successfully:`, {
      member_id: responseData.member.id,
      member_name: responseData.member.name,
      clubs_associated: responseData.member.clubs.length
    });

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
    
  } catch (error) {
    console.log(`[MEMBER-POST] ERROR: ${(error as Error).message}`);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
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
 * Handles PUT requests to update an existing member
 */
async function handleUpdateMember(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[MEMBER-PUT] Starting handleUpdateMember`);
    
    // Get the request body
    const data = await req.json()
    console.log(`[MEMBER-PUT] Request body:`, JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.id) {
      console.log(`[MEMBER-PUT] Missing member ID - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Member ID is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      )
    }

    // Check if member exists
    console.log(`[MEMBER-PUT] Checking if member exists: "${data.id}"`);
    const { data: existingMember, error: checkError } = await supabaseClient
      .from("members")
      .select("id")
      .eq("id", data.id)
      .single()

    console.log(`[MEMBER-PUT] Member existence check:`, { 
      found: !!existingMember, 
      error: checkError?.message 
    });

    if (checkError || !existingMember) {
      console.log(`[MEMBER-PUT] Member not found - returning 404`);
      return new Response(
        JSON.stringify({ error: 'Member not found' }),
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
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.points !== undefined) updateData.points = data.points
    if (data.books_read !== undefined) updateData.books_read = data.books_read

    console.log(`[MEMBER-PUT] Member update data prepared:`, updateData);

    let updatedMember = { id: data.id };
    let clubsUpdated = false;

    // Update member data if there are fields to update
    if (Object.keys(updateData).length > 0) {
      console.log(`[MEMBER-PUT] Updating member with data:`, updateData);
      
      const { data: memberData, error: updateError } = await supabaseClient
        .from("members")
        .update(updateData)
        .eq("id", data.id)
        .select()

      console.log(`[MEMBER-PUT] Member update result:`, { 
        success: !!memberData, 
        error: updateError?.message,
        member: memberData?.[0] ? { 
          id: memberData[0].id, 
          name: memberData[0].name 
        } : null
      });

      if (updateError) {
        console.log(`[MEMBER-PUT] Member update failed - returning 500`);
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

      updatedMember = memberData[0];
    } else {
      console.log(`[MEMBER-PUT] No member fields to update`);
    }

    // Handle club associations if provided
    if (data.clubs !== undefined) {
      console.log(`[MEMBER-PUT] Processing club associations update:`, data.clubs);
      
      if (!Array.isArray(data.clubs)) {
        console.log(`[MEMBER-PUT] Invalid clubs format - returning 400`);
        return new Response(
          JSON.stringify({ 
            error: 'Clubs must be an array',
            partial_success: Object.keys(updateData).length > 0,
            message: "Some member fields updated but clubs not modified",
            member: updatedMember
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

      // Get existing club associations
      console.log(`[MEMBER-PUT] Getting existing club associations for member: "${data.id}"`);
      const { data: existingAssociations, error: getError } = await supabaseClient
        .from("memberclubs")
        .select("club_id")
        .eq("member_id", data.id)

      console.log(`[MEMBER-PUT] Existing associations result:`, { 
        count: existingAssociations?.length || 0, 
        error: getError?.message,
        club_ids: existingAssociations?.map(a => a.club_id) || []
      });

      if (getError) {
        console.log(`[MEMBER-PUT] Failed to get existing associations - returning 500`);
        return new Response(
          JSON.stringify({ 
            error: getError.message,
            partial_success: Object.keys(updateData).length > 0,
            message: "Member updated but failed to retrieve existing club associations",
            member: updatedMember
          }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            }, 
            status: 500 
          }
        )
      }

      const existingClubIds = existingAssociations.map(a => a.club_id);
      
      // Clubs to add (in new list but not in existing)
      const clubsToAdd = data.clubs.filter((id: string) => !existingClubIds.includes(id));
      
      // Clubs to remove (in existing but not in new list)
      const clubsToRemove = existingClubIds.filter((id: string) => !data.clubs.includes(id));

      console.log(`[MEMBER-PUT] Club changes:`, { 
        to_add: clubsToAdd, 
        to_remove: clubsToRemove 
      });

      // Add new associations
      if (clubsToAdd.length > 0) {
        console.log(`[MEMBER-PUT] Adding ${clubsToAdd.length} new club associations...`);
        
        // Verify all club IDs exist
        const { data: validClubs, error: verifyError } = await supabaseClient
          .from("clubs")
          .select("id")
          .in("id", clubsToAdd)

        console.log(`[MEMBER-PUT] Club verification for new associations:`, { 
          requested_count: clubsToAdd.length,
          found_count: validClubs?.length || 0,
          error: verifyError?.message,
          found_clubs: validClubs?.map(c => c.id) || []
        });

        if (verifyError) {
          console.log(`[MEMBER-PUT] Club verification failed - returning 500`);
          return new Response(
            JSON.stringify({ 
              error: verifyError.message,
              partial_success: Object.keys(updateData).length > 0,
              message: "Member updated but failed to verify club IDs",
              member: updatedMember
            }),
            { 
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
              }, 
              status: 500 
            }
          )
        }

        const validClubIds = validClubs.map(c => c.id);
        const invalidClubs = clubsToAdd.filter((id: string) => !validClubIds.includes(id));
        
        console.log(`[MEMBER-PUT] Club validation:`, {
          valid_clubs: validClubIds,
          invalid_clubs: invalidClubs
        });
        
        if (invalidClubs.length > 0) {
          console.log(`[MEMBER-PUT] Some clubs don't exist - returning 400`);
          return new Response(
            JSON.stringify({ 
              error: `The following clubs do not exist: ${invalidClubs.join(', ')}`,
              partial_success: Object.keys(updateData).length > 0,
              message: "Member updated but clubs not completely modified",
              member: updatedMember
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

        // Add new associations
        const newAssociations = validClubIds.map((clubId: string) => ({
          member_id: data.id,
          club_id: clubId
        }));

        if (newAssociations.length > 0) {
          console.log(`[MEMBER-PUT] Inserting ${newAssociations.length} new associations:`, newAssociations);
          
          const { error: addError } = await supabaseClient
            .from("memberclubs")
            .insert(newAssociations)

          console.log(`[MEMBER-PUT] New associations insert result:`, { 
            success: !addError, 
            error: addError?.message 
          });

          if (addError) {
            console.log(`[MEMBER-PUT] Failed to add new associations - returning 500`);
            return new Response(
              JSON.stringify({ 
                error: addError.message,
                partial_success: Object.keys(updateData).length > 0,
                message: "Member updated but failed to add new club associations",
                member: updatedMember
              }),
              { 
                headers: { 
                  'Content-Type': 'application/json',
                  ...corsHeaders 
                }, 
                status: 500 
              }
            )
          }
          
          clubsUpdated = true;
        }
      }

      // Remove old associations
      if (clubsToRemove.length > 0) {
        console.log(`[MEMBER-PUT] Removing ${clubsToRemove.length} old associations:`, clubsToRemove);
        
        const { error: removeError } = await supabaseClient
          .from("memberclubs")
          .delete()
          .eq("member_id", data.id)
          .in("club_id", clubsToRemove)

        console.log(`[MEMBER-PUT] Remove associations result:`, { 
          success: !removeError, 
          error: removeError?.message 
        });

        if (removeError) {
          console.log(`[MEMBER-PUT] Failed to remove associations - returning 500`);
          return new Response(
            JSON.stringify({ 
              error: removeError.message,
              partial_success: Object.keys(updateData).length > 0 || clubsToAdd.length > 0,
              message: "Member updated but failed to remove some club associations",
              member: updatedMember
            }),
            { 
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders 
              }, 
              status: 500 
            }
          )
        }
        
        clubsUpdated = true;
      }
    } else {
      console.log(`[MEMBER-PUT] No club associations update requested`);
    }

    // If nothing was updated
    if (Object.keys(updateData).length === 0 && !clubsUpdated) {
      console.log(`[MEMBER-PUT] No changes to apply`);
      return new Response(
        JSON.stringify({ message: "No changes to apply" }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      )
    }

    const responseData = {
      success: true, 
      message: "Member updated successfully",
      member: updatedMember,
      clubs_updated: clubsUpdated
    };

    console.log(`[MEMBER-PUT] Member update completed successfully:`, {
      member_id: responseData.member.id,
      fields_updated: Object.keys(updateData),
      clubs_updated: responseData.clubs_updated
    });

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
    
  } catch (error) {
    console.log(`[MEMBER-PUT] ERROR: ${(error as Error).message}`);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
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
 * Handles DELETE requests to remove a member
 */
async function handleDeleteMember(req: Request, supabaseClient: SupabaseClient) {
  try {
    console.log(`[MEMBER-DELETE] Starting handleDeleteMember`);
    
    // Get URL parameters
    const url = new URL(req.url);
    const memberId = url.searchParams.get('id');

    console.log(`[MEMBER-DELETE] Request parameters:`, { memberId });

    if (!memberId) {
      console.log(`[MEMBER-DELETE] Missing member ID - returning 400`);
      return new Response(
        JSON.stringify({ error: 'Member ID is required' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 400 
        }
      )
    }

    // Check if member exists
    console.log(`[MEMBER-DELETE] Checking if member exists: "${memberId}"`);
    const { data: existingMember, error: checkError } = await supabaseClient
      .from("members")
      .select("id")
      .eq("id", memberId)
      .single()

    console.log(`[MEMBER-DELETE] Member existence check:`, { 
      found: !!existingMember, 
      error: checkError?.message 
    });

    if (checkError || !existingMember) {
      console.log(`[MEMBER-DELETE] Member not found - returning 404`);
      return new Response(
        JSON.stringify({ error: 'Member not found' }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 404 
        }
      )
    }

    // Start cascade deletion
    console.log(`[MEMBER-DELETE] Starting cascade deletion for member: "${memberId}"`);

    // Delete from shame list first (now club-based)
    console.log(`[MEMBER-DELETE] Deleting shame list entries for member: "${memberId}"`);
    const { error: shameError } = await supabaseClient
      .from("shamelist")
      .delete()
      .eq("member_id", memberId)

    console.log(`[MEMBER-DELETE] Shame list deletion result:`, { 
      success: !shameError, 
      error: shameError?.message 
    });

    if (shameError) {
      console.log(`[MEMBER-DELETE] Failed to delete shame list entries - returning 500`);
      return new Response(
        JSON.stringify({ error: `Failed to delete from shame list: ${shameError.message}` }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    // Delete club associations
    console.log(`[MEMBER-DELETE] Deleting club associations for member: "${memberId}"`);
    const { error: associationError } = await supabaseClient
      .from("memberclubs")
      .delete()
      .eq("member_id", memberId)

    console.log(`[MEMBER-DELETE] Club associations deletion result:`, { 
      success: !associationError, 
      error: associationError?.message 
    });

    if (associationError) {
      console.log(`[MEMBER-DELETE] Failed to delete club associations - returning 500`);
      return new Response(
        JSON.stringify({ error: `Failed to delete club associations: ${associationError.message}` }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }, 
          status: 500 
        }
      )
    }

    // Delete the member
    console.log(`[MEMBER-DELETE] Deleting member: "${memberId}"`);
    const { error: deleteError } = await supabaseClient
      .from("members")
      .delete()
      .eq("id", memberId)

    console.log(`[MEMBER-DELETE] Member deletion result:`, { 
      success: !deleteError, 
      error: deleteError?.message 
    });

    if (deleteError) {
      console.log(`[MEMBER-DELETE] Member deletion failed - returning 500`);
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

    console.log(`[MEMBER-DELETE] Member deletion completed successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Member deleted successfully" 
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
    
  } catch (error) {
    console.log(`[MEMBER-DELETE] ERROR: ${(error as Error).message}`);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
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