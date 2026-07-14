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
  console.error("Error: SUPABASE_URL or SUPABASE_KEY missing in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedFakeTrip() {
  console.log("🚀 Starting Mock Trip Seeding Process...");

  try {
    // 1. Create 4 mock users
    console.log("1. Creating mock participants (Alice, Bob, Charlie, Diana)...");
    const mockUsers = [
      { first_name: 'Alice', username: 'alice_travels', telegram_id: -1000000 - Math.floor(Math.random() * 1000000) },
      { first_name: 'Bob', username: 'bob_adventures', telegram_id: -1000000 - Math.floor(Math.random() * 1000000) },
      { first_name: 'Charlie', username: 'charlie_globe', telegram_id: -1000000 - Math.floor(Math.random() * 1000000) },
      { first_name: 'Diana', username: 'diana_explorer', telegram_id: -1000000 - Math.floor(Math.random() * 1000000) }
    ];

    const insertedUsers = [];
    for (const u of mockUsers) {
      const { data: user, error } = await supabase
        .from('users')
        .insert(u)
        .select()
        .single();
      if (error) throw error;
      insertedUsers.push(user);
      console.log(`Created User: ${user.first_name} (ID: ${user.id})`);
    }

    const [alice, bob, charlie, diana] = insertedUsers;

    // 2. Create Trip
    console.log("2. Creating new trip ('Euro Summer Getaway 2026')...");
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        title: 'Euro Summer Getaway 2026 🇪🇺✈️',
        destination: 'Paris & Rome 🥐🍕',
        start_date: '2026-07-20',
        end_date: '2026-07-30',
        base_currency: 'EUR',
        organizer_id: alice.id,
        group_chat_id: -1000000000 - Math.floor(Math.random() * 100000000)
      })
      .select()
      .single();

    if (tripError) throw tripError;
    console.log(`Created Trip: "${trip.title}" (ID: ${trip.id})`);

    // 3. Insert RSVPs
    console.log("3. Mapping RSVPs (Alice, Bob, Charlie -> Committed, Diana -> Tentative)...");
    const rsvps = [
      { trip_id: trip.id, user_id: alice.id, status: 'Committed' },
      { trip_id: trip.id, user_id: bob.id, status: 'Committed' },
      { trip_id: trip.id, user_id: charlie.id, status: 'Committed' },
      { trip_id: trip.id, user_id: diana.id, status: 'Tentative' }
    ];

    const { error: rsvpsError } = await supabase
      .from('rsvps')
      .insert(rsvps);
    if (rsvpsError) throw rsvpsError;
    console.log("RSVPs created successfully!");

    // 4. Pitch Suggestions Options
    console.log("4. Pitching suggestion options (Accommodation A1 & A2, Flights F1)...");
    const mockOptions = [
      {
        trip_id: trip.id,
        category: 'accommodation',
        option_text: 'Glasshouse Penthouse Paris 🗼',
        estimated_cost: 1200.00,
        currency: 'EUR',
        link: 'https://example.com/paris-loft',
        description: 'Beautiful rooftop view of the Eiffel Tower, fits 4 comfortably.',
        added_by: alice.id
      },
      {
        trip_id: trip.id,
        category: 'accommodation',
        option_text: 'Trastevere Cozy Loft Rome 🏛️',
        estimated_cost: 850.00,
        currency: 'EUR',
        link: 'https://example.com/rome-loft',
        description: 'Cozy historical neighborhood, walking distance to Colosseum and restaurants.',
        added_by: bob.id
      },
      {
        trip_id: trip.id,
        category: 'flights',
        option_text: 'Direct Flight Air France ✈️',
        estimated_cost: 350.00,
        currency: 'EUR',
        link: 'https://airfrance.com',
        description: 'Morning departure, returns late evening. Baggage included.',
        added_by: charlie.id
      }
    ];

    const insertedOptions = [];
    for (const opt of mockOptions) {
      const { data: option, error } = await supabase
        .from('poll_options')
        .insert(opt)
        .select()
        .single();
      if (error) throw error;
      insertedOptions.push(option);
      console.log(`Pitched Option: "${option.option_text}" (ID: ${option.id})`);
    }

    const [a1, a2, f1] = insertedOptions;

    // 5. Setup Active Polls & Votes
    console.log("5. Initializing active polls and votes...");
    
    // Accommodation Poll: Alice and Bob vote for A1; Bob and Charlie vote for A2
    const accSelections = {
      [alice.id]: [String(a1.id)],
      [bob.id]: [String(a1.id), String(a2.id)],
      [charlie.id]: [String(a2.id)]
    };
    const accVotesCount = {
      [String(a1.id)]: 2,
      [String(a2.id)]: 2
    };

    const { error: accPollError } = await supabase
      .from('active_polls')
      .insert({
        trip_id: trip.id,
        category: 'accommodation',
        telegram_poll_id: null,
        poll_options_json: [],
        voter_selections: accSelections,
        votes_by_option: accVotesCount
      });
    if (accPollError) throw accPollError;

    // Flights Poll: Alice, Bob, and Charlie vote for F1
    const flightSelections = {
      [alice.id]: [String(f1.id)],
      [bob.id]: [String(f1.id)],
      [charlie.id]: [String(f1.id)]
    };
    const flightVotesCount = {
      [String(f1.id)]: 3
    };

    const { error: flightPollError } = await supabase
      .from('active_polls')
      .insert({
        trip_id: trip.id,
        category: 'flights',
        telegram_poll_id: null,
        poll_options_json: [],
        voter_selections: flightSelections,
        votes_by_option: flightVotesCount
      });
    if (flightPollError) throw flightPollError;
    console.log("Polls and votes populated!");

    // 6. Log Expenses
    console.log("6. Logging multi-currency expenses...");
    
    const mockExpenses = [
      {
        trip_id: trip.id,
        paid_by: alice.id,
        amount: 600.00,
        currency: 'EUR',
        description: 'Accommodation Deposit Paris',
        split_users: [alice.id, bob.id, charlie.id] // Split between committed members
      },
      {
        trip_id: trip.id,
        paid_by: bob.id,
        amount: 180.00,
        currency: 'USD',
        description: 'Eiffel Tower Dinner',
        split_users: [alice.id, bob.id, charlie.id, diana.id] // Split between all (including tentative)
      },
      {
        trip_id: trip.id,
        paid_by: charlie.id,
        amount: 120.00,
        currency: 'EUR',
        description: 'Colosseum Tickets',
        split_users: [alice.id, charlie.id] // selective split
      }
    ];

    for (const exp of mockExpenses) {
      const { data: expense, error } = await supabase
        .from('expenses')
        .insert(exp)
        .select()
        .single();
      if (error) throw error;
      console.log(`Logged Expense: "${expense.description}" of ${expense.amount} ${expense.currency} (ID: ${expense.id})`);
    }

    console.log("=========================================");
    console.log("🎉 SUCCESS: Mock Trip Seeding Complete!");
    console.log(`You can now open the webapp and view:`);
    console.log(`👉 Trip Title: Euro Summer Getaway 2026 🇪🇺✈️`);
    console.log(`👉 Trip ID: ${trip.id}`);
    console.log("=========================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err.message || err);
    process.exit(1);
  }
}

seedFakeTrip();
