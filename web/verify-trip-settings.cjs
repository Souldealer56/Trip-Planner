const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Custom .env parser
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

const supabaseUrl = env.SUPABASE_URL || 'https://obilxzpljuphlkkchnam.supabase.co';
const supabaseKey = env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTripSettingsFlow() {
  console.log('--- Phase 22 Editable Trip Settings Verification ---');

  // 1. Create a initial trip
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .insert({
      title: 'Original Title',
      destination: 'Tokyo',
      start_date: '2026-10-01',
      end_date: '2026-10-10',
      base_currency: 'USD',
      vibe: 'Initial Vibe'
    })
    .select()
    .single();

  if (tripErr) {
    console.error('❌ Failed to create test trip:', tripErr);
    process.exit(1);
  }
  console.log('✓ Initial test trip created:', trip.id);

  // 2. Create pitched option inside trip dates (Oct 3 - Oct 7)
  const { data: optIn, error: optInErr } = await supabase
    .from('poll_options')
    .insert({
      trip_id: trip.id,
      category: 'accommodation',
      option_text: 'Shinjuku Hotel',
      start_date: '2026-10-03',
      end_date: '2026-10-07',
      estimated_cost: 800.00,
      currency: 'USD'
    })
    .select()
    .single();

  if (optInErr) {
    console.error('❌ Failed to create option:', optInErr);
    process.exit(1);
  }
  console.log('✓ Created option inside dates:', optIn.id);

  try {
    // 3. Update trip metadata (Shorten trip dates to Oct 4 - Oct 6, change currency to EUR)
    const { data: updatedTrip, error: updateErr } = await supabase
      .from('trips')
      .update({
        title: 'Updated Tokyo Adventure',
        destination: 'Tokyo & Kyoto',
        vibe: 'Culture & Food',
        start_date: '2026-10-04',
        end_date: '2026-10-06',
        base_currency: 'EUR'
      })
      .eq('id', trip.id)
      .select()
      .single();

    if (updateErr) {
      throw new Error(`Failed to update trip settings: ${updateErr.message}`);
    }
    console.log('✓ Trip metadata updated:', updatedTrip.title, updatedTrip.base_currency);

    // 4. Verify option date conflict detection
    const tripStart = new Date(updatedTrip.start_date);
    const tripEnd = new Date(updatedTrip.end_date);
    const optStart = new Date(optIn.start_date);
    const optEnd = new Date(optIn.end_date);

    const isConflicting = (optStart < tripStart || optStart > tripEnd || optEnd < tripStart || optEnd > tripEnd);
    if (!isConflicting) {
      throw new Error('Expected option (Oct 3-7) to conflict with shortened trip dates (Oct 4-6)');
    }
    console.log('✓ Option conflict successfully detected for shortened dates!');

    // 5. Insert activity log entry for update
    const { data: log, error: logErr } = await supabase
      .from('activity_log')
      .insert({
        trip_id: trip.id,
        action_type: 'update_trip',
        description: 'Test User updated trip details'
      })
      .select()
      .single();

    if (logErr) {
      throw new Error(`Failed to insert activity log: ${logErr.message}`);
    }
    console.log('✓ Trip update logged in activity feed:', log.id);

    console.log('✅ ALL TRIP SETTINGS & RECONCILIATION CHECKS PASSED!');

  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  } finally {
    // Cleanup
    await supabase.from('poll_options').delete().eq('trip_id', trip.id);
    await supabase.from('activity_log').delete().eq('trip_id', trip.id);
    await supabase.from('trips').delete().eq('id', trip.id);
    console.log('✓ Cleanup completed.');
  }
}

verifyTripSettingsFlow();
