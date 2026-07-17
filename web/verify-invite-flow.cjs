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
  console.log("Running Phase 18 Invite & Onboarding flow verification...");
  
  let testUserId = null;
  let testRsvpId = null;
  let testTripId = null;

  let createdTempTrip = false;

  try {
    // 1. Fetch any existing trip to use as a dummy target
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('id, title')
      .limit(1);

    if (tripsError) {
      console.error("Failed to query trips table:", tripsError);
      process.exit(1);
    }

    if (trips.length === 0) {
      console.log("No trips found. Creating a temporary trip for verification...");
      const { data: newTrip, error: createTripError } = await supabase
        .from('trips')
        .insert({
          title: "Verification Trip",
          destination: "Test Land",
          start_date: "2026-08-01",
          end_date: "2026-08-10"
        })
        .select()
        .single();

      if (createTripError) {
        console.error("Failed to create temporary trip:", createTripError);
        process.exit(1);
      }
      testTripId = newTrip.id;
      createdTempTrip = true;
      console.log(`Created temporary trip: ${newTrip.title} (ID: ${testTripId})`);
    } else {
      testTripId = trips[0].id;
      console.log(`Using existing trip: "${trips[0].title}" (ID: ${testTripId})`);
    }

    // 2. Create a temporary user with a negative telegram_id
    const tempTelegramId = -2000000 - Math.floor(Math.random() * 1000000);
    const firstName = "InvitedTraveler";
    const username = `invited_${Math.floor(Math.random() * 100005)}`;

    console.log(`Creating temporary user (telegram_id: ${tempTelegramId})...`);
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        telegram_id: tempTelegramId,
        first_name: firstName,
        username: username
      })
      .select()
      .single();

    if (userError) {
      throw userError;
    }
    testUserId = user.id;
    console.log(`Temporary user created successfully (ID: ${testUserId})`);

    // 3. Create a Tentative RSVP for the user on this trip
    console.log(`Creating Tentative RSVP for user ${testUserId} on trip ${testTripId}...`);
    const { data: rsvp, error: rsvpError } = await supabase
      .from('rsvps')
      .insert({
        trip_id: testTripId,
        user_id: testUserId,
        status: 'Tentative'
      })
      .select()
      .single();

    if (rsvpError) {
      throw rsvpError;
    }
    console.log(`RSVP created successfully with status: ${rsvp.status}`);

    // Verify RSVP status in DB matches 'Tentative'
    if (rsvp.status !== 'Tentative') {
      throw new Error(`RSVP status was expected to be 'Tentative', but got: ${rsvp.status}`);
    }

    console.log("Success: Invited traveler RSVP and onboarding insertion flows verified.");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  } finally {
    // Cleanup created test artifacts
    if (testUserId) {
      console.log("Cleaning up database test records...");
      // RSVPs cascade or delete first
      await supabase.from('rsvps').delete().eq('user_id', testUserId).eq('trip_id', testTripId);
      await supabase.from('users').delete().eq('id', testUserId);
      console.log("Cleanup completed.");
    }
    if (createdTempTrip && testTripId) {
      // If we created a temporary trip, delete it too
      await supabase.from('trips').delete().eq('id', testTripId);
      console.log("Temporary trip cleanup completed.");
    }
    process.exit(0);
  }
}

runVerification();
