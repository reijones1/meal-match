import { supabase } from './supabase'

export async function fetchFoodItems() {
  const { data, error } = await supabase.from('food_items').select()
  if (error) throw error
  return data
}
