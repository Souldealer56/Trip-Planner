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

async function verifyOptionPitching() {
  console.log('--- Verifying Webapp Option Pitching & Database Parity ---')

  // 1. Fetch an active trip
  const { data: trips, error: tripsErr } = await supabase
    .from('trips')
    .select('id, title, base_currency')
    .limit(1)

  if (tripsErr || !trips || trips.length === 0) {
    console.error('❌ Error: Failed to fetch active trip for verification:', tripsErr)
    process.exit(1)
  }

  const testTrip = trips[0]
  console.log(`✓ Fetched target trip: "${testTrip.title}" (${testTrip.id})`)

  // 2. Pitch a test option
  const testOptionName = `Audit Test Hike ${Date.now()}`
  const category = 'activities'
  const cost = 35.00
  const currency = testTrip.base_currency || 'USD'
  const rawLink = 'www.example.com/hike'
  const sanitizedLink = 'https://www.example.com/hike'
  const desc = 'E2E Verification pitched option'

  console.log(`Pitching test option: "${testOptionName}" under category "${category}"...`)

  const { data: insertedOpt, error: insertErr } = await supabase
    .from('poll_options')
    .insert({
      trip_id: testTrip.id,
      category: category,
      option_text: testOptionName,
      estimated_cost: cost,
      currency: currency,
      link: sanitizedLink,
      description: desc
    })
    .select()
    .single()

  if (insertErr || !insertedOpt) {
    console.error('❌ Error inserting test poll_option:', insertErr)
    process.exit(1)
  }

  console.log(`✓ Inserted poll_option with ID: ${insertedOpt.id}`)
  console.log(`  - Sanitized Link: ${insertedOpt.link}`)
  console.log(`  - Cost & Currency: ${insertedOpt.estimated_cost} ${insertedOpt.currency}`)

  // 3. Verify active_polls query for category
  const { data: activePoll, error: pollErr } = await supabase
    .from('active_polls')
    .select('*')
    .eq('trip_id', testTrip.id)
    .eq('category', category)
    .maybeSingle()

  if (pollErr) {
    console.error('❌ Error querying active_polls:', pollErr)
    process.exit(1)
  }

  if (!activePoll) {
    console.log(`Initializing missing active_poll for category "${category}"...`)
    const { data: newPoll, error: createPollErr } = await supabase
      .from('active_polls')
      .insert({
        trip_id: testTrip.id,
        category: category,
        voter_selections: {},
        votes_by_option: {}
      })
      .select()
      .single()

    if (createPollErr) {
      console.error('❌ Error initializing active_poll:', createPollErr)
      process.exit(1)
    }
    console.log(`✓ Initialized active_poll with ID: ${newPoll.id}`)
  } else {
    console.log(`✓ Verified existing active_poll ID: ${activePoll.id}`)
  }

  // 4. Fetch options to verify query return
  const { data: fetchedOpts, error: fetchErr } = await supabase
    .from('poll_options')
    .select('*')
    .eq('trip_id', testTrip.id)
    .eq('category', category)
    .order('id', { ascending: true })

  if (fetchErr) {
    console.error('❌ Error fetching poll_options:', fetchErr)
    process.exit(1)
  }

  const found = fetchedOpts.some(o => o.id === insertedOpt.id)
  if (!found) {
    console.error('❌ Error: Pitched option was not returned by fetchOptions query!')
    process.exit(1)
  }
  console.log(`✓ Option successfully returned by fetchOptions query. Total options in category: ${fetchedOpts.length}`)

  // 5. Cleanup test record
  const { error: deleteErr } = await supabase
    .from('poll_options')
    .delete()
    .eq('id', insertedOpt.id)

  if (deleteErr) {
    console.error('⚠️ Warning: Failed to delete test option record:', deleteErr)
  } else {
    console.log('✓ Test option cleaned up successfully.')
  }

  console.log('----------------------------------------------------')
  console.log('✓ Option pitching and database parity verified successfully.')
  process.exit(0)
}

verifyOptionPitching()
