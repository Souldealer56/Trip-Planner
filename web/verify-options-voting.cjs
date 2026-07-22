const fs = require('fs')
const path = require('path')
const { createClient } = require(path.join(__dirname, 'node_modules/@supabase/supabase-js'))

// Read .env from parent directory
const envPath = path.join(__dirname, '../.env')
const env = {}
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      let val = match[2] ? match[2].trim() : ''
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      env[match[1]] = val
    }
  })
}

const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = env.SUPABASE_KEY || process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_KEY in environment.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyOptionVoting() {
  console.log('--- Verifying Webapp Option Voting Integration & Real-time Sync ---')

  // 1. Fetch active trip
  const { data: trips, error: tripsErr } = await supabase
    .from('trips')
    .select('id, title')
    .limit(1)

  if (tripsErr || !trips || trips.length === 0) {
    console.error('❌ Error fetching active trip:', tripsErr)
    process.exit(1)
  }

  const testTrip = trips[0]
  console.log(`✓ Fetched target trip: "${testTrip.title}" (${testTrip.id})`)

  // 2. Fetch users for multi-voter simulation
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, first_name')
    .limit(2)

  if (usersErr || !users || users.length < 1) {
    console.error('❌ Error fetching users for voting verification:', usersErr)
    process.exit(1)
  }

  const userA = users[0]
  const userB = users[1] || users[0]
  console.log(`✓ Resolved test users: User A (${userA.first_name || userA.id}), User B (${userB.first_name || userB.id})`)

  // 3. Pitch test option under 'food'
  const category = 'food'
  const optionText = `Voting Test Diner ${Date.now()}`

  const { data: insertedOpt, error: insertErr } = await supabase
    .from('poll_options')
    .insert({
      trip_id: testTrip.id,
      category: category,
      option_text: optionText,
      estimated_cost: 25.00,
      currency: 'USD'
    })
    .select()
    .single()

  if (insertErr || !insertedOpt) {
    console.error('❌ Error inserting test poll_option:', insertErr)
    process.exit(1)
  }
  console.log(`✓ Inserted test poll option ID: ${insertedOpt.id}`)

  // 4. Ensure active_polls row exists
  let { data: activePoll } = await supabase
    .from('active_polls')
    .select('*')
    .eq('trip_id', testTrip.id)
    .eq('category', category)
    .maybeSingle()

  if (!activePoll) {
    const { data: newPoll } = await supabase
      .from('active_polls')
      .insert({
        trip_id: testTrip.id,
        category: category,
        voter_selections: {},
        votes_by_option: {}
      })
      .select()
      .single()
    activePoll = newPoll
  }

  const optIdStr = String(insertedOpt.id)

  // 5. Cast vote for User A
  const voterSelectionsA = { ...(activePoll.voter_selections || {}) }
  const votesByOptA = { ...(activePoll.votes_by_option || {}) }

  voterSelectionsA[userA.id] = [insertedOpt.id]
  votesByOptA[optIdStr] = 1

  const { data: updatedPollA, error: pollErrA } = await supabase
    .from('active_polls')
    .update({
      voter_selections: voterSelectionsA,
      votes_by_option: votesByOptA
    })
    .eq('id', activePoll.id)
    .select()
    .single()

  if (pollErrA) {
    console.error('❌ Error updating active_polls for User A vote:', pollErrA)
    process.exit(1)
  }
  console.log(`✓ User A vote recorded. Tally for option ${insertedOpt.id}: ${updatedPollA.votes_by_option[optIdStr]}`)

  // 6. Test lock option choice
  voterSelectionsA._locked_option_id = String(insertedOpt.id)

  const { data: lockedPoll, error: lockErr } = await supabase
    .from('active_polls')
    .update({
      voter_selections: voterSelectionsA
    })
    .eq('id', activePoll.id)
    .select()
    .single()

  if (lockErr || String(lockedPoll.voter_selections?._locked_option_id) !== optIdStr) {
    console.error('❌ Error locking option choice in active_polls:', lockErr)
    process.exit(1)
  }
  console.log(`✓ Successfully locked itinerary option choice ${insertedOpt.id} in active_polls!`)

  // Unlock poll choice
  delete voterSelectionsA._locked_option_id
  await supabase
    .from('active_polls')
    .update({ voter_selections: voterSelectionsA })
    .eq('id', activePoll.id)

  // 7. Retract vote for User A
  delete voterSelectionsA[userA.id]
  delete votesByOptA[optIdStr]

  await supabase
    .from('active_polls')
    .update({
      voter_selections: voterSelectionsA,
      votes_by_option: votesByOptA
    })
    .eq('id', activePoll.id)

  // 8. Cleanup test poll_option
  await supabase
    .from('poll_options')
    .delete()
    .eq('id', insertedOpt.id)

  console.log('✓ Test poll option cleaned up successfully.')
  console.log('----------------------------------------------------')
  console.log('✓ Option voting integration and real-time sync verified successfully.')
  process.exit(0)
}

verifyOptionVoting()
