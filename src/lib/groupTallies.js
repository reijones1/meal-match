import { supabase } from './supabase'

const UNIQUE_VIOLATION = '23505'

export async function fetchGroupTally(groupId) {
  const { data, error } = await supabase.from('group_tallies').select().eq('group_id', groupId).maybeSingle()
  if (error) throw error
  return data // null if not computed yet
}

// Guarded by the unique constraint on group_id: if another client's insert wins the
// race, this catches the resulting 23505 and returns their row instead of throwing.
export async function createGroupTally(groupId, candidateCuisines, winningCuisine) {
  const { data, error } = await supabase
    .from('group_tallies')
    .insert({
      group_id: groupId,
      candidate_cuisines: candidateCuisines,
      winning_cuisine: winningCuisine,
      decided_at: winningCuisine ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (!error) return data
  if (error.code === UNIQUE_VIOLATION) return fetchGroupTally(groupId)
  throw error
}

// Clears any leftover tally from a previous round before a new one begins (either a
// full swipe session or a quick-pick). Without this, a group's second play-through
// would collide with the unique(group_id) constraint, and the race-guard fallback in
// createGroupTally would incorrectly hand back the *previous* round's stale winner.
export async function clearGroupTally(groupId) {
  const { error } = await supabase.from('group_tallies').delete().eq('group_id', groupId)
  if (error) throw error
}

export async function resolveGroupTally(groupId, winningCuisine) {
  const { data, error } = await supabase
    .from('group_tallies')
    .update({ winning_cuisine: winningCuisine, decided_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .select()
    .single()

  if (error) throw error
  return data
}

// The host opting out of the offered rematch round, straight to the manual tie-break
// picker instead. Broadcasts through the same group_tallies UPDATE subscription every
// client already listens on — no separate sync path needed.
export async function skipRematch(groupId) {
  const { data, error } = await supabase
    .from('group_tallies')
    .update({ skip_rematch: true })
    .eq('group_id', groupId)
    .select()
    .single()

  if (error) throw error
  return data
}

// A strict majority requires *more* than half the group, not just the most votes — a
// three-way split where the top pick only got a third of the vote isn't a real winner.
// Returns the tied top names (even if there's only one) and whether that's enough to win.
export function computeMajorityResult(swipeRows, totalMembers) {
  const counts = {}
  for (const row of swipeRows) {
    if (!row.liked) continue
    counts[row.cuisine_name] = (counts[row.cuisine_name] ?? 0) + 1
  }

  const maxVotes = Math.max(0, ...Object.values(counts))
  const topNames = maxVotes === 0 ? [] : Object.keys(counts).filter((name) => counts[name] === maxVotes)
  const hasMajority = topNames.length === 1 && maxVotes > totalMembers / 2

  return { topNames, hasMajority, winningCuisine: hasMajority ? topNames[0] : null }
}
