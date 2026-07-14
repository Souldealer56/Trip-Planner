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

async function testExpensesService() {
  console.log("Starting Expenses & Ledger Database Integration Tests...");
  
  let testTripId = null;
  let testUserId = null;
  let testExpenseId = null;

  try {
    // 1. Fetch a trip to use
    console.log("1. Finding active trip...");
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('id')
      .limit(1);

    if (tripsError) throw tripsError;
    if (trips.length === 0) {
      throw new Error("No trips found in database.");
    }
    testTripId = trips[0].id;
    console.log(`Using Trip ID: ${testTripId}`);

    // 2. Find a user to use
    console.log("2. Resolving test user...");
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (usersError) throw usersError;
    if (users.length === 0) {
      throw new Error("No users found in database.");
    }
    testUserId = users[0].id;
    console.log(`Using User ID: ${testUserId}`);

    // 3. Log a test expense (LEDG-01)
    console.log("3. Logging a test expense with custom currency and split array...");
    const { data: expense, error: logError } = await supabase
      .from('expenses')
      .insert({
        trip_id: testTripId,
        paid_by: testUserId,
        amount: 85.50,
        currency: 'EUR',
        description: 'Verification Integration Expense',
        split_users: [testUserId]
      })
      .select()
      .single();

    if (logError) throw logError;
    testExpenseId = expense.id;
    console.log(`Successfully logged expense. ID: ${testExpenseId}, Currency: ${expense.currency}, Split: ${JSON.stringify(expense.split_users)}`);

    // 4. Fetch expenses with user detail join (LEDG-02)
    console.log("4. Fetching expenses ledger table with user join...");
    const { data: fetchedExpenses, error: fetchError } = await supabase
      .from('expenses')
      .select('*, users!expenses_paid_by_fkey(first_name, username)')
      .eq('trip_id', testTripId);

    if (fetchError) throw fetchError;
    
    const found = fetchedExpenses.find(e => e.id === testExpenseId);
    if (!found) {
      throw new Error("Logged expense not found in fetched list.");
    }
    if (!found.users || !found.users.first_name) {
      throw new Error("Failed to join with users table to retrieve payer details.");
    }
    console.log(`Successfully verified joined ledger entry. Payer first name: ${found.users.first_name}`);

    // 5. Clean up
    console.log("5. Cleaning up test expense...");
    await supabase
      .from('expenses')
      .delete()
      .eq('id', testExpenseId);

    console.log("Expenses & Ledger Database Integration verification Successful!");
    process.exit(0);
  } catch (err) {
    console.error("Verification script failed:", err.message || err);
    if (testExpenseId) {
      try {
        await supabase.from('expenses').delete().eq('id', testExpenseId);
      } catch (_) {}
    }
    process.exit(1);
  }
}

testExpensesService();
