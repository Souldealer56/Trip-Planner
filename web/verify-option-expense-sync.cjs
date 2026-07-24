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

function parseOptionCost(option, baseCurrency = 'USD') {
  if (!option) return { amount: 0, currency: baseCurrency }
  if (option.estimated_cost && typeof option.estimated_cost === 'number' && option.estimated_cost > 0) {
    return { amount: option.estimated_cost, currency: option.currency || baseCurrency }
  }
  const text = option.option_text || option.text || ''
  const match = text.match(/([$€£¥A-Za-z]{1,3})\s*([\d,]+(?:\.\d+)?)/) || text.match(/([\d,]+(?:\.\d+)?)\s*([$€£¥A-Za-z]{1,3})?/)
  if (match) {
    const rawVal = match[1] && !isNaN(parseFloat(match[1].replace(/,/g, ''))) ? match[1] : match[2]
    const amount = parseFloat((rawVal || '0').replace(/,/g, ''))
    const currency = option.currency || baseCurrency
    return { amount: isNaN(amount) ? 0 : amount, currency }
  }
  return { amount: 0, currency: baseCurrency }
}

async function runVerification() {
  console.log('🧪 Starting Option to Expense Sync Verification...\n')

  try {
    // 1. Fetch an existing user for foreign key constraint
    const { data: userList } = await supabase.from('users').select('id').limit(1)
    if (!userList || userList.length === 0) {
      throw new Error('No existing users found in DB for foreign key testing')
    }
    const testUserId = userList[0].id

    // 2. Create test trip
    const testTitle = `Test Option Expense Trip ${Date.now()}`
    console.log(`1. Creating test trip: "${testTitle}"...`)
    const { data: newTrip, error: createErr } = await supabase
      .from('trips')
      .insert({
        title: testTitle,
        destination: 'Option City',
        start_date: '2026-11-01',
        end_date: '2026-11-05',
        base_currency: 'USD',
        organizer_id: testUserId
      })
      .select()
      .single()

    if (createErr) throw createErr
    console.log(`   ✓ Trip created (ID: ${newTrip.id})`)

    // 3. Test Cost Parser
    console.log('\n2. Testing option cost parsing...')
    const dummyOption = {
      option_text: 'Grand Beach Hotel ($450)',
      estimated_cost: 450,
      currency: 'USD'
    }
    const parsed = parseOptionCost(dummyOption, 'USD')
    if (parsed.amount !== 450 || parsed.currency !== 'USD') {
      throw new Error(`Cost parser failed! Expected 450 USD, got ${parsed.amount} ${parsed.currency}`)
    }
    console.log('   ✓ Option cost correctly parsed (450 USD)')

    // 4. Log converted expense
    console.log('\n3. Converting option to expense record...')
    const optionTitle = dummyOption.option_text
    const description = `[Locked Option] ${optionTitle}`
    const { data: expenseData, error: expErr } = await supabase
      .from('expenses')
      .insert({
        trip_id: newTrip.id,
        paid_by: testUserId,
        amount: parsed.amount,
        currency: parsed.currency,
        description: description,
        split_users: [testUserId]
      })
      .select()
      .single()

    if (expErr) throw expErr
    console.log(`   ✓ Expense created successfully (ID: ${expenseData.id})`)
    if (expenseData.amount !== 450 || !expenseData.description.includes('[Locked Option]')) {
      throw new Error('Expense record fields do not match converted option!')
    }

    // 5. Cleanup
    console.log('\n4. Cleaning up test records...')
    await supabase.from('expenses').delete().eq('trip_id', newTrip.id)
    await supabase.from('trips').delete().eq('id', newTrip.id)
    console.log('   ✓ Cleanup completed')

    console.log('\n✅ ALL OPTION TO EXPENSE VERIFICATION CHECKS PASSED SUCCESSFULLY!')
    process.exit(0)
  } catch (err) {
    console.error('\n❌ Verification Failed:', err)
    process.exit(1)
  }
}

runVerification()
