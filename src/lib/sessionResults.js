import { supabase } from './supabase'

export async function recordSessionResult(groupId, winningCuisine) {
  const { data, error } = await supabase
    .from('session_results')
    .insert({ group_id: groupId, winning_cuisine: winningCuisine })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function fetchGroupSessionResults(groupId) {
  const { data, error } = await supabase
    .from('session_results')
    .select('winning_cuisine, decided_at')
    .eq('group_id', groupId)
    .order('decided_at', { ascending: false })

  if (error) throw error
  return data
}
