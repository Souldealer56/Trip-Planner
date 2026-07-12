const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse parent directory .env
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
  console.error("Error: SUPABASE_URL or SUPABASE_KEY missing");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupE2E() {
  console.log("Locating and deleting test user with first_name 'Subagent E2E User'...");
  try {
    const { data: user, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('first_name', 'Subagent E2E User')
      .limit(1);

    if (selectError) throw selectError;

    if (user.length === 0) {
      console.log("No test user 'Subagent E2E User' found in database. Nothing to clean.");
      process.exit(0);
    }

    const userId = user[0].id;
    console.log(`Found test user ID: ${userId}. Deleting...`);

    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) throw deleteError;

    console.log("Successfully deleted test user and all cascading RSVPs.");
    process.exit(0);
  } catch (err) {
    console.error("Cleanup failed:", err.message || err);
    process.exit(1);
  }
}

cleanupE2E();
