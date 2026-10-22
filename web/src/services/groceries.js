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

/**
 * Lightweight UUID validator.
 * Matches standard 8-4-4-4-12 hex UUID pattern.
 * @param {*} val
 * @returns {boolean}
 */
export function isValidUuid(val) {
  if (typeof val !== 'string') return false
  const trimmed = val.trim()
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed)
}

/**
 * Sanitizes an input value to a valid UUID string or null.
 * Rejects empty strings, malformed strings, or non-UUID values (e.g. datetimes).
 * @param {*} val
 * @returns {string|null}
 */
export function sanitizeUuidOrNull(val) {
  if (!val || typeof val !== 'string') return null
  const trimmed = val.trim()
  return isValidUuid(trimmed) ? trimmed : null
}

/**
 * Sanitizes an array of values, returning only valid UUID / identifier strings.
 * Filters out empty values, nulls, and date/time strings.
 * @param {Array} arr
 * @returns {Array<string>}
 */
export function sanitizeUuidArray(arr) {
  if (!Array.isArray(arr)) return []
  return arr.filter((item) => {
    if (!item || typeof item !== 'string') return false
    const trimmed = item.trim()
    if (!trimmed) return false
    if (sanitizeDateTimeOrNull(trimmed) !== null) return false
    if (isValidUuid(trimmed)) return true
    if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && !trimmed.includes(':') && !trimmed.includes('T')) {
      return true
    }
    return false
  })
}

/**
 * Validates and normalizes date/datetime strings (e.g. "2026-12-24T19:30" or ISO timestamps).
 * @param {*} val
 * @returns {string|null}
 */
export function sanitizeDateTimeOrNull(val) {
  if (!val) return null
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString()
  }
  if (typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed) return null
  // Strictly match date patterns: YYYY-MM-DD or YYYY-MM-DDTHH:mm(:ss)(Z|offset)
  if (!/^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(trimmed)) {
    return null
  }
  const parsed = new Date(trimmed)
  if (isNaN(parsed.getTime())) return null
  return trimmed
}

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
 * Saves a pitched meal plan option into the poll_options table with validated UUIDs
 * and normalized date/timestamp payloads.
 *
 * @param {Object} mealData Structured meal plan object
 * @returns {Promise<Object>} Created or updated option record
 */
export async function saveMealPlan(mealData) {
  if (!mealData || typeof mealData !== 'object') {
    throw new Error('Meal plan payload must be an object')
  }

  const tripId = mealData.trip_id || mealData.tripId
  if (!tripId) {
    throw new Error('Trip ID is required to save a meal plan.')
  }
  if (!isValidUuid(tripId)) {
    throw new Error(`Invalid trip_id: expected a valid UUID, got "${tripId}"`)
  }

  const mealTitle = (mealData.option_text || mealData.title || mealData.name || '').trim()
  if (!mealTitle) {
    throw new Error('Meal plan title is required')
  }

  const rawStart = mealData.start_date || mealData.startDate
  const rawEnd = mealData.end_date || mealData.endDate
  const startDateTime = sanitizeDateTimeOrNull(rawStart)
  const endDateTime = sanitizeDateTimeOrNull(rawEnd) || startDateTime

  const addedBy = sanitizeUuidOrNull(mealData.added_by || mealData.addedBy || mealData.userId || mealData.user_id)

  const rawMetadata = mealData.metadata && typeof mealData.metadata === 'object' ? mealData.metadata : {}
  const chefIds = sanitizeUuidArray(mealData.chef_ids || rawMetadata.chef_ids || [])
  const cleanupIds = sanitizeUuidArray(mealData.cleanup_ids || rawMetadata.cleanup_ids || [])
  const ingredients = Array.isArray(mealData.ingredients)
    ? mealData.ingredients
    : (Array.isArray(rawMetadata.ingredients) ? rawMetadata.ingredients : [])

  const metadata = {
    ...rawMetadata,
    meal_slot: mealData.meal_slot || rawMetadata.meal_slot || 'dinner',
    meal_mode: mealData.meal_mode || rawMetadata.meal_mode || 'cook',
    chef_ids: chefIds,
    cleanup_ids: cleanupIds,
    ingredients
  }

  let sanitizedLink = (mealData.link || '').trim() || null
  if (sanitizedLink && !/^https?:\/\//i.test(sanitizedLink)) {
    sanitizedLink = `https://${sanitizedLink}`
  }

  const estimatedCost = mealData.estimated_cost ?? mealData.cost ?? mealData.estimatedCost
  const numericCost = estimatedCost !== undefined && estimatedCost !== null && !isNaN(Number(estimatedCost))
    ? Number(estimatedCost)
    : null

  const assignedUsers = sanitizeUuidArray(mealData.assigned_users || mealData.assignedUsers || [])

  const optionPayload = {
    trip_id: tripId,
    category: 'food',
    option_text: mealTitle,
    estimated_cost: numericCost,
    currency: numericCost !== null ? (mealData.currency || 'USD') : null,
    link: sanitizedLink,
    description: mealData.description ? String(mealData.description).trim() : null,
    start_date: startDateTime,
    end_date: endDateTime,
    added_by: addedBy,
    is_locked: Boolean(mealData.is_locked),
    cost_type: mealData.cost_type || mealData.costType || 'split_total',
    assigned_users: assignedUsers,
    metadata
  }

  const existingOptionId = mealData.id || mealData.option_id || mealData.optionId
  const cleanOptionId = existingOptionId !== null && existingOptionId !== undefined && !isNaN(Number(existingOptionId)) && String(existingOptionId).trim() !== ''
    ? Number(existingOptionId)
    : null

  try {
    const q = supabase?.from?.('poll_options')
    if (q) {
      if (cleanOptionId && typeof q.update === 'function') {
        const { data, error } = await q
          .update(optionPayload)
          .eq('id', cleanOptionId)
          .select()
          .single()

        if (!error && data) return data
        if (error) throw error
      } else if (typeof q.insert === 'function') {
        const { data, error } = await q
          .insert(optionPayload)
          .select()
          .single()

        if (!error && data) return data
        if (error) {
          // Fallback if schema does not support new columns
          const fallbackPayload = {
            trip_id: tripId,
            category: 'food',
            option_text: mealTitle,
            estimated_cost: numericCost,
            currency: numericCost !== null ? (mealData.currency || 'USD') : null,
            link: sanitizedLink,
            description: mealData.description ? String(mealData.description).trim() : null,
            start_date: startDateTime,
            end_date: endDateTime,
            added_by: addedBy,
            is_locked: false
          }
          const fallbackRes = await q.insert(fallbackPayload).select().single()
          if (fallbackRes.error) throw fallbackRes.error
          return fallbackRes.data
        }
      }
    }
  } catch (err) {
    console.warn('Supabase meal option operation failed:', err)
    throw err
  }

  return {
    id: cleanOptionId || Date.now(),
    ...optionPayload,
    created_at: new Date().toISOString()
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
  const cleanMealOptionId = meal_option_id !== null && meal_option_id !== undefined && !isNaN(Number(meal_option_id)) && String(meal_option_id).trim() !== ''
    ? Number(meal_option_id)
    : null
  const cleanAddedBy = sanitizeUuidOrNull(added_by)

  const payload = {
    trip_id: tripId,
    name: cleanName,
    quantity: quantity ? String(quantity).trim() : '',
    aisle: cleanAisle,
    meal_option_id: cleanMealOptionId,
    added_by: cleanAddedBy,
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
