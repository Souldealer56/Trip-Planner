const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Custom .env parser to read from parent directory
const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env file not found at " + envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL or SUPABASE_KEY missing in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testActivityLogIntegration() {
  console.log("Starting Activity Log & Notification Feed Integration Tests...");

  let testTripId = null;
  let testUserId = null;
  let testOptionId = null;
  let testExpenseId = null;
  let manualLogId = null;

  try {
    // 1. Fetch trip and user
    console.log("1. Resolving active trip and user...");
    const { data: trips, error: tripsErr } = await supabase.from('trips').select('id').limit(1);
    if (tripsErr) throw tripsErr;
    if (trips.length === 0) throw new Error("No trips found in database.");
    testTripId = trips[0].id;

    const { data: users, error: usersErr } = await supabase.from('users').select('id, first_name').limit(1);
    if (usersErr) throw usersErr;
    if (users.length === 0) throw new Error("No users found in database.");
    testUserId = users[0].id;

    console.log(`Using Trip ID: ${testTripId}, User ID: ${testUserId}`);

    // 2. Test trigger on poll_options insertion
    console.log("2. Testing poll_options trigger for activity_log...");
    const { data: option, error: optErr } = await supabase
      .from('poll_options')
      .insert({
        trip_id: testTripId,
        category: 'activities',
        option_text: 'Verify Scuba Diving',
        estimated_cost: 120.00,
        currency: 'USD',
        added_by: testUserId
      })
      .select()
      .single();

    if (optErr) throw optErr;
    testOptionId = option.id;

    // Check activity_log for option trigger
    const { data: optionLogs, error: optLogErr } = await supabase
      .from('activity_log')
      .select('*')
      .eq('trip_id', testTripId)
      .eq('action_type', 'pitch_option')
      .order('created_at', { ascending: false })
      .limit(5);

    if (optLogErr) throw optLogErr;
    const foundOptLog = optionLogs.find(l => l.description.includes('Verify Scuba Diving'));
    if (!foundOptLog) {
      throw new Error("Trigger log for poll_options insertion not found in activity_log!");
    }
    console.log("✅ poll_options trigger verified:", foundOptLog.description);

    // 3. Test trigger on expenses insertion
    console.log("3. Testing expenses trigger for activity_log...");
    const { data: expense, error: expErr } = await supabase
      .from('expenses')
      .insert({
        trip_id: testTripId,
        paid_by: testUserId,
        amount: 85.00,
        currency: 'USD',
        description: 'Verify Taxis'
      })
      .select()
      .single();

    if (expErr) throw expErr;
    testExpenseId = expense.id;

    // Check activity_log for expense trigger
    const { data: expLogs, error: expLogErr } = await supabase
      .from('activity_log')
      .select('*')
      .eq('trip_id', testTripId)
      .eq('action_type', 'add_expense')
      .order('created_at', { ascending: false })
      .limit(5);

    if (expLogErr) throw expLogErr;
    const foundExpLog = expLogs.find(l => l.description.includes('Verify Taxis'));
    if (!foundExpLog) {
      throw new Error("Trigger log for expenses insertion not found in activity_log!");
    }
    console.log("✅ expenses trigger verified:", foundExpLog.description);

    // 4. Test explicit activity_log insertion (voting activity)
    console.log("4. Testing direct insertion into activity_log...");
    const { data: manualLog, error: manualErr } = await supabase
      .from('activity_log')
      .insert({
        trip_id: testTripId,
        user_id: testUserId,
        action_type: 'vote_option',
        description: 'Verification User voted on an option in activities'
      })
      .select()
      .single();

    if (manualErr) throw manualErr;
    manualLogId = manualLog.id;
    console.log("✅ Direct activity_log insert verified:", manualLog.description);

    // 5. Clean up
    console.log("5. Cleaning up test records...");
    if (testOptionId) await supabase.from('poll_options').delete().eq('id', testOptionId);
    if (testExpenseId) await supabase.from('expenses').delete().eq('id', testExpenseId);
    if (manualLogId) await supabase.from('activity_log').delete().eq('id', manualLogId);
    if (foundOptLog) await supabase.from('activity_log').delete().eq('id', foundOptLog.id);
    if (foundExpLog) await supabase.from('activity_log').delete().eq('id', foundExpLog.id);

    console.log("Activity Log & Notification Feed Verification SUCCESSFUL!");
    process.exit(0);
  } catch (err) {
    console.error("Verification failed:", err.message || err);
    if (testOptionId) await supabase.from('poll_options').delete().eq('id', testOptionId).catch(() => {});
    if (testExpenseId) await supabase.from('expenses').delete().eq('id', testExpenseId).catch(() => {});
    if (manualLogId) await supabase.from('activity_log').delete().eq('id', manualLogId).catch(() => {});
    process.exit(1);
  }
}

testActivityLogIntegration();
