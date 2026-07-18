const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env file
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
  console.error("Error: SUPABASE_URL or SUPABASE_KEY missing in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runVerification() {
  console.log("Running Phase 19 Hybrid Coexistence verification...");
  
  let testUserId = null;
  const originalUsername = "CoexistTestUser";
  const lowercaseUsername = "coexisttestuser";
  const tempTelegramId = -3000000 - Math.floor(Math.random() * 1000000);
  const positiveTelegramId = 55667788;

  try {
    // 1. Create a user with a negative telegram_id and mixed-case username
    console.log(`Creating user with username "${originalUsername}" and negative telegram_id: ${tempTelegramId}...`);
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        telegram_id: tempTelegramId,
        first_name: "Coexist",
        username: originalUsername
      })
      .select()
      .single();

    if (userError) throw userError;
    testUserId = user.id;
    console.log(`User created successfully with ID: ${testUserId}`);

    // 2. Query the user case-insensitively using .ilike()
    console.log(`Querying username "${lowercaseUsername}" case-insensitively...`);
    const { data: queriedUser, error: queryError } = await supabase
      .from('users')
      .select('*')
      .ilike('username', lowercaseUsername)
      .maybeSingle();

    if (queryError) throw queryError;
    if (!queriedUser) {
      throw new Error(`Failed to find user with username "${lowercaseUsername}" case-insensitively`);
    }
    console.log(`Successfully found user by lowercase query. Matching ID: ${queriedUser.id}`);

    // 3. Simulate bot linking: update telegram_id of the retrieved user record
    console.log(`Simulating bot linking by updating telegram_id to positive value: ${positiveTelegramId}...`);
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        telegram_id: positiveTelegramId
      })
      .eq('id', testUserId)
      .select()
      .single();

    if (updateError) throw updateError;
    console.log(`Updated user telegram_id in DB: ${updatedUser.telegram_id}`);
    
    if (updatedUser.telegram_id !== positiveTelegramId) {
      throw new Error(`Expected telegram_id to be updated to ${positiveTelegramId}, but got ${updatedUser.telegram_id}`);
    }

    console.log("Success: Case-insensitive query and profile merging verified.");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  } finally {
    // Cleanup
    if (testUserId) {
      console.log("Cleaning up database test records...");
      await supabase.from('users').delete().eq('id', testUserId);
      console.log("Cleanup completed.");
    }
    process.exit(0);
  }
}

runVerification();
