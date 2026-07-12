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

async function verifyDatabaseIntegration() {
  console.log(`Connecting to Supabase URL: ${supabaseUrl}...`);
  
  // Use a distinct negative telegram_id for isolation
  const testTelegramId = -9999999;
  let testUserId = null;
  let testTripId = null;

  try {
    // 1. Verify we can fetch trips
    console.log("1. Fetching trips...");
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('id, title')
      .limit(1);

    if (tripsError) {
      throw tripsError;
    }
    console.log(`Successfully fetched trips. Count: ${trips.length}`);

    if (trips.length === 0) {
      console.warn("⚠️ Warning: No trips exist in the database. Cannot run RSVP verification steps.");
    } else {
      testTripId = trips[0].id;
      console.log(`Using existing trip ID: ${testTripId}`);
    }

    // 2. Verify we can insert a test user (with negative telegram_id)
    console.log("2. Inserting test user...");
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        telegram_id: testTelegramId,
        username: 'verify_test_user',
        first_name: 'Verification Test User'
      })
      .select()
      .single();

    if (userError) {
      throw userError;
    }
    testUserId = user.id;
    console.log(`Successfully created test user. ID: ${testUserId}, telegram_id: ${user.telegram_id}`);

    // 3. Verify we can link user to trip via RSVP
    if (testTripId && testUserId) {
      console.log("3. Creating committed RSVP linkage...");
      const { data: rsvp, error: rsvpError } = await supabase
        .from('rsvps')
        .insert({
          trip_id: testTripId,
          user_id: testUserId,
          status: 'Committed'
        })
        .select()
        .single();

      if (rsvpError) {
        throw rsvpError;
      }
      console.log(`Successfully created RSVP link. Trip: ${rsvp.trip_id}, User: ${rsvp.user_id}`);

      // 4. Verify we can query the roster for the trip
      console.log("4. Fetching RSVP roster to verify linkage...");
      const { data: roster, error: rosterError } = await supabase
        .from('rsvps')
        .select('status, user_id, users(*)')
        .eq('trip_id', testTripId);

      if (rosterError) {
        throw rosterError;
      }
      const linkedRecord = roster.find(r => r.user_id === testUserId);
      if (!linkedRecord || !linkedRecord.users) {
        throw new Error("Could not find test user in RSVP roster query join.");
      }
      console.log("Roster contains test user with details: ", linkedRecord.users.first_name);
    }

    // 5. Clean up: delete test user (should cascade delete RSVP)
    if (testUserId) {
      console.log("5. Cleaning up test user record...");
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', testUserId);

      if (deleteError) {
        throw deleteError;
      }
      console.log("Successfully cleaned up test user record.");
    }

    console.log("Database Integration Verification Successful! All checks passed.");
    process.exit(0);
  } catch (err) {
    console.error("Database Integration Verification Failed:", err.message || err);

    // Attempt emergency cleanup if test user was created
    if (testUserId) {
      console.log("Running emergency cleanup...");
      try {
        await supabase.from('users').delete().eq('id', testUserId);
      } catch (cleanErr) {
        console.error("Emergency cleanup failed:", cleanErr.message);
      }
    }
    process.exit(1);
  }
}

verifyDatabaseIntegration();
