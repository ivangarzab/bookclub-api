// supabase/functions/session/utils/validation.ts
// Validation utilities for the session endpoint

/**
 * Validates a single discussion object
 */
export function validateDiscussion(discussion: any): { valid: boolean; error?: string } {
  if (!discussion.title || typeof discussion.title !== 'string' || discussion.title.trim() === '') {
    return { valid: false, error: 'Discussion title is required and must be a non-empty string' }
  }
  if (!discussion.date || typeof discussion.date !== 'string' || discussion.date.trim() === '') {
    return { valid: false, error: 'Discussion date is required and must be a non-empty string' }
  }
  return { valid: true }
}

/**
 * Validates an array of discussions
 */
export function validateDiscussionsArray(discussions: any): { valid: boolean; error?: string; invalidIndex?: number } {
  if (!Array.isArray(discussions)) {
    return { valid: false, error: 'Discussions must be an array' }
  }

  for (let i = 0; i < discussions.length; i++) {
    const validation = validateDiscussion(discussions[i])
    if (!validation.valid) {
      return { valid: false, error: validation.error, invalidIndex: i }
    }
  }

  return { valid: true }
}
