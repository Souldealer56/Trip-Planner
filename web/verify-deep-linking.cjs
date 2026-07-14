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
    // Remove outer quotes if present
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

// We dynamically import/simulate the service lookup functions to test them in commonjs
async function fetchUserByTelegramId(telegramId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (error) throw error;
  return data;
}

async function fetchUserByUsername(username) {
  if (!username) return null;
  const cleanUsername = username.trim().replace(/^@/, '');
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('username', cleanUsername)
    .maybeSingle()

  if (error) throw error;
  return data;
}

async function testDeepLinking() {
  console.log("Starting Deep Link Lookups Database Integration Tests (Phase 16)...");

  let testUserId = null;
  const testTelegramId = 88887777;
  const testUsername = 'DeepLinkTestTraveler';

  try {
    // 1. Create test user
    console.log("1. Creating test user...");
    const { data: user, error: errUser } = await supabase
      .from('users')
      .insert({
        telegram_id: testTelegramId,
        username: testUsername,
        first_name: 'Deep Link Test'
      })
      .select().single();
    if (errUser) throw errUser;
    testUserId = user.id;
    console.log(`Created user with ID: ${testUserId}`);

    // 2. Test lookup by Telegram ID
    console.log("2. Verifying lookup by Telegram ID...");
    const userById = await fetchUserByTelegramId(testTelegramId);
    if (!userById || userById.id !== testUserId) {
      throw new Error(`Lookup by telegram_id failed. Expected ID: ${testUserId}, Got: ${userById ? userById.id : 'null'}`);
    }
    console.log("✓ Lookup by Telegram ID verified!");

    // 3. Test lookup by username (exact match)
    console.log("3. Verifying lookup by exact username...");
    const userByNameExact = await fetchUserByUsername(testUsername);
    if (!userByNameExact || userByNameExact.id !== testUserId) {
      throw new Error("Lookup by exact username failed.");
    }
    console.log("✓ Exact username match verified!");

    // 4. Test lookup by username with leading @ symbol
    console.log("4. Verifying lookup by username containing leading @ symbol...");
    const userByNameAt = await fetchUserByUsername(`@${testUsername}`);
    if (!userByNameAt || userByNameAt.id !== testUserId) {
      throw new Error("Lookup by username with leading '@' failed.");
    }
    console.log("✓ Username with leading '@' verified!");

    // 5. Test lookup by username case-insensitively
    console.log("5. Verifying lookup by lowercase username...");
    const userByNameLower = await fetchUserByUsername(testUsername.toLowerCase());
    if (!userByNameLower || userByNameLower.id !== testUserId) {
      throw new Error("Case-insensitive lookup by username failed.");
    }
    console.log("✓ Case-insensitive username match verified!");

    // 6. Cleanup
    await cleanUp(testUserId);
    console.log("Deep Link Lookups Database Integration Tests successful! All checks passed.");
    process.exit(0);
  } catch (err) {
    console.error("Deep Link Lookups verification failed:", err.message || err);
    await cleanUp(testUserId);
    process.exit(1);
  }
}

async function cleanUp(userId) {
  if (userId) {
    console.log("Cleaning up test user...");
    try {
      await supabase.from('users').delete().eq('id', userId);
      console.log("Cleanup complete.");
    } catch (err) {
      console.error("Cleanup failed:", err.message);
    }
  }
}

testDeepLinking();
