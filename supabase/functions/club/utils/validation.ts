// supabase/functions/club/utils/validation.ts
// Validation helper functions

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.76.1'

/**
 * Validates that a server exists in the database
 */
export async function validateServer(
  supabaseClient: SupabaseClient,
  serverId: string
): Promise<{ valid: boolean; error?: string }> {
  const { data: serverData, error: serverError } = await supabaseClient
    .from('servers')
    .select('id')
    .eq('id', serverId)
    .single()

  if (serverError || !serverData) {
    return { valid: false, error: 'Server not found or not registered' }
  }

  return { valid: true }
}
