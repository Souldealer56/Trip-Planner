const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://obilxzpljuphlkkchnam.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iaWx4enBsanVwaGxra2NobmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA3MDk3NTUsImV4cCI6MjAzNjI4NTc1NX0.2bL1L9x-d3bM67z6j55345';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreateUser() {
  const testEmail = 'alex_' + Date.now() + '@example.com';
  const tempTelegramId = -1 * (Date.now() * 100 + Math.floor(Math.random() * 100));
  const emailPrefix = testEmail.split('@')[0];
  const firstName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  const username = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, '');

  console.log('Testing user insert:', { testEmail, tempTelegramId, firstName, username });

  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({
      email: testEmail,
      telegram_id: tempTelegramId,
      first_name: firstName,
      username: username || null
    })
    .select()
    .single();

  if (createError) {
    console.error('Create error:', createError);
  } else {
    console.log('Successfully created user:', newUser);
    // cleanup
    await supabase.from('users').delete().eq('id', newUser.id);
  }
}

testCreateUser();
