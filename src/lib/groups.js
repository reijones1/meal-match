import { supabase } from './supabase'
import { generateRoomCode } from './roomCode'
import { clearGroupTally } from './groupTallies'
import { clearGroupSwipes } from './swipes'
import { clearGroupRestaurantResults } from './groupRestaurantResults'

const MAX_CREATE_ATTEMPTS = 5
const UNIQUE_VIOLATION = '23505'
const DEFAULT_RADIUS_MILES = 5

export async function createGroup() {
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    const roomCode = generateRoomCode()
    const { data, error } = await supabase.from('groups').insert({ room_code: roomCode }).select().single()

    if (!error) return data
    if (error.code !== UNIQUE_VIOLATION) throw error
    // Room code collision (rare) — loop and try a freshly generated code.
  }
  throw new Error('Could not generate a unique room code. Please try again.')
}

export async function findGroupByRoomCode(roomCode) {
  const { data, error } = await supabase.from('groups').select().eq('room_code', roomCode).maybeSingle()

  if (error) throw error
  return data // null if no group has this code
}

export async function fetchGroupMembers(groupId) {
  const { data, error } = await supabase
    .from('group_members')
    .select()
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

// `deckItemNames` is the *exact* set of items the host's buildDeck() already picked —
// storing the resolved names (not just the settings) means every member's client looks
// up the same set instead of each independently re-sampling from the same pool, which
// would give different members different subsets when deckSize is smaller than the pool.
export async function startSwipeSession(groupId, { cardType, deckItemNames }) {
  // Clear anything left over from a previous round before this one begins.
  await clearGroupTally(groupId)
  await clearGroupSwipes(groupId)
  await clearGroupRestaurantResults(groupId)
  const { error } = await supabase
    .from('groups')
    .update({
      started_at: new Date().toISOString(),
      card_type: cardType,
      deck_items: deckItemNames,
      // A genuinely fresh session always gets its own rematch round if it draws —
      // this only stays true across the one rematch round started below.
      is_rematch: false,
      // Locks the join screen out from this point on — see resetGroupRound, which is
      // what reopens it once the group is back in the lobby for another round.
      round_started: true,
      // A brand new game starts back at the default (GPS + travel-time midpoint) search
      // area — a manual/anchor/visual override from a previous round shouldn't quietly
      // carry over to a cuisine nobody's picked yet.
      search_mode: 'default',
      search_lat: null,
      search_lng: null,
      search_label: null,
      search_anchor_member_id: null,
      // Same reasoning as the search area reset above — a fresh game starts back at the
      // default radius/travel mode rather than quietly inheriting a previous round's pick.
      travel_mode: 'DRIVING',
      radius_miles: DEFAULT_RADIUS_MILES,
    })
    .eq('id', groupId)
  if (error) throw error
}

// Reopens the join screen for a group that's back in the lobby between rounds (e.g.
// "Play again") — round_started otherwise stays true forever once a session's first round
// begins, which is exactly what should block joins *during* a round, just not before one.
// Also clears started_at back to null: LobbyScreen and GroupResultsScreen both already
// treat *any* groups UPDATE with a truthy started_at as "a round just began, jump to
// swiping" — leaving the previous round's started_at in place would make this update
// spuriously trigger that same jump the instant it broadcasts.
export async function resetGroupRound(groupId) {
  const { error } = await supabase.from('groups').update({ round_started: false, started_at: null }).eq('id', groupId)
  if (error) throw error
}

// Same as startSwipeSession, but for the single "break the tie" round offered after a
// draw — deckItemNames here is just the tied candidates. Marking is_rematch means that if
// *this* round also fails to produce a majority, GroupResultsScreen won't offer another one.
export async function startRematchSession(groupId, { cardType, deckItemNames }) {
  await clearGroupTally(groupId)
  await clearGroupSwipes(groupId)
  await clearGroupRestaurantResults(groupId)
  const { error } = await supabase
    .from('groups')
    .update({
      started_at: new Date().toISOString(),
      card_type: cardType,
      deck_items: deckItemNames,
      is_rematch: true,
      round_started: true,
    })
    .eq('id', groupId)
  if (error) throw error
}

export async function fetchGroup(groupId) {
  const { data, error } = await supabase.from('groups').select().eq('id', groupId).maybeSingle()
  if (error) throw error
  return data
}

export async function joinGroup(groupId, displayName, isHost = false) {
  const { data, error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, display_name: displayName, is_host: isHost })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function leaveGroup(memberId) {
  const { error } = await supabase.from('group_members').delete().eq('id', memberId)
  if (error) throw error
}

// Shares this device's GPS location with the rest of the session (or records that it
// couldn't) — best-effort, called once per round from GroupSwipeScreen alongside swiping,
// the same "just send it, don't block on it" pattern recordSwipe already uses.
export async function updateMemberLocation(memberId, coords) {
  const { error } = await supabase
    .from('group_members')
    .update({ lat: coords?.lat ?? null, lng: coords?.lng ?? null })
    .eq('id', memberId)
  if (error) throw error
}

// The session-wide search area override chosen from the "Adjust search area" panel.
// `mode` is 'default' | 'manual' | 'anchor' | 'visual'; the other fields are only meaningful
// for the modes that need them (manual/visual carry lat/lng+label, anchor carries a member
// id) — callers just pass null for whichever don't apply to the mode being set.
export async function setGroupSearchMode(groupId, { mode, lat = null, lng = null, label = null, anchorMemberId = null }) {
  const { error } = await supabase
    .from('groups')
    .update({
      search_mode: mode,
      search_lat: lat,
      search_lng: lng,
      search_label: label,
      search_anchor_member_id: anchorMemberId,
    })
    .eq('id', groupId)
  if (error) throw error
}

// Travel mode and search radius are session-wide too — the group's restaurant ranking is
// computed once and shared, so whoever picks Walking or widens the radius needs everyone
// else's view to update the same way, not just their own.
export async function setGroupTravelMode(groupId, travelMode) {
  const { error } = await supabase.from('groups').update({ travel_mode: travelMode }).eq('id', groupId)
  if (error) throw error
}

export async function setGroupRadiusMiles(groupId, radiusMiles) {
  const { error } = await supabase.from('groups').update({ radius_miles: radiusMiles }).eq('id', groupId)
  if (error) throw error
}

// Best-effort cleanup for tab close / navigation away. Fired from a `pagehide` handler,
// where there's no time to await a normal request — `keepalive` lets the browser finish
// sending it after the page has started unloading. supabase-js's query builder doesn't
// expose fetch options like `keepalive`, so this hits the REST endpoint directly instead.
export function leaveGroupBeacon(memberId) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  fetch(`${supabaseUrl}/rest/v1/group_members?id=eq.${memberId}`, {
    method: 'DELETE',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    keepalive: true,
  }).catch(() => {
    // Nothing to do if this fails — the tab is closing regardless.
  })
}
