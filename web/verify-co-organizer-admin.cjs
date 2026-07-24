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

function isUserTripAdmin(user, trip, rsvp) {
  if (!user || !trip) return false
  const userId = typeof user === 'object' ? user.id : user

  if (trip.organizer_id && String(trip.organizer_id) === String(userId)) {
    return true
  }

  if (rsvp) {
    if (rsvp.is_admin === true) return true
    if (rsvp.notes && typeof rsvp.notes === 'string' && (rsvp.notes.includes('[CO_ORGANIZER]') || rsvp.notes.includes('[ADMIN]'))) {
      return true
    }
  }

  return false
}

async function runVerification() {
  console.log('🧪 Starting Co-Organizer & Admin Permission Verification...\n')

  // Fetch an existing user for foreign key constraint
  const { data: userList } = await supabase.from('users').select('id').limit(2)
  if (!userList || userList.length === 0) {
    throw new Error('No existing users found in DB for foreign key testing')
  }
  const testOrganizerId = userList[0].id
  const testMemberId = userList[1] ? userList[1].id : userList[0].id

  try {
    // 1. Create a test trip with primary organizer_id
    const testTitle = `Test Co-Admin Trip ${Date.now()}`
    console.log(`1. Creating test trip: "${testTitle}" with organizer_id = ${testOrganizerId}...`)
    const { data: newTrip, error: createErr } = await supabase
      .from('trips')
      .insert({
        title: testTitle,
        destination: 'Admin City',
        start_date: '2026-10-01',
        end_date: '2026-10-05',
        base_currency: 'USD',
        organizer_id: testOrganizerId
      })
      .select()
      .single()

    if (createErr) throw createErr
    console.log(`   ✓ Trip created (ID: ${newTrip.id})`)

    // 2. Verify Primary Organizer Admin Check
    console.log('\n2. Testing Primary Organizer admin check...')
    const isPrimaryAdmin = isUserTripAdmin(testOrganizerId, newTrip, null)
    if (!isPrimaryAdmin) {
      throw new Error('Primary organizer was not recognized as admin!')
    }
    console.log('   ✓ Primary organizer correctly recognized as admin')

    // 3. Add Regular Participant and verify non-admin status
    console.log('\n3. Adding regular participant and checking permissions...')
    const { data: rsvpData, error: rsvpErr } = await supabase
      .from('rsvps')
      .insert({
        trip_id: newTrip.id,
        user_id: testMemberId,
        status: 'Committed',
        notes: 'Regular member'
      })
      .select()
      .single()

    if (rsvpErr) throw rsvpErr
    const isMemberAdmin = isUserTripAdmin(testMemberId, newTrip, rsvpData)
    if (isMemberAdmin) {
      throw new Error('Regular member was incorrectly evaluated as admin!')
    }
    console.log('   ✓ Regular member correctly evaluated as non-admin')

    // 4. Test Co-Organizer Promotion
    console.log('\n4. Promoting participant to Co-Organizer...')
    const updatedNotes = `[CO_ORGANIZER] ${rsvpData.notes || ''}`.trim()
    const { data: promotedRsvp, error: promoteErr } = await supabase
      .from('rsvps')
      .update({ notes: updatedNotes })
      .eq('id', rsvpData.id)
      .select()
      .single()

    if (promoteErr) throw promoteErr
    const isPromotedAdmin = isUserTripAdmin(testMemberId, newTrip, promotedRsvp)
    if (!isPromotedAdmin) {
      throw new Error('Promoted participant was not recognized as Co-Organizer admin!')
    }
    console.log('   ✓ Promoted participant correctly recognized as Co-Organizer admin')

    // 5. Test Co-Organizer Demotion
    console.log('\n5. Demoting participant back to member...')
    const demotedNotes = (promotedRsvp.notes || '').replace(/\[(CO_ORGANIZER|ADMIN)\]\s*/g, '').trim() || null
    const { data: demotedRsvp, error: demoteErr } = await supabase
      .from('rsvps')
      .update({ notes: demotedNotes })
      .eq('id', rsvpData.id)
      .select()
      .single()

    if (demoteErr) throw demoteErr
    const isDemotedAdmin = isUserTripAdmin(testMemberId, newTrip, demotedRsvp)
    if (isDemotedAdmin) {
      throw new Error('Demoted participant is still evaluated as admin!')
    }
    console.log('   ✓ Demoted participant correctly returned to non-admin status')

    // 6. Cleanup
    console.log('\n6. Cleaning up test records...')
    await supabase.from('rsvps').delete().eq('trip_id', newTrip.id)
    await supabase.from('trips').delete().eq('id', newTrip.id)
    console.log('   ✓ Cleanup completed')

    console.log('\n✅ ALL CO-ORGANIZER ADMIN VERIFICATION CHECKS PASSED SUCCESSFULLY!')
    process.exit(0)
  } catch (err) {
    console.error('\n❌ Verification Failed:', err)
    process.exit(1)
  }
}

runVerification()
