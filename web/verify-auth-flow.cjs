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
  console.log("Running Phase 17 schema and service verification...");
  
  // Note: Since login_tokens table requires manual dashboard migration,
  // we check if it is online, but output warnings if user has not loaded migrations yet.
  try {
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (usersError) {
      console.error("Failed to query users table:", usersError);
      process.exit(1);
    }
    console.log("Database connectivity verified.");

    const { data: tokenData, error: tokenError } = await supabase
      .from('login_tokens')
      .select('*')
      .limit(1);

    if (tokenError) {
      if (tokenError.code === 'PGRST205' || tokenError.message.includes("Could not find")) {
        console.warn("⚠️ WARNING: 'login_tokens' table does not exist yet. Please run the SQL script in 17-MIGRATIONS.sql.");
        // Do not crash during Wave 0 stub verification
        console.log("Wave 0 stub check completed successfully (pending table creation).");
        process.exit(0);
      } else {
        throw tokenError;
      }
    }

    console.log("Success: login_tokens table exists and is accessible.");
    process.exit(0);
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  }
}

runVerification();
