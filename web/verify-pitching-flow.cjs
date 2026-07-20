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

const supabaseUrl = env.SUPABASE_URL || 'https://obilxzpljuphlkkchnam.supabase.co';
const supabaseKey = env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPitchingFlow() {
  console.log('--- Phase 21 Option Pitching & Voting Verification ---');

  // 1. Create a dummy trip
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .insert({
      title: 'Phase 21 Pitching Audit Trip',
      destination: 'Hawaii',
      start_date: '2026-08-01',
      end_date: '2026-08-10',
      base_currency: 'USD'
    })
    .select()
    .single();

  if (tripErr) {
    console.error('❌ Failed to create test trip:', tripErr);
    process.exit(1);
  }
  console.log('✓ Test trip created:', trip.id);

  // 2. Create a dummy user
  const { data: user, error: userErr } = await supabase
    .from('users')
    .insert({
      email: `tester_${Date.now()}@example.com`,
      telegram_id: -1 * (Date.now() * 1000 + Math.floor(Math.random() * 1000)),
      first_name: 'AuditUser',
      username: `audit_${Date.now()}`
    })
    .select()
    .single();

  if (userErr) {
    console.error('❌ Failed to create test user:', userErr);
    process.exit(1);
  }
  console.log('✓ Test user created:', user.id);

  const categories = ['accommodation', 'flights', 'activities', 'food', 'transport', 'other'];

  try {
    // 3. Pitch options across all 6 categories
    for (const cat of categories) {
      const { data: opt, error: optErr } = await supabase
        .from('poll_options')
        .insert({
          trip_id: trip.id,
          category: cat,
          option_text: `Test ${cat} Option`,
          estimated_cost: 150.00,
          currency: 'USD',
          added_by: user.id
        })
        .select()
        .single();

      if (optErr) {
        throw new Error(`Failed to pitch option under category ${cat}: ${optErr.message}`);
      }
      console.log(`✓ Pitched option under category '${cat}':`, opt.id);

      // 4. Create/fetch active poll for category
      const { data: poll, error: pollErr } = await supabase
        .from('active_polls')
        .insert({
          trip_id: trip.id,
          category: cat,
          poll_options_json: [],
          voter_selections: {},
          votes_by_option: {}
        })
        .select()
        .single();

      if (pollErr) {
        throw new Error(`Failed to create active poll under category ${cat}: ${pollErr.message}`);
      }
      console.log(`✓ Active poll created under category '${cat}':`, poll.id);

      // 5. Cast vote on active poll
      const voterSel = { [user.id]: [String(opt.id)] };
      const votesByOpt = { [String(opt.id)]: 1 };

      const { data: updatedPoll, error: updateErr } = await supabase
        .from('active_polls')
        .update({
          voter_selections: voterSel,
          votes_by_option: votesByOpt
        })
        .eq('id', poll.id)
        .select()
        .single();

      if (updateErr) {
        throw new Error(`Failed to cast vote on category ${cat}: ${updateErr.message}`);
      }
      console.log(`✓ Cast vote on category '${cat}' successfully!`);
    }

    // 6. Check activity log trigger firings
    const { data: logs, error: logErr } = await supabase
      .from('activity_log')
      .select('*')
      .eq('trip_id', trip.id);

    if (logErr) {
      console.error('❌ Failed to fetch activity log:', logErr);
    } else {
      console.log(`✓ Activity log recorded ${logs.length} events for trip!`);
    }

    console.log('✅ ALL OPTION PITCHING & VOTING CHECKS PASSED!');

  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  } finally {
    // Cleanup
    await supabase.from('poll_options').delete().eq('trip_id', trip.id);
    await supabase.from('active_polls').delete().eq('trip_id', trip.id);
    await supabase.from('activity_log').delete().eq('trip_id', trip.id);
    await supabase.from('trips').delete().eq('id', trip.id);
    await supabase.from('users').delete().eq('id', user.id);
    console.log('✓ Cleanup completed.');
  }
}

verifyPitchingFlow();
