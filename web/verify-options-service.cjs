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

// We dynamically load the options service using a require/import mock 
// since verify-options-service.cjs is CommonJS and options.js is ES module.
// Instead of importing, we test the logic directly in this integration script 
// replicating options.js functions to verify database capability and correct behavior.

async function testOptionsService() {
  console.log("Starting Options & Voting Service Integration Tests...");
  
  let testTripId = null;
  let testUserId = null;
  let testOptionId = null;
  let testPollId = null;
  const mockUserUuid = "00000000-0000-0000-0000-000000000000";
  const category = "accommodation";

  try {
    // 1. Fetch a trip to use
    console.log("1. Finding active trip...");
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('id')
      .limit(1);

    if (tripsError) throw tripsError;
    if (trips.length === 0) {
      throw new Error("No trips found in database. Please run seed or create a trip first.");
    }
    testTripId = trips[0].id;
    console.log(`Using Trip ID: ${testTripId}`);

    // 2. Find or create a user for added_by
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

    // 3. Insert test option (PITCH-04)
    console.log("3. Pitching a new test option...");
    const { data: option, error: optError } = await supabase
      .from('poll_options')
      .insert({
        trip_id: testTripId,
        category: category,
        option_text: 'Verification Test Hotel',
        estimated_cost: 150.50,
        currency: 'USD',
        link: 'https://example.com/test-hotel',
        description: 'Mock hotel for verify script',
        added_by: testUserId
      })
      .select()
      .single();

    if (optError) throw optError;
    testOptionId = option.id;
    console.log(`Successfully pitched option. ID: ${testOptionId}, Text: ${option.option_text}`);

    // 4. Fetch options matching trip and category
    console.log("4. Fetching options...");
    const { data: fetchedOpts, error: fetchOptError } = await supabase
      .from('poll_options')
      .select('*')
      .eq('trip_id', testTripId)
      .eq('category', category);

    if (fetchOptError) throw fetchOptError;
    const found = fetchedOpts.find(o => o.id === testOptionId);
    if (!found) {
      throw new Error("Pitched option was not found in options fetch results.");
    }
    console.log(`Successfully verified option in fetch list. Count: ${fetchedOpts.length}`);

    // 5. Fetch/create active poll (PITCH-05)
    console.log("5. Resolving active poll...");
    let { data: poll, error: pollError } = await supabase
      .from('active_polls')
      .select('*')
      .eq('trip_id', testTripId)
      .eq('category', category)
      .maybeSingle();

    if (pollError) throw pollError;
    
    if (!poll) {
      console.log("Creating a default active poll record...");
      const { data: newPoll, error: createPollError } = await supabase
        .from('active_polls')
        .insert({
          trip_id: testTripId,
          category: category,
          telegram_poll_id: null,
          poll_options_json: [],
          voter_selections: {},
          votes_by_option: {}
        })
        .select()
        .single();
        
      if (createPollError) throw createPollError;
      poll = newPoll;
    }
    testPollId = poll.id;
    console.log(`Active poll resolved. ID: ${testPollId}`);

    // 6. Test Casting Vote
    console.log("6. Simulating casting vote...");
    const voterSelections = { ...(poll.voter_selections || {}) };
    let userVotes = Array.isArray(voterSelections[mockUserUuid]) ? [...voterSelections[mockUserUuid]] : [];
    
    const optIdStr = String(testOptionId);
    if (!userVotes.includes(optIdStr)) {
      userVotes.push(optIdStr);
    }
    voterSelections[mockUserUuid] = userVotes;

    // Recalculate
    const votesByOption = {};
    Object.values(voterSelections).forEach(opts => {
      if (Array.isArray(opts)) {
        opts.forEach(id => {
          const idStr = String(id);
          votesByOption[idStr] = (votesByOption[idStr] || 0) + 1;
        });
      }
    });

    const { data: votedPoll, error: voteError } = await supabase
      .from('active_polls')
      .update({
        voter_selections: voterSelections,
        votes_by_option: votesByOption
      })
      .eq('id', testPollId)
      .select()
      .single();

    if (voteError) throw voteError;
    
    const mockUserVoted = votedPoll.voter_selections[mockUserUuid] || [];
    if (!mockUserVoted.includes(optIdStr)) {
      throw new Error("Mock user vote was not registered in voter_selections JSONB.");
    }
    if ((votedPoll.votes_by_option[optIdStr] || 0) < 1) {
      throw new Error("Option vote count tally was not incremented in votes_by_option.");
    }
    console.log("Successfully verified vote casting in active_polls JSONB columns!");

    // 7. Test Retracting Vote
    console.log("7. Simulating retracting vote...");
    const currentSelections = { ...(votedPoll.voter_selections || {}) };
    let currentUserVotes = Array.isArray(currentSelections[mockUserUuid]) ? [...currentSelections[mockUserUuid]] : [];
    
    currentUserVotes = currentUserVotes.filter(id => String(id) !== optIdStr);
    if (currentUserVotes.length > 0) {
      currentSelections[mockUserUuid] = currentUserVotes;
    } else {
      delete currentSelections[mockUserUuid];
    }

    const currentVotesByOption = {};
    Object.values(currentSelections).forEach(opts => {
      if (Array.isArray(opts)) {
        opts.forEach(id => {
          const idStr = String(id);
          currentVotesByOption[idStr] = (currentVotesByOption[idStr] || 0) + 1;
        });
      }
    });

    const { data: unvotedPoll, error: unvoteError } = await supabase
      .from('active_polls')
      .update({
        voter_selections: currentSelections,
        votes_by_option: currentVotesByOption
      })
      .eq('id', testPollId)
      .select()
      .single();

    if (unvoteError) throw unvoteError;

    const mockUserRemainingVotes = unvotedPoll.voter_selections[mockUserUuid] || [];
    if (mockUserRemainingVotes.includes(optIdStr)) {
      throw new Error("Mock user vote still exists in voter_selections after retraction.");
    }
    if ((unvotedPoll.votes_by_option[optIdStr] || 0) !== 0) {
      throw new Error("Option vote count tally was not cleared/decremented to 0 in votes_by_option.");
    }
    console.log("Successfully verified vote retraction in active_polls JSONB columns!");

    // 8. Clean up
    console.log("8. Cleaning up test option and restoring poll record...");
    if (testOptionId) {
      await supabase.from('poll_options').delete().eq('id', testOptionId);
    }
    
    // Restore original active_polls voter selections and tallies if we just created/modified them
    if (testPollId) {
      await supabase
        .from('active_polls')
        .update({
          voter_selections: poll.voter_selections || {},
          votes_by_option: poll.votes_by_option || {}
        })
        .eq('id', testPollId);
    }
    
    console.log("Option Pitching & Voting Database Integration verification Successful!");
    process.exit(0);
  } catch (err) {
    console.error("Verification script failed:", err.message || err);
    
    // Emergency cleanup
    if (testOptionId) {
      try {
        await supabase.from('poll_options').delete().eq('id', testOptionId);
      } catch (_) {}
    }
    
    process.exit(1);
  }
}

testOptionsService();
