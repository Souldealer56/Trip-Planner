#!/usr/bin/env node

/**
 * Trip Planner — Live Database & Service E2E Scenario Runner
 * Scenario: "QA Expedition — Banff & Canmore"
 * 
 * Simulates 3 travelers:
 * - User 1 (Alexis): Trip Organizer (Committed, arrives Day 1, departs Day 5)
 * - User 2 (Nolwen): Co-Organizer (Committed, Vegetarian, arrives Day 1, departs Day 5)
 * - User 3 (Etienne): Invited Participant (Committed, arrives Day 2, departs Day 4)
 * 
 * Executes all 10 End-to-End Steps and outputs a structured QA report table.
 * Cleanly cascades deletions in a finally block to leave zero test data behind.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 1. Load Environment Variables from web/.env or ../.env
function loadEnv() {
  const envPaths = [
    path.resolve(__dirname, '.env'),
    path.resolve(__dirname, '..', '.env')
  ]

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim()
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
          if (!process.env[key]) {
            process.env[key] = val
          }
        }
      }
    }
  }

  // Map alternative env variable names
  if (!process.env.VITE_SUPABASE_URL && process.env.SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL
  }
  if (!process.env.VITE_SUPABASE_ANON_KEY && process.env.SUPABASE_KEY) {
    process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_KEY
  }
}

loadEnv()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const isConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseKey.includes('your_public_anon_key')
)

// Pretty console helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
}

function printHeader(title) {
  console.log(`\n${colors.bright}${colors.cyan}========================================================================${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}  ${title}${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}========================================================================${colors.reset}\n`)
}

async function runLiveQA() {
  printHeader('Trip Planner — Live E2E QA Verification ("QA Expedition — Banff & Canmore")')

  if (!isConfigured) {
    console.log(`${colors.yellow}⚠️  No live Supabase credentials detected in .env (${colors.dim}VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY${colors.yellow}).${colors.reset}`)
    console.log(`${colors.yellow}   Skipping live database scenario. Run 'npm test' for mock service & DOM E2E suites.${colors.reset}\n`)
    process.exit(0)
  }

  console.log(`${colors.dim}Connecting to Supabase at:${colors.reset} ${supabaseUrl}`)

  // Dynamically import services after env vars are populated
  const { supabase } = await import('./src/services/supabase.js')
  const { createUser } = await import('./src/services/users.js')
  const { createTrip, updateTrip, deleteTrip } = await import('./src/services/trips.js')
  const {
    createRsvp,
    fetchRsvpRoster,
    promoteToCoOrganizer,
    updateRsvpDetails,
    isUserTripAdmin
  } = await import('./src/services/rsvps.js')
  const {
    pitchOption,
    fetchAllTripOptions,
    fetchActivePoll,
    toggleVote,
    lockOption,
    isOptionLocked
  } = await import('./src/services/options.js')
  const {
    syncGroceriesFromLockedMeals,
    fetchGroceryItems,
    getMealDietaryAlerts
  } = await import('./src/services/groceries.js')
  const {
    convertOptionToExpense,
    logExpense,
    fetchExpenses
  } = await import('./src/services/expenses.js')
  const {
    packOptionsIntoSubTracks,
    detectScheduleConflicts,
    detectScheduleGaps,
    analyzeDailyLogisticsCoverage
  } = await import('./src/utils/schedule.js')
  const {
    calculateSettlements,
    calculateTripBudgetAnalytics
  } = await import('./src/utils/currency.js')

  const results = []
  const startTime = Date.now()

  // Track created entities for guaranteed cascade cleanup
  let createdTrip = null
  const createdUsers = []

  const rates = { CAD: 1.35, USD: 1.0, EUR: 0.92 }

  function recordStep(stepNumber, name, status, details = '') {
    const icon = status === 'PASS' ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`
    console.log(`  [Step ${stepNumber}] ${icon} - ${name} ${details ? colors.dim + '(' + details + ')' + colors.reset : ''}`)
    results.push({ step: stepNumber, name, status, details })
  }

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Auth & Onboarding (Create 3 Simulated Travelers)
    // -------------------------------------------------------------------------
    const runId = Date.now()
    const user1 = await createUser(`alexis_qa_${runId}`, 'Alexis', `alexis_${runId}@example.com`)
    createdUsers.push(user1)

    const user2 = await createUser(`nolwen_qa_${runId}`, 'Nolwen', `nolwen_${runId}@example.com`)
    createdUsers.push(user2)

    const user3 = await createUser(`etienne_qa_${runId}`, 'Etienne', `etienne_${runId}@example.com`)
    createdUsers.push(user3)

    if (user1?.id && user2?.id && user3?.id) {
      recordStep(1, 'Auth & Onboarding', 'PASS', `Created Alexis (${user1.id.slice(0, 8)}), Nolwen, Etienne`)
    } else {
      throw new Error('Failed to create all 3 test travelers in database.')
    }

    // -------------------------------------------------------------------------
    // STEP 2: Trip Creation & Settings
    // -------------------------------------------------------------------------
    createdTrip = await createTrip(
      'QA Expedition — Banff & Canmore',
      'Banff, Canada',
      '2026-12-24',
      '2026-12-28',
      'CAD'
    )

    // Update settings: assign organizer_id and set vibe
    createdTrip = await updateTrip(createdTrip.id, {
      vibe: 'Winter Alpine Adventures & Hot Springs',
      destination: 'Banff & Canmore, Alberta, Canada',
      organizer_id: user1.id
    })

    if (createdTrip?.id && createdTrip.base_currency === 'CAD' && createdTrip.organizer_id === user1.id) {
      recordStep(2, 'Trip Creation & Settings', 'PASS', `Trip ${createdTrip.id.slice(0, 8)} base CAD, organizer assigned`)
    } else {
      throw new Error('Trip creation or settings update failed.')
    }

    // -------------------------------------------------------------------------
    // STEP 3: Invite & Roster Management (Permissions & Presence Dates)
    // -------------------------------------------------------------------------
    // User 1 joins as Organizer
    await createRsvp(createdTrip.id, user1.id, 'Committed', 'organizer')

    // Users 2 & 3 join
    await createRsvp(createdTrip.id, user2.id, 'Committed', 'member')
    await createRsvp(createdTrip.id, user3.id, 'Committed', 'member')

    // User 1 promotes User 2 to Co-Organizer
    await promoteToCoOrganizer(createdTrip.id, user2.id)

    // User 2 sets dietary tags: ['Vegetarian']
    await updateRsvpDetails(createdTrip.id, user2.id, {
      dietary_tags: ['Vegetarian']
    })

    // User 3 sets custom stay dates (partial stay) and sneaky notes
    await updateRsvpDetails(createdTrip.id, user3.id, {
      arrival_date: '2026-12-25',
      departure_date: '2026-12-27',
      notes: '[ADMIN] Trying to be sneaky'
    })

    const roster = await fetchRsvpRoster(createdTrip.id)
    const rsvp1 = roster.find(m => String(m.user_id) === String(user1.id))
    const rsvp2 = roster.find(m => String(m.user_id) === String(user2.id))
    const rsvp3 = roster.find(m => String(m.user_id) === String(user3.id))

    const isUser1Admin = isUserTripAdmin(user1, createdTrip, rsvp1)
    const isUser2Admin = isUserTripAdmin(user2, createdTrip, rsvp2)
    const isUser3Admin = isUserTripAdmin(user3, createdTrip, rsvp3)

    if (isUser1Admin && isUser2Admin && !isUser3Admin && rsvp2?.dietary_tags?.includes('Vegetarian')) {
      recordStep(3, 'Roster & Permission Roles', 'PASS', 'User 1 & 2 admins, User 3 non-admin despite [ADMIN] note tag')
    } else {
      throw new Error(`Permission violation: User1 Admin=${isUser1Admin}, User2 Admin=${isUser2Admin}, User3 Admin=${isUser3Admin}`)
    }

    // -------------------------------------------------------------------------
    // STEP 4: Pitching Options Across Categories
    // -------------------------------------------------------------------------
    // 2 Accommodations
    const chalet = await pitchOption(
      createdTrip.id,
      'Accommodation',
      'Canmore Chalet',
      1200,
      'CAD',
      'https://airbnb.com/canmore-chalet',
      'Spacious mountain view chalet with full kitchen',
      user1.id,
      '2026-12-24T16:00',
      '2026-12-28T11:00',
      'split_total',
      [],
      { max_capacity: 6, has_kitchen: true }
    )

    const hotel = await pitchOption(
      createdTrip.id,
      'Accommodation',
      'Banff Hotel',
      900,
      'USD',
      'https://booking.com/banff-hotel',
      'Luxury hotel in downtown Banff',
      user2.id,
      '2026-12-24T16:00',
      '2026-12-28T11:00',
      'split_total',
      [],
      { max_capacity: 4 }
    )

    // 1 Transport option
    const suv = await pitchOption(
      createdTrip.id,
      'Transport',
      '7-Seater SUV Rental',
      500,
      'CAD',
      null,
      'Calgary airport rental SUV for all gear',
      user1.id,
      '2026-12-24T14:00',
      '2026-12-28T18:00',
      'split_total',
      [],
      { transport_mode: 'rental', seats_capacity: 5 }
    )

    // 1 Activities option (User 1 & 2 only)
    const iceClimbing = await pitchOption(
      createdTrip.id,
      'Activities',
      'Ice Climbing Adventure',
      200,
      'CAD',
      'https://yamnuska.com/ice-climbing',
      'Guided ice climbing in Johnston Canyon',
      user1.id,
      '2026-12-26T09:00',
      '2026-12-26T16:00',
      'per_person',
      [user1.id, user2.id],
      { max_participants: 4 }
    )

    const allPitched = await fetchAllTripOptions(createdTrip.id)
    if (allPitched.length >= 4) {
      recordStep(4, 'Pitch Options (Multi-Category)', 'PASS', `Pitched 2 accommodations, 1 SUV, 1 activity`)
    } else {
      throw new Error('Not all options were pitched successfully.')
    }

    // -------------------------------------------------------------------------
    // STEP 5: Multi-User Voting & Retraction
    // -------------------------------------------------------------------------
    // User 1, 2, 3 vote for Chalet
    await toggleVote(createdTrip.id, 'accommodation', chalet.id, user1.id, true)
    await toggleVote(createdTrip.id, 'accommodation', chalet.id, user2.id, true)
    const pollAfterChaletVotes = await toggleVote(createdTrip.id, 'accommodation', chalet.id, user3.id, true)

    // User 1, 2, 3 vote for Hotel
    await toggleVote(createdTrip.id, 'accommodation', hotel.id, user1.id, true)
    await toggleVote(createdTrip.id, 'accommodation', hotel.id, user2.id, true)
    await toggleVote(createdTrip.id, 'accommodation', hotel.id, user3.id, true)

    // User 3 retracts vote on Hotel
    const pollAfterRetract = await toggleVote(createdTrip.id, 'accommodation', hotel.id, user3.id, false)

    const chaletVotes = pollAfterRetract.votes_by_option[String(chalet.id)]
    const hotelVotes = pollAfterRetract.votes_by_option[String(hotel.id)]

    if (chaletVotes === 3 && hotelVotes === 2) {
      recordStep(5, 'Multi-User Voting & Retraction', 'PASS', `Chalet has 3 votes; Hotel decremented to 2 votes cleanly`)
    } else {
      throw new Error(`Voting tally mismatch: Chalet=${chaletVotes} (expected 3), Hotel=${hotelVotes} (expected 2)`)
    }

    // -------------------------------------------------------------------------
    // STEP 6: Multi-Option Locking
    // -------------------------------------------------------------------------
    const updatedPollAccom = await lockOption(createdTrip.id, 'accommodation', chalet.id, user1.id)
    const updatedPollAct = await lockOption(createdTrip.id, 'activities', iceClimbing.id, user1.id)

    const isChaletLocked = isOptionLocked(chalet, updatedPollAccom)
    const isClimbLocked = isOptionLocked(iceClimbing, updatedPollAct)

    if (isChaletLocked && isClimbLocked && updatedPollAccom.voter_selections[user1.id]) {
      recordStep(6, 'Multi-Option Locking', 'PASS', 'Chalet & Ice Climbing locked; voter_selections preserved')
    } else {
      throw new Error('Failed to lock options cleanly.')
    }

    // -------------------------------------------------------------------------
    // STEP 7: Gantt & Logistics Coverage Engine
    // -------------------------------------------------------------------------
    const packedLanes = packOptionsIntoSubTracks([chalet, hotel], createdTrip.start_date, createdTrip.end_date)
    const { conflictingOptionIds, conflictPairs } = detectScheduleConflicts([chalet, hotel, iceClimbing])
    const scheduleGaps = detectScheduleGaps(createdTrip, [chalet])

    const pollsMap = {
      accommodation: updatedPollAccom,
      activities: updatedPollAct
    }
    const coverage = analyzeDailyLogisticsCoverage(createdTrip, [chalet, suv], roster, pollsMap)

    const hasSubLanes = Array.isArray(packedLanes) && packedLanes.length === 2 && packedLanes[0][0].laneIndex === 0 && packedLanes[1][0].laneIndex === 1
    const noCrossCategoryConflict = !conflictPairs.some(c => (c.optionA?.category || '').toLowerCase() !== (c.optionB?.category || '').toLowerCase())

    if (hasSubLanes && noCrossCategoryConflict && coverage && Array.isArray(coverage.days) && coverage.days.length > 0) {
      recordStep(7, 'Gantt Logistics & Coverage Engine', 'PASS', 'Sub-lane packing verified; zero false cross-category conflicts')
    } else {
      throw new Error(`Gantt packing or daily logistics coverage engine assertion failed: hasSubLanes=${hasSubLanes}, noCross=${noCrossCategoryConflict}, days=${coverage?.days?.length}`)
    }

    // -------------------------------------------------------------------------
    // STEP 8: Meal Planning & Smart Grocery List
    // -------------------------------------------------------------------------
    const meal = await pitchOption(
      createdTrip.id,
      'Food',
      'Pasta Night Dinner',
      60,
      'CAD',
      null,
      'Home cooked penne pasta and marinara',
      user1.id,
      '2026-12-24T19:30',
      '2026-12-24T21:00',
      'split_total',
      [],
      {
        meal_mode: 'cook',
        meal_slot: 'dinner',
        ingredients: ['Pasta', 'Tomato Sauce']
      }
    )

    await lockOption(createdTrip.id, 'food', meal.id, user1.id)

    const dietaryAlerts = getMealDietaryAlerts(meal, roster)
    const syncRes = await syncGroceriesFromLockedMeals(createdTrip.id, [meal], [])
    const groceryItems = await fetchGroceryItems(createdTrip.id)

    const hasVegetarianAlert = dietaryAlerts.some(a => a.tag?.toLowerCase().includes('vegetarian'))
    const hasPasta = groceryItems.some(g => g.name.toLowerCase().includes('pasta'))

    if (hasVegetarianAlert && syncRes.addedCount >= 2 && hasPasta) {
      recordStep(8, 'Meal Planning & Smart Groceries', 'PASS', `Vegetarian alert surfaced for Nolwen; ${syncRes.addedCount} ingredients synced`)
    } else {
      throw new Error(`Meal intendance failure: alerts=${dietaryAlerts.length}, synced=${syncRes.addedCount}`)
    }

    // -------------------------------------------------------------------------
    // STEP 9: Smart Expense Conversion, Custom Splits & FX Settlements
    // -------------------------------------------------------------------------
    // Convert Chalet (1200 CAD, split across all 3)
    const chaletExpense = await convertOptionToExpense(createdTrip.id, chalet, user1.id, roster, rates, 'CAD')
    
    // Convert Ice Climbing (200 CAD/person for Alexis & Nolwen = 400 CAD, Etienne excluded)
    const climbingExpense = await convertOptionToExpense(createdTrip.id, iceClimbing, user1.id, roster, rates, 'CAD')

    // Log a USD expense paid by Nolwen (User 2)
    const usdExpense = await logExpense(
      createdTrip.id,
      user2.id,
      150,
      'USD',
      'Alpine Provisions & Snacks',
      [user1.id, user2.id, user3.id],
      'food'
    )

    const allExpenses = await fetchExpenses(createdTrip.id)
    const analytics = calculateTripBudgetAnalytics(allExpenses, allPitched, roster, rates, 'CAD')
    const settlements = calculateSettlements(analytics.travelerStats)

    // Mathematical zero-sum invariant check
    const totalNetBalance = (analytics.travelerStats || []).reduce((acc, b) => acc + (b.netBalance || 0), 0)
    const isZeroSum = Math.abs(totalNetBalance) < 0.05
    const etienneShare = climbingExpense.split_users?.includes(user3.id)

    if (
      chaletExpense.category === 'accommodation' &&
      climbingExpense.category === 'activities' &&
      !etienneShare &&
      isZeroSum &&
      settlements.length > 0
    ) {
      recordStep(9, 'Smart Expenses & FX Settlements', 'PASS', `Zero-sum net balance confirmed (sum=${totalNetBalance.toFixed(4)}), ${settlements.length} settlement(s) calculated`)
    } else {
      throw new Error(`Expense ledger failure: zeroSum=${isZeroSum}, etienneShare=${etienneShare}`)
    }

    // -------------------------------------------------------------------------
    // STEP 10: Cleanup & Cascade Delete
    // -------------------------------------------------------------------------
    await deleteTrip(createdTrip.id)
    createdTrip = null

    // Delete test users
    await supabase.from('users').delete().in('id', createdUsers.map(u => u.id))
    createdUsers.length = 0

    recordStep(10, 'Cleanup & Cascade Delete', 'PASS', 'Test trip and travelers purged from live database; zero residual artifacts')

  } catch (err) {
    console.error(`\n${colors.red}${colors.bright}❌ QA SCENARIO FAILED AT STEP ${results.length + 1}:${colors.reset}`, err)
    recordStep(results.length + 1, 'Unhandled Exception', 'FAIL', err.message)
  } finally {
    // Defensive cleanup in finally block
    if (createdTrip) {
      try {
        console.log(`\n${colors.dim}Executing emergency cleanup for trip ${createdTrip.id}...${colors.reset}`)
        const { deleteTrip } = await import('./src/services/trips.js')
        await deleteTrip(createdTrip.id)
      } catch (cleanErr) {
        console.warn('Trip cleanup warning:', cleanErr.message)
      }
    }
    if (createdUsers.length > 0) {
      try {
        const { supabase } = await import('./src/services/supabase.js')
        await supabase.from('users').delete().in('id', createdUsers.map(u => u.id))
      } catch (cleanErr) {
        console.warn('Users cleanup warning:', cleanErr.message)
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    const passedCount = results.filter(r => r.status === 'PASS').length
    const totalCount = results.length

    console.log(`\n${colors.cyan}------------------------------------------------------------------------${colors.reset}`)
    console.log(`  ${colors.bright}Live QA Summary:${colors.reset} ${passedCount}/${totalCount} Steps Passed in ${elapsed}s`)
    console.log(`${colors.cyan}------------------------------------------------------------------------${colors.reset}\n`)

    if (passedCount === totalCount && totalCount >= 10) {
      console.log(`${colors.green}${colors.bright}🎉 100% OF LIVE QA E2E SCENARIO STEPS PASSED SUCCESSFULLY!${colors.reset}\n`)
      process.exit(0)
    } else {
      console.log(`${colors.red}${colors.bright}❌ LIVE QA FAILED OR INCOMPLETE.${colors.reset}\n`)
      process.exit(1)
    }
  }
}

runLiveQA()
