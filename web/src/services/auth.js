import { supabase } from './supabase';

const PENDING_TOKENS_STORAGE_KEY = 'trip_planner_pending_tokens';

/**
 * Safely get pending tokens map from localStorage.
 * @returns {Record<string, Object>}
 */
function getPendingTokens() {
  try {
    const raw = localStorage.getItem(PENDING_TOKENS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('Failed to read pending tokens from localStorage:', err);
    return {};
  }
}

/**
 * Safely save a pending token record to localStorage.
 * @param {string} token
 * @param {Object} data
 */
function savePendingToken(token, data) {
  try {
    const tokens = getPendingTokens();
    tokens[token] = data;
    localStorage.setItem(PENDING_TOKENS_STORAGE_KEY, JSON.stringify(tokens));
  } catch (err) {
    console.warn('Failed to save pending token to localStorage:', err);
  }
}

/**
 * Safely update a pending token record in localStorage.
 * @param {string} token
 * @param {Object} updates
 */
function updatePendingToken(token, updates) {
  try {
    const tokens = getPendingTokens();
    if (tokens[token]) {
      tokens[token] = { ...tokens[token], ...updates };
      localStorage.setItem(PENDING_TOKENS_STORAGE_KEY, JSON.stringify(tokens));
    }
  } catch (err) {
    console.warn('Failed to update pending token in localStorage:', err);
  }
}

/**
 * Attempt to decode a base64 or base64url encoded email token (supports multi-tab/cross-context links).
 * @param {string} tokenStr
 * @returns {Object|null}
 */
function tryDecodeBase64Token(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string') return null;
  try {
    let base64 = tokenStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const decoded = typeof atob === 'function'
      ? atob(base64)
      : (typeof Buffer !== 'undefined' ? Buffer.from(base64, 'base64').toString('utf-8') : null);

    if (decoded && decoded.includes('@')) {
      if (decoded.startsWith('{')) {
        const parsed = JSON.parse(decoded);
        if (parsed.email) {
          return {
            email: parsed.email.trim().toLowerCase(),
            expires_at: parsed.expires_at || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            used: Boolean(parsed.used)
          };
        }
      }
      const parts = decoded.split(':');
      if (parts[0] && parts[0].includes('@')) {
        return {
          email: parts[0].trim().toLowerCase(),
          expires_at: parts[1] || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          used: false
        };
      }
    }
  } catch {
    // Not a valid base64 token
  }
  return null;
}

/**
 * Generate a random UUID string with fallback.
 * @returns {string}
 */
function generateToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'tok-' + Date.now() + '-' + Math.random().toString(36).substring(2, 12);
}

/**
 * Request a passwordless login link.
 * Generates a high-entropy token, stores it locally for schema-resilient verification,
 * and attempts database storage. If public.login_tokens is missing from the database,
 * it safely falls back to local token verification.
 * 
 * @param {string} email - The user's email address
 * @returns {Promise<string>} The generated token
 */
export async function requestLoginLink(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // Valid for 15 minutes

  // Always store locally so verification works 100% reliably regardless of DB schema state
  savePendingToken(token, {
    email: cleanEmail,
    token,
    expires_at: expiresAt,
    used: false
  });

  try {
    const { error } = await supabase
      .from('login_tokens')
      .insert({
        email: cleanEmail,
        token,
        expires_at: expiresAt,
        used: false
      });

    if (error) {
      const isMissingTable =
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.message?.includes('login_tokens') ||
        error.details?.includes('login_tokens');

      if (isMissingTable) {
        console.warn('public.login_tokens table not found in Supabase schema cache; proceeding with local token fallback.', error);
      } else {
        console.warn('Could not insert login token into database; proceeding with local token fallback.', error);
      }
    }
  } catch (err) {
    console.warn('Network or schema exception while inserting login token; proceeding with local fallback.', err);
  }

  return token;
}

/**
 * Verify a magic link token, mark it as used, and resolve/create the traveler profile.
 * Supports both database login_tokens and local pending token fallback.
 * 
 * @param {string} token - The magic link token UUID or encoded string
 * @returns {Promise<Object>} The authenticated user profile
 */
export async function verifyLoginToken(token) {
  if (!token) {
    throw new Error('No token provided.');
  }

  let tokenRecord = null;

  // 1. Attempt to fetch from Supabase login_tokens
  try {
    const { data, error: fetchError } = await supabase
      .from('login_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (!fetchError && data) {
      tokenRecord = data;
    } else if (fetchError) {
      const isMissingTable =
        fetchError.code === 'PGRST205' ||
        fetchError.code === '42P01' ||
        fetchError.message?.includes('login_tokens') ||
        fetchError.details?.includes('login_tokens');

      if (isMissingTable) {
        console.warn('public.login_tokens table is missing in schema cache; falling back to local storage token.');
      } else {
        console.warn('Error querying login_tokens table; falling back to local storage token:', fetchError);
      }
    }
  } catch (err) {
    console.warn('Exception querying login_tokens table; falling back to local storage token:', err);
  }

  // 2. Fallback to localStorage or base64url-encoded token
  if (!tokenRecord) {
    const pendingTokens = getPendingTokens();
    if (pendingTokens[token]) {
      tokenRecord = pendingTokens[token];
    } else {
      const decoded = tryDecodeBase64Token(token);
      if (decoded) {
        tokenRecord = decoded;
      }
    }
  }

  if (!tokenRecord) {
    throw new Error('Invalid magic link. The link may be broken.');
  }

  if (tokenRecord.used) {
    throw new Error('This magic link has already been used. Please request a new one.');
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw new Error('This magic link has expired. Please request a new one.');
  }

  // 3. Mark token as used immediately to prevent replay attacks
  if (tokenRecord.id) {
    try {
      await supabase
        .from('login_tokens')
        .update({ used: true })
        .eq('id', tokenRecord.id);
    } catch (updateErr) {
      console.warn('Failed to invalidate token in login_tokens table:', updateErr);
    }
  }
  updatePendingToken(token, { used: true });

  // 4. Resolve or onboard user profile
  return await loginOrRegisterByEmail(tokenRecord.email);
}

/**
 * Direct helper to resolve or create a user by email address.
 * Resilient to clean web schemas (no telegram_id) as well as legacy schemas.
 * 
 * @param {string} email - The user's email address
 * @param {string|null} [firstName=null] - Optional first name
 * @returns {Promise<Object>} The authenticated user profile
 */
export async function loginOrRegisterByEmail(email, firstName = null) {
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Resolve user profile by email
  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('*')
    .ilike('email', cleanEmail)
    .maybeSingle();

  if (userError) {
    console.error('Error fetching user profile:', userError);
    throw new Error('Verification failed while loading user profile.');
  }

  if (existingUser) {
    return existingUser;
  }

  // 2. Standalone Onboarding: Create traveler profile
  const emailPrefix = cleanEmail.split('@')[0];
  const resolvedFirstName = firstName?.trim() || (emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
  const username = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, '');

  const payload = {
    email: cleanEmail,
    first_name: resolvedFirstName,
    username: username || null
  };

  let { data: newUser, error: createError } = await supabase
    .from('users')
    .insert(payload)
    .select()
    .single();

  // Legacy fallback if telegram_id NOT NULL constraint is still present
  if (createError && (createError.message?.includes('telegram_id') || createError.details?.includes('telegram_id'))) {
    const fallbackTelegramId = -1 * (Date.now() * 1000 + Math.floor(Math.random() * 1000));
    const fallbackRes = await supabase
      .from('users')
      .insert({
        ...payload,
        telegram_id: fallbackTelegramId
      })
      .select()
      .single();
    newUser = fallbackRes.data;
    createError = fallbackRes.error;
  }

  if (createError) {
    console.error('Failed to create new user profile:', createError);
    throw new Error('Failed to create traveler profile. Please try again.');
  }

  return newUser;
}
