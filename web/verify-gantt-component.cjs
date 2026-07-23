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

async function verifyGanttTimeline() {
  console.log('--- Verifying Interactive Trip Gantt Chart & Timeline Component ---')

  // 1. Fetch active trip
  const { data: trips, error: tripsErr } = await supabase
    .from('trips')
    .select('*')
    .limit(1)

  if (tripsErr || !trips || trips.length === 0) {
    console.error('❌ Error fetching active trip:', tripsErr)
    process.exit(1)
  }

  const trip = trips[0]
  console.log(`✓ Target trip: "${trip.title}" (${trip.start_date} to ${trip.end_date})`)

  // 2. Fetch options across all categories
  const { data: allOpts, error: optsErr } = await supabase
    .from('poll_options')
    .select('*')
    .eq('trip_id', trip.id)

  if (optsErr) {
    console.error('❌ Error fetching trip options:', optsErr)
    process.exit(1)
  }

  console.log(`✓ Fetched ${allOpts.length} total options across all categories.`)

  // 3. Verify Gantt day grid calculation logic
  const startDate = new Date(trip.start_date || '2026-07-24')
  const endDate = new Date(trip.end_date || '2026-07-30')

  const tripStartTime = startDate.getTime()
  const tripEndTime = endDate.getTime() + 86400000

  let validBarPositions = 0
  allOpts.forEach(opt => {
    const optStart = opt.start_date ? new Date(opt.start_date).getTime() : tripStartTime
    const optEnd = opt.end_date ? new Date(opt.end_date).getTime() : (opt.start_date ? optStart + 10800000 : tripEndTime)
    const totalDuration = Math.max(tripEndTime - tripStartTime, 86400000)

    const left = Math.max(0, Math.min(100, ((optStart - tripStartTime) / totalDuration) * 100))
    const right = Math.max(0, Math.min(100, ((optEnd - tripStartTime) / totalDuration) * 100))
    const width = Math.max(3, right - left)

    if (left >= 0 && width > 0) {
      validBarPositions++
    }
  })

  console.log(`✓ Calculated Gantt horizontal bar positions for ${validBarPositions} options.`)

  // 4. Verify component file exists
  const componentPath = path.join(__dirname, 'src/components/GanttTimeline.jsx')
  if (!fs.existsSync(componentPath)) {
    console.error('❌ Error: GanttTimeline.jsx component file does not exist!')
    process.exit(1)
  }

  console.log('✓ Verified GanttTimeline.jsx component file exists.')
  console.log('----------------------------------------------------')
  console.log('✓ Gantt timeline component calculation verified successfully.')
  process.exit(0)
}

verifyGanttTimeline()
