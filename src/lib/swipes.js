import { supabase } from './supabase'

export async function recordSwipe(groupId, memberId, cuisineName, liked) {
  const { error } = await supabase
    .from('swipes')
    .insert({ group_id: groupId, member_id: memberId, cuisine_name: cuisineName, liked })

  if (error) throw error
}

export async function fetchGroupSwipes(groupId) {
  const { data, error } = await supabase
    .from('swipes')
    .select('member_id, cuisine_name, liked')
    .eq('group_id', groupId)

  if (error) throw error
  return data
}

// Clears a group's swipes before a new round begins. Without this, a replayed round's
// "who's finished" count and vote tally would be contaminated by the previous round's
// rows — swipes carry no round marker of their own, so group_id alone can't tell them apart.
export async function clearGroupSwipes(groupId) {
  const { error } = await supabase.from('swipes').delete().eq('group_id', groupId)
  if (error) throw error
}
