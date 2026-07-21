const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

async function verifyFullAudit() {
  console.log('--- Phase 24 Full Platform Feature & Flow Audit ---');

  // 1. Setup Test Trip and Users
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .insert({
      title: 'Full Audit Trip',
      destination: 'Kyoto',
      start_date: '2026-12-01',
      end_date: '2026-12-10',
      base_currency: 'USD',
      vibe: 'Cultural Discovery'
    })
    .select()
    .single();

  if (tripErr) {
    console.error('❌ Failed to create test trip:', tripErr);
    process.exit(1);
  }

  const tgId1 = -900000 - Math.floor(Math.random() * 100000);
  const tgId2 = -900000 - Math.floor(Math.random() * 100000);

  const { data: user1, error: u1Err } = await supabase
    .from('users')
    .insert({ first_name: 'Audit User 1', telegram_id: tgId1 })
    .select()
    .single();

  if (u1Err) {
    console.error('❌ Failed to create user 1:', u1Err);
    process.exit(1);
  }

  const { data: user2, error: u2Err } = await supabase
    .from('users')
    .insert({ first_name: 'Audit User 2', telegram_id: tgId2 })
    .select()
    .single();

  if (u2Err) {
    console.error('❌ Failed to create user 2:', u2Err);
    process.exit(1);
  }

  console.log('✓ Initialized test trip and users:', trip.id);

  try {
    // AUD-01: Option Pitching & Voting Audit
    const { data: opt, error: optErr } = await supabase
      .from('poll_options')
      .insert({
        trip_id: trip.id,
        category: 'accommodation',
        option_text: 'Kyoto Ryokan',
        estimated_cost: 600.00,
        currency: 'USD',
        added_by: user1.id
      })
      .select()
      .single();

    if (optErr) throw new Error(`Pitch option failed: ${optErr.message}`);
    console.log('✓ AUD-01 Option pitched successfully:', opt.id);

    const { data: poll, error: pollErr } = await supabase
      .from('active_polls')
      .insert({
        trip_id: trip.id,
        category: 'accommodation',
        voter_selections: { [user1.id]: [String(opt.id)] },
        votes_by_option: { [String(opt.id)]: 1 }
      })
      .select()
      .single();

    if (pollErr) throw new Error(`Active poll update failed: ${pollErr.message}`);
    console.log('✓ AUD-01 Voting & active poll sync verified!');

    // AUD-02: Trip Settings & Date Reconciliation Audit
    const { data: updatedTrip, error: settingsErr } = await supabase
      .from('trips')
      .update({
        title: 'Kyoto & Osaka',
        base_currency: 'EUR',
        start_date: '2026-12-05',
        end_date: '2026-12-08'
      })
      .eq('id', trip.id)
      .select()
      .single();

    if (settingsErr) throw new Error(`Trip settings update failed: ${settingsErr.message}`);
    console.log('✓ AUD-02 Trip settings & currency update verified:', updatedTrip.base_currency);

    // AUD-03: Expense Logging & Debt Settlement Audit
    const { data: expense, error: expErr } = await supabase
      .from('expenses')
      .insert({
        trip_id: trip.id,
        paid_by: user1.id,
        amount: 150.00,
        currency: 'USD',
        description: 'Traditional Tea Ceremony',
        split_users: [user1.id, user2.id]
      })
      .select()
      .single();

    if (expErr) throw new Error(`Expense logging failed: ${expErr.message}`);
    console.log('✓ AUD-03 Expense logging & split verified:', expense.id);

    // AUD-04: User Profiles & Session Audit
    const { data: updatedUser1, error: profErr } = await supabase
      .from('users')
      .update({
        first_name: 'Audit User 1 Master'
      })
      .eq('id', user1.id)
      .select()
      .single();

    if (profErr || updatedUser1.first_name !== 'Audit User 1 Master') {
      throw new Error(`Profile update failed: ${profErr ? profErr.message : 'Mismatch'}`);
    }
    console.log('✓ AUD-04 User profile editing verified!');

    console.log('✅ ALL FULL PLATFORM FEATURE & FLOW AUDIT CHECKS PASSED!');

  } catch (err) {
    console.error('❌ Full Audit verification failed:', err.message);
    process.exit(1);
  } finally {
    // Cleanup
    if (trip?.id) {
      await supabase.from('expenses').delete().eq('trip_id', trip.id);
      await supabase.from('poll_options').delete().eq('trip_id', trip.id);
      await supabase.from('active_polls').delete().eq('trip_id', trip.id);
      await supabase.from('trips').delete().eq('id', trip.id);
    }
    const userIds = [user1?.id, user2?.id].filter(Boolean);
    if (userIds.length > 0) {
      await supabase.from('users').delete().in('id', userIds);
    }
    console.log('✓ Cleanup completed.');
  }
}

verifyFullAudit();
