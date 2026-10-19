import { supabase } from './supabase.js'

export const GROCERY_AISLES = [
  { id: 'produce', label: 'Produce', icon: '🥬' },
  { id: 'dairy_meat', label: 'Dairy & Meat', icon: '🥩' },
  { id: 'dry_goods', label: 'Dry Goods & Pantry', icon: '🍝' },
  { id: 'drinks', label: 'Drinks & Snacks', icon: '🍷' },
  { id: 'household', label: 'Household & Supplies', icon: '🧻' },
  { id: 'other', label: 'Other', icon: '📦' }
]

const VALID_AISLE_IDS = new Set(GROCERY_AISLES.map((a) => a.id))

function getFallbackKey(tripId) {
  return `trip_groceries_fallback_${tripId}`
}

function loadLocalGroceries(tripId) {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(getFallbackKey(tripId))
    return raw ? JSON.parse(raw) : []
  } catch (err) {
    console.warn('Failed to load local groceries cache:', err)
    return []
  }
}

function saveLocalGroceries(tripId, items) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(getFallbackKey(tripId), JSON.stringify(items))
  } catch (err) {
    console.warn('Failed to persist local groceries cache:', err)
  }
}

/**
 * Fetch all grocery items for a trip.
 * Fallbacks to localStorage if Supabase is unreachable or unmigrated.
 */
export async function fetchGroceryItems(tripId) {
  if (!tripId) return []

  try {
    const q = supabase?.from?.('grocery_items')
    if (!q || typeof q.select !== 'function') {
      return loadLocalGroceries(tripId)
    }

    const { data, error } = await q
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })

    if (error) {
      console.warn('Supabase grocery_items query failed, using local cache:', error.message)
      return loadLocalGroceries(tripId)
    }

    if (Array.isArray(data)) {
      saveLocalGroceries(tripId, data)
      return data
    }
    return loadLocalGroceries(tripId)
  } catch (err) {
    console.warn('Network error fetching groceries, using local cache:', err)
    return loadLocalGroceries(tripId)
  }
}

/**
 * Add a grocery item to a trip.
 */
export async function addGroceryItem(tripId, { name, quantity = '', aisle = 'other', meal_option_id = null, added_by = null }) {
  if (!tripId || !name || !name.trim()) return null

  const cleanName = name.trim()
  const cleanAisle = VALID_AISLE_IDS.has(aisle) ? aisle : 'other'

  const payload = {
    trip_id: tripId,
    name: cleanName,
    quantity: quantity ? String(quantity).trim() : '',
    aisle: cleanAisle,
    meal_option_id: meal_option_id || null,
    added_by: added_by || null,
    is_checked: false
  }

  try {
    const q = supabase?.from?.('grocery_items')
    if (q && typeof q.insert === 'function') {
      const { data, error } = await q
        .insert([payload])
        .select()
        .single()

      if (!error && data) {
        const local = loadLocalGroceries(tripId)
        saveLocalGroceries(tripId, [...local, data])
        return data
      }
    }
  } catch (err) {
    console.warn('Supabase insert failed, saving grocery item locally:', err)
  }

  // Fallback local creation
  const fallbackItem = {
    ...payload,
    id: `local-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString()
  }
  const local = loadLocalGroceries(tripId)
  const updated = [...local, fallbackItem]
  saveLocalGroceries(tripId, updated)
  return fallbackItem
}

/**
 * Toggle checked status for a grocery item.
 */
export async function toggleGroceryItemChecked(itemId, isChecked, tripId) {
  if (!itemId) return

  try {
    const q = supabase?.from?.('grocery_items')
    if (q && typeof q.update === 'function') {
      await q
        .update({ is_checked: Boolean(isChecked) })
        .eq('id', itemId)
    }
  } catch (err) {
    console.warn('Failed to update grocery item checked status in Supabase:', err)
  }

  if (tripId) {
    const local = loadLocalGroceries(tripId)
    const updated = local.map((item) =>
      item.id === itemId ? { ...item, is_checked: Boolean(isChecked) } : item
    )
    saveLocalGroceries(tripId, updated)
  }
}

/**
 * Delete a grocery item.
 */
export async function deleteGroceryItem(itemId, tripId) {
  if (!itemId) return

  try {
    const q = supabase?.from?.('grocery_items')
    if (q && typeof q.delete === 'function') {
      await q
        .delete()
        .eq('id', itemId)
    }
  } catch (err) {
    console.warn('Failed to delete grocery item from Supabase:', err)
  }

  if (tripId) {
    const local = loadLocalGroceries(tripId)
    const updated = local.filter((item) => item.id !== itemId)
    saveLocalGroceries(tripId, updated)
  }
}

/**
 * Automatically inspects locked food options (meal_mode: 'cook' | 'picnic') and
 * adds any missing ingredients into the trip's grocery list, avoiding duplicates.
 */
export async function syncGroceriesFromLockedMeals(tripId, lockedFoodOptions = [], existingGroceryItems = []) {
  if (!tripId || !Array.isArray(lockedFoodOptions)) return { addedCount: 0, totalIngredients: 0 }

  const cookMeals = lockedFoodOptions.filter((opt) => {
    const cat = (opt.category || '').toLowerCase()
    const mode = opt.metadata?.meal_mode
    return (cat === 'food' || !cat) && (mode === 'cook' || mode === 'picnic' || !mode)
  })

  let addedCount = 0
  let totalIngredients = 0

  for (const meal of cookMeals) {
    const ingredients = meal.metadata?.ingredients
    if (!Array.isArray(ingredients)) continue

    for (const rawIng of ingredients) {
      if (!rawIng) continue
      totalIngredients++

      const name = typeof rawIng === 'string' ? rawIng.trim() : (rawIng.name || '').trim()
      if (!name) continue

      const quantity = typeof rawIng === 'object' && rawIng.quantity ? String(rawIng.quantity).trim() : ''
      const aisle = typeof rawIng === 'object' && rawIng.aisle ? rawIng.aisle : 'other'

      // Check if already in grocery list for this meal (or matching name & meal_option_id)
      const alreadyExists = existingGroceryItems.some((item) => {
        if (item.meal_option_id && String(item.meal_option_id) === String(meal.id)) {
          return item.name.toLowerCase() === name.toLowerCase()
        }
        return false
      })

      if (!alreadyExists) {
        await addGroceryItem(tripId, {
          name,
          quantity,
          aisle,
          meal_option_id: meal.id
        })
        addedCount++
      }
    }
  }

  return { addedCount, totalIngredients }
}

/**
 * Compute kitchen crew duty fairness counter across all food options.
 * Returns: { [userId]: { cookCount, cleanupCount, totalDuties } }
 */
export function computeKitchenCrewFairness(foodOptions = [], roster = []) {
  const result = {}

  // Initialize for all roster members
  for (const member of roster) {
    const uId = String(member.user_id || member.users?.id || member.id)
    result[uId] = {
      userId: uId,
      name: member.users?.first_name || member.username || 'Traveler',
      cookCount: 0,
      cleanupCount: 0,
      totalDuties: 0
    }
  }

  // Tally duties across food options
  for (const opt of foodOptions) {
    const metadata = opt.metadata || {}
    const chefIds = Array.isArray(metadata.chef_ids) ? metadata.chef_ids : []
    const cleanupIds = Array.isArray(metadata.cleanup_ids) ? metadata.cleanup_ids : []

    for (const chefId of chefIds) {
      const idStr = String(chefId)
      if (!result[idStr]) {
        result[idStr] = { userId: idStr, name: 'Traveler', cookCount: 0, cleanupCount: 0, totalDuties: 0 }
      }
      result[idStr].cookCount += 1
      result[idStr].totalDuties += 1
    }

    for (const washerId of cleanupIds) {
      const idStr = String(washerId)
      if (!result[idStr]) {
        result[idStr] = { userId: idStr, name: 'Traveler', cookCount: 0, cleanupCount: 0, totalDuties: 0 }
      }
      result[idStr].cleanupCount += 1
      result[idStr].totalDuties += 1
    }
  }

  return result
}

const DIETARY_EMOJIS = {
  vegetarian: '🌱',
  vegan: '🥬',
  gluten_free: '🌾',
  'gluten-free': '🌾',
  halal: '🥩',
  kosher: '✡️',
  dairy_free: '🥛',
  'dairy-free': '🥛',
  nut_allergy: '🥜',
  'nut-allergy': '🥜',
  seafood_allergy: '🦐',
  'seafood-allergy': '🦐',
  shellfish: '🦀',
  pescatarian: '🐟'
}

/**
 * Returns an array of active dietary alerts for diners assigned to a meal option.
 * e.g. ['🌱 Vegetarian (Nolwen)', '🌾 Gluten-Free (Alex)']
 */
export function getMealDietaryAlerts(mealOption, roster = []) {
  if (!mealOption || !Array.isArray(roster)) return []

  const assignedUsers = Array.isArray(mealOption.assigned_users) && mealOption.assigned_users.length > 0
    ? mealOption.assigned_users.map(String)
    : null // null indicates all present

  const alerts = []
  const seen = new Set()

  for (const member of roster) {
    const memberId = String(member.user_id || member.users?.id || member.id)

    // If explicit diners are set, only check diners
    if (assignedUsers && !assignedUsers.includes(memberId)) {
      continue
    }

    const tags = Array.isArray(member.dietary_tags) ? member.dietary_tags : []
    const travelerName = member.users?.first_name || member.username || 'Traveler'

    for (const tag of tags) {
      if (!tag) continue
      const cleanTag = String(tag).trim()
      const normalizedKey = cleanTag.toLowerCase().replace(/[\s_]+/g, '-')
      const emoji = DIETARY_EMOJIS[normalizedKey] || '⚠️'
      const label = `${emoji} ${cleanTag} (${travelerName})`

      const uniqueKey = `${normalizedKey}-${memberId}`
      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey)
        alerts.push({
          tag: cleanTag,
          travelerId: memberId,
          travelerName,
          emoji,
          label
        })
      }
    }
  }

  return alerts
}

/**
 * Helper to group grocery items by supermarket aisle.
 */
export function groupGroceriesByAisle(items = []) {
  const groups = {
    produce: [],
    dairy_meat: [],
    dry_goods: [],
    drinks: [],
    household: [],
    other: []
  }

  for (const item of items) {
    const aisleKey = groups[item.aisle] ? item.aisle : 'other'
    groups[aisleKey].push(item)
  }

  return GROCERY_AISLES.map((aisleDef) => ({
    ...aisleDef,
    items: groups[aisleDef.id] || []
  }))
}
