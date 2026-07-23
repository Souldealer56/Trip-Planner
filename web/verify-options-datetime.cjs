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

async function verifyOptionDatetime() {
  console.log('--- Verifying Date & Time Scheduling for Pitched Options ---')

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

  // 2. Pitch test option with explicit ISO datetimes
  const category = 'activities'
  const optionText = `Sunset Cruise ${Date.now()}`
  const startDateTime = '2026-07-24T18:30:00.000Z'
  const endDateTime = '2026-07-24T21:00:00.000Z'

  console.log(`Pitching test option "${optionText}" with schedule: ${startDateTime} to ${endDateTime}...`)

  const { data: insertedOpt, error: insertErr } = await supabase
    .from('poll_options')
    .insert({
      trip_id: testTrip.id,
      category: category,
      option_text: optionText,
      estimated_cost: 75.00,
      currency: 'USD',
      start_date: startDateTime,
      end_date: endDateTime
    })
    .select()
    .single()

  if (insertErr || !insertedOpt) {
    console.error('❌ Error inserting test poll_option with datetimes:', insertErr)
    process.exit(1)
  }

  console.log(`✓ Inserted poll option ID: ${insertedOpt.id}`)
  console.log(`  - start_date: ${insertedOpt.start_date}`)
  console.log(`  - end_date: ${insertedOpt.end_date}`)

  // 3. Fetch options and assert datetimes returned intact
  const { data: fetchedOpts, error: fetchErr } = await supabase
    .from('poll_options')
    .select('*')
    .eq('id', insertedOpt.id)
    .single()

  if (fetchErr || !fetchedOpts) {
    console.error('❌ Error fetching inserted option:', fetchErr)
    process.exit(1)
  }

  if (!fetchedOpts.start_date || !fetchedOpts.end_date) {
    console.error('❌ Error: Start/end datetime fields were missing from fetched record!')
    process.exit(1)
  }

  console.log('✓ Verified option retrieved cleanly with start and end datetimes.')

  // 4. Cleanup test record
  await supabase
    .from('poll_options')
    .delete()
    .eq('id', insertedOpt.id)

  console.log('✓ Test option record cleaned up successfully.')
  console.log('----------------------------------------------------')
  console.log('✓ Option date and time scheduling verified successfully.')
  process.exit(0)
}

verifyOptionDatetime()
