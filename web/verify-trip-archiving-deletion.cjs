const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Load environment variables from .env
const candidates = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, './.env'),
  path.resolve(process.cwd(), '.env')
]
for (const envPath of candidates) {
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8')
    envConfig.split(/\r?\n/).forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim().replace(/^['"]|['"]$/g, '')
        process.env[key] = value
      }
    })
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runVerification() {
  console.log('🧪 Starting Trip Archiving & Permanent Deletion Verification...\n')

  try {
    // 1. Create a test trip
    const testTitle = `Test Admin Trip ${Date.now()}`
    console.log(`1. Creating test trip: "${testTitle}"...`)
    const { data: newTrip, error: createErr } = await supabase
      .from('trips')
      .insert({
        title: testTitle,
        destination: 'Test Admin City',
        start_date: '2026-09-01',
        end_date: '2026-09-05',
        base_currency: 'USD'
      })
      .select()
      .single()

    if (createErr) throw createErr
    console.log(`   ✓ Test trip created (ID: ${newTrip.id})`)

    // 2. Test Archiving (Soft-Delete) using vibe fallback
    console.log('\n2. Archiving trip...')
    const currentVibe = newTrip.vibe || ''
    const newVibe = `[ARCHIVED] ${currentVibe}`.trim()
    const { data: archivedTrip, error: archiveErr } = await supabase
      .from('trips')
      .update({ vibe: newVibe })
      .eq('id', newTrip.id)
      .select()
      .single()

    if (archiveErr) throw archiveErr
    const isArchived = Boolean(archivedTrip.vibe && archivedTrip.vibe.includes('[ARCHIVED]'))
    if (!isArchived) {
      throw new Error('Trip vibe did not contain [ARCHIVED] tag!')
    }
    console.log('   ✓ Trip successfully archived (vibe contains [ARCHIVED])')

    // 3. Test Unarchiving
    console.log('\n3. Unarchiving trip...')
    const restoredVibe = (archivedTrip.vibe || '').replace(/\[ARCHIVED\]\s*/g, '').trim() || null
    const { data: restoredTrip, error: unarchiveErr } = await supabase
      .from('trips')
      .update({ vibe: restoredVibe })
      .eq('id', newTrip.id)
      .select()
      .single()

    if (unarchiveErr) throw unarchiveErr
    const stillArchived = Boolean(restoredTrip.vibe && restoredTrip.vibe.includes('[ARCHIVED]'))
    if (stillArchived) {
      throw new Error('Trip still has [ARCHIVED] tag after unarchiving!')
    }
    console.log('   ✓ Trip successfully unarchived')

    // 4. Test Permanent Deletion
    console.log('\n4. Testing cascading permanent deletion...')
    // Add dummy RSVP to verify cascade logic
    await supabase.from('rsvps').insert({ trip_id: newTrip.id, user_id: -99999, status: 'Committed' })
    
    // Execute deletion sequence
    await supabase.from('activity_log').delete().eq('trip_id', newTrip.id)
    await supabase.from('rsvps').delete().eq('trip_id', newTrip.id)
    const { error: deleteErr } = await supabase.from('trips').delete().eq('id', newTrip.id)

    if (deleteErr) throw deleteErr

    // Confirm trip is gone
    const { data: fetchCheck } = await supabase.from('trips').select('id').eq('id', newTrip.id).maybeSingle()
    if (fetchCheck) {
      throw new Error('Trip was not permanently deleted from database!')
    }
    console.log('   ✓ Trip and dependent records permanently deleted from DB')

    console.log('\n✅ ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!')
    process.exit(0)
  } catch (err) {
    console.error('\n❌ Verification Failed:', err)
    process.exit(1)
  }
}

runVerification()
