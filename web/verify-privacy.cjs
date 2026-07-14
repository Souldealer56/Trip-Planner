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

async function testPrivacyIsolation() {
  console.log("Starting Privacy Isolation Database Integration Tests (Phase 15)...");

  // Keep track of IDs for cleanup
  let userAId = null;
  let userBId = null;
  let tripAId = null;
  let tripBId = null;

  try {
    // 1. Insert test user A and test user B (distinct negative telegram_ids)
    console.log("1. Creating test users...");
    const { data: userA, error: errUserA } = await supabase
      .from('users')
      .insert({ telegram_id: -9999991, username: 'privacy_test_a', first_name: 'Privacy User A' })
      .select().single();
    if (errUserA) throw errUserA;
    userAId = userA.id;

    const { data: userB, error: errUserB } = await supabase
      .from('users')
      .insert({ telegram_id: -9999992, username: 'privacy_test_b', first_name: 'Privacy User B' })
      .select().single();
    if (errUserB) throw errUserB;
    userBId = userB.id;

    console.log(`Created User A: ${userAId}, User B: ${userBId}`);

    // 2. Create test trip A and test trip B
    console.log("2. Creating test trips...");
    const { data: tripA, error: errTripA } = await supabase
      .from('trips')
      .insert({
        title: 'Trip A (Privacy Test)',
        destination: 'Destination A',
        start_date: '2026-08-01',
        end_date: '2026-08-07',
        base_currency: 'USD'
      })
      .select().single();
    if (errTripA) throw errTripA;
    tripAId = tripA.id;

    const { data: tripB, error: errTripB } = await supabase
      .from('trips')
      .insert({
        title: 'Trip B (Privacy Test)',
        destination: 'Destination B',
        start_date: '2026-09-01',
        end_date: '2026-09-07',
        base_currency: 'EUR'
      })
      .select().single();
    if (errTripB) throw errTripB;
    tripBId = tripB.id;

    console.log(`Created Trip A: ${tripAId}, Trip B: ${tripBId}`);

    // 3. Link User A -> Trip A and User B -> Trip B via RSVP
    console.log("3. Creating RSVP links...");
    const { error: errRsvpA } = await supabase
      .from('rsvps')
      .insert({ trip_id: tripAId, user_id: userAId, status: 'Committed' });
    if (errRsvpA) throw errRsvpA;

    const { error: errRsvpB } = await supabase
      .from('rsvps')
      .insert({ trip_id: tripBId, user_id: userBId, status: 'Committed' });
    if (errRsvpB) throw errRsvpB;

    console.log("Linked User A to Trip A, and User B to Trip B");

    // 4. Query trips for User A using privacy select query
    console.log("4. Testing query for User A...");
    const { data: rsvpsA, error: errQueryA } = await supabase
      .from('rsvps')
      .select('trip_id, trips(id, title)')
      .eq('user_id', userAId);
    if (errQueryA) throw errQueryA;

    const tripsA = rsvpsA.map(r => r.trips).filter(Boolean);
    console.log("User A retrieved trips count:", tripsA.length);
    console.log("Retrieved trips for A:", JSON.stringify(tripsA));

    // Assertions for User A
    const hasTripAForUserA = tripsA.some(t => t.id === tripAId);
    const hasTripBForUserA = tripsA.some(t => t.id === tripBId);
    if (!hasTripAForUserA) {
      throw new Error("Query for User A did not return Trip A (uninvited/missing logic).");
    }
    if (hasTripBForUserA) {
      throw new Error("Query for User A returned Trip B (leakage detected/failed data isolation!).");
    }
    console.log("✓ User A data isolation successfully verified!");

    // 5. Query trips for User B using privacy select query
    console.log("5. Testing query for User B...");
    const { data: rsvpsB, error: errQueryB } = await supabase
      .from('rsvps')
      .select('trip_id, trips(id, title)')
      .eq('user_id', userBId);
    if (errQueryB) throw errQueryB;

    const tripsB = rsvpsB.map(r => r.trips).filter(Boolean);
    console.log("User B retrieved trips count:", tripsB.length);
    console.log("Retrieved trips for B:", JSON.stringify(tripsB));

    // Assertions for User B
    const hasTripAForUserB = tripsB.some(t => t.id === tripAId);
    const hasTripBForUserB = tripsB.some(t => t.id === tripBId);
    if (!hasTripBForUserB) {
      throw new Error("Query for User B did not return Trip B (uninvited/missing logic).");
    }
    if (hasTripAForUserB) {
      throw new Error("Query for User B returned Trip A (leakage detected/failed data isolation!).");
    }
    console.log("✓ User B data isolation successfully verified!");

    // 6. Query with non-existent user
    console.log("6. Testing query for non-existent user...");
    const { data: rsvpsEmpty, error: errQueryEmpty } = await supabase
      .from('rsvps')
      .select('trip_id, trips(id, title)')
      .eq('user_id', '00000000-0000-0000-0000-000000000000');
    if (errQueryEmpty) throw errQueryEmpty;

    if (rsvpsEmpty.length !== 0) {
      throw new Error("Query returned data for non-existent user.");
    }
    console.log("✓ Non-existent user query returned empty list.");

    // Cleanup: delete trips and users (cascading deletes RSVPs)
    await cleanUp(userAId, userBId, tripAId, tripBId);
    console.log("Privacy Isolation Integration Tests successful! All checks passed.");
    process.exit(0);
  } catch (err) {
    console.error("Privacy isolation verification failed:", err.message || err);
    // Emergency cleanup
    await cleanUp(userAId, userBId, tripAId, tripBId);
    process.exit(1);
  }
}

async function cleanUp(userAId, userBId, tripAId, tripBId) {
  console.log("Cleaning up test records...");
  try {
    if (tripAId) await supabase.from('trips').delete().eq('id', tripAId);
    if (tripBId) await supabase.from('trips').delete().eq('id', tripBId);
    if (userAId) await supabase.from('users').delete().eq('id', userAId);
    if (userBId) await supabase.from('users').delete().eq('id', userBId);
    console.log("Cleanup complete.");
  } catch (cleanErr) {
    console.error("Cleanup failed:", cleanErr.message);
  }
}

testPrivacyIsolation();
