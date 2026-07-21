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

async function verifyProfilePageFlow() {
  console.log('--- Phase 23 User Profile Page Verification ---');

  const testUsername = 'test_profile_user_' + Math.floor(Math.random() * 100000);
  const tempTgId = -2000000 - Math.floor(Math.random() * 100000);

  // 1. Create a test user profile
  const { data: user, error: createErr } = await supabase
    .from('users')
    .insert({
      first_name: 'Original Name',
      username: testUsername,
      telegram_id: tempTgId
    })
    .select()
    .single();

  if (createErr) {
    console.error('❌ Failed to create test user:', createErr);
    process.exit(1);
  }
  console.log('✓ Test user created:', user.id, user.first_name);

  try {
    // 2. Test username availability check
    const { data: takenCheck } = await supabase
      .from('users')
      .select('id')
      .ilike('username', testUsername);

    if (takenCheck.length === 0) {
      throw new Error('Expected username check to find existing username');
    }
    console.log('✓ Username availability check correctly flagged taken username!');

    // 3. Update user profile fields (first_name, username)
    const newUsername = testUsername + '_updated';
    const { data: updatedUser, error: updateErr } = await supabase
      .from('users')
      .update({
        first_name: 'Updated Traveler',
        username: newUsername
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateErr) {
      throw new Error(`Failed to update user profile: ${updateErr.message}`);
    }
    if (updatedUser.first_name !== 'Updated Traveler') {
      throw new Error('Profile update mismatch');
    }
    console.log('✓ Profile fields updated successfully:', updatedUser.first_name);

    // 4. Test Telegram Link Code generation
    const linkCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data: linkUser, error: linkErr } = await supabase
      .from('users')
      .update({
        telegram_link_code: linkCode,
        telegram_link_expires_at: expiresAt
      })
      .eq('id', user.id)
      .select()
      .single();

    if (linkErr || linkUser.telegram_link_code !== linkCode) {
      throw new Error('Failed to set Telegram link code');
    }
    console.log('✓ Telegram link code generated:', linkUser.telegram_link_code);

    // 5. Test Telegram disconnect
    const newTempId = -3000000 - Math.floor(Math.random() * 100000);
    const { data: disconnectedUser, error: discErr } = await supabase
      .from('users')
      .update({
        telegram_id: newTempId,
        telegram_link_code: null,
        telegram_link_expires_at: null
      })
      .eq('id', user.id)
      .select()
      .single();

    if (discErr || disconnectedUser.telegram_id > 0) {
      throw new Error('Failed to disconnect Telegram account');
    }
    console.log('✓ Telegram account disconnected successfully!');

    console.log('✅ ALL USER PROFILE MANAGEMENT CHECKS PASSED!');

  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  } finally {
    // Cleanup
    await supabase.from('users').delete().eq('id', user.id);
    console.log('✓ Cleanup completed.');
  }
}

verifyProfilePageFlow();
