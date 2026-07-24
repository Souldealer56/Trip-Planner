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

function calculateExpenseParticipantShares(expenseAmount, splitUsers, fallbackUserIds = []) {
  const shares = new Map()
  if (!splitUsers || splitUsers.length === 0) {
    if (fallbackUserIds.length > 0) {
      const equalShare = expenseAmount / fallbackUserIds.length
      fallbackUserIds.forEach(uid => shares.set(String(uid), equalShare))
    }
    return shares
  }

  const firstItem = splitUsers[0]
  if (typeof firstItem === 'object' && firstItem !== null && (firstItem.amount !== undefined || firstItem.percent !== undefined)) {
    splitUsers.forEach(item => {
      const uId = String(item.user_id || item.userId)
      if (item.amount !== undefined && item.amount !== null && !isNaN(parseFloat(item.amount))) {
        shares.set(uId, parseFloat(item.amount))
      } else if (item.percent !== undefined && item.percent !== null && !isNaN(parseFloat(item.percent))) {
        const share = (parseFloat(item.percent) / 100) * expenseAmount
        shares.set(uId, share)
      } else {
        shares.set(uId, 0)
      }
    })
  } else {
    const userIds = splitUsers.map(String)
    const equalShare = userIds.length > 0 ? expenseAmount / userIds.length : 0
    userIds.forEach(uId => shares.set(uId, equalShare))
  }

  return shares
}

async function runVerification() {
  console.log('🧪 Starting Flexible Cost Repartitioning & Custom Splits Verification...\n')

  try {
    // 1. Fetch an existing user for foreign key constraint
    const { data: userList } = await supabase.from('users').select('id').limit(2)
    if (!userList || userList.length === 0) {
      throw new Error('No existing users found in DB for foreign key testing')
    }
    const userA = String(userList[0].id)
    const userB = userList[1] ? String(userList[1].id) : userA

    // 2. Test Custom Dollar Amount Splits Calculation
    console.log('1. Testing custom dollar amount splits calculation ($100 total: $70 UserA, $30 UserB)...')
    const customAmountSplits = [
      { user_id: userA, amount: 70.0 },
      { user_id: userB, amount: 30.0 }
    ]
    const amountShares = calculateExpenseParticipantShares(100.0, customAmountSplits)
    if (amountShares.get(userA) !== 70.0 || (userList.length > 1 && amountShares.get(userB) !== 30.0)) {
      throw new Error('Custom dollar amount calculation failed!')
    }
    console.log('   ✓ Custom dollar amount split correctly evaluated')

    // 3. Test Custom Percentage Splits Calculation
    console.log('\n2. Testing custom percentage splits calculation ($200 total: 60% UserA, 40% UserB)...')
    const customPercentSplits = [
      { user_id: userA, percent: 60.0 },
      { user_id: userB, percent: 40.0 }
    ]
    const percentShares = calculateExpenseParticipantShares(200.0, customPercentSplits)
    if (percentShares.get(userA) !== 120.0 || (userList.length > 1 && percentShares.get(userB) !== 80.0)) {
      throw new Error('Custom percentage calculation failed!')
    }
    console.log('   ✓ Custom percentage split correctly evaluated (UserA: $120, UserB: $80)')

    // 4. Test Supabase Database Storage and Retrieval of Custom Splits Objects
    console.log('\n3. Testing Supabase DB storage of custom split objects in JSONB...')
    const testTitle = `Test Custom Split Trip ${Date.now()}`
    const { data: newTrip, error: createErr } = await supabase
      .from('trips')
      .insert({
        title: testTitle,
        destination: 'Split City',
        start_date: '2026-12-01',
        end_date: '2026-12-05',
        base_currency: 'USD',
        organizer_id: userA
      })
      .select()
      .single()

    if (createErr) throw createErr

    const { data: expenseData, error: expErr } = await supabase
      .from('expenses')
      .insert({
        trip_id: newTrip.id,
        paid_by: userA,
        amount: 100.0,
        currency: 'USD',
        description: 'Custom Split Test Expense',
        split_users: customAmountSplits
      })
      .select()
      .single()

    if (expErr) throw expErr
    console.log(`   ✓ Expense stored with custom split JSONB object (ID: ${expenseData.id})`)

    const retrievedShares = calculateExpenseParticipantShares(expenseData.amount, expenseData.split_users)
    if (retrievedShares.get(userA) !== 70.0) {
      throw new Error('Retrieved expense custom split shares do not match!')
    }
    console.log('   ✓ Retrieved DB expense custom split shares verified successfully')

    // 5. Cleanup
    console.log('\n4. Cleaning up test records...')
    await supabase.from('expenses').delete().eq('trip_id', newTrip.id)
    await supabase.from('trips').delete().eq('id', newTrip.id)
    console.log('   ✓ Cleanup completed')

    console.log('\n✅ ALL CUSTOM SPLIT VERIFICATION CHECKS PASSED SUCCESSFULLY!')
    process.exit(0)
  } catch (err) {
    console.error('\n❌ Verification Failed:', err)
    process.exit(1)
  }
}

runVerification()
