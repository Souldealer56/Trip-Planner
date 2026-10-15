import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requestLoginLink, verifyLoginToken, loginOrRegisterByEmail } from '../services/auth'
import { createUser } from '../services/users'
import { supabase } from '../services/supabase'

vi.mock('../services/supabase', () => {
  return {
    supabase: {
      from: vi.fn()
    }
  }
})

describe('Auth Service — Schema-Resilient Magic Links & Passwordless Login', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('requestLoginLink', () => {
    it('throws an error for missing or invalid email format', async () => {
      await expect(requestLoginLink('')).rejects.toThrow('Please enter a valid email address.')
      await expect(requestLoginLink('invalid-email')).rejects.toThrow('Please enter a valid email address.')
      await expect(requestLoginLink(null)).rejects.toThrow('Please enter a valid email address.')
    })

    it('stores token in localStorage and succeeds when public.login_tokens is missing (PGRST205)', async () => {
      const email = 'traveler@example.com'

      // Simulate Supabase returning PGRST205 (table missing from schema cache)
      const mockInsert = vi.fn().mockResolvedValue({
        error: {
          code: 'PGRST205',
          message: "Could not find the table 'public.login_tokens' in the schema cache"
        }
      })
      supabase.from.mockReturnValue({
        insert: mockInsert
      })

      const token = await requestLoginLink(email)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(mockInsert).toHaveBeenCalledTimes(1)
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'traveler@example.com',
          token,
          used: false
        })
      )

      // Verify token was stored in localStorage pending tokens
      const pendingRaw = localStorage.getItem('trip_planner_pending_tokens')
      expect(pendingRaw).toBeTruthy()
      const pendingTokens = JSON.parse(pendingRaw)
      expect(pendingTokens[token]).toBeDefined()
      expect(pendingTokens[token].email).toBe('traveler@example.com')
      expect(pendingTokens[token].used).toBe(false)
    })

    it('stores token in localStorage and succeeds when DB returns 42P01 table missing', async () => {
      const email = 'wanderer@example.com'

      supabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: {
            code: '42P01',
            message: 'relation "public.login_tokens" does not exist'
          }
        })
      })

      const token = await requestLoginLink(email)
      expect(token).toBeDefined()

      const pendingTokens = JSON.parse(localStorage.getItem('trip_planner_pending_tokens'))
      expect(pendingTokens[token].email).toBe('wanderer@example.com')
    })

    it('stores token and succeeds when DB insert succeeds normally', async () => {
      const email = 'happy@example.com'

      supabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      })

      const token = await requestLoginLink(email)
      expect(token).toBeDefined()

      const pendingTokens = JSON.parse(localStorage.getItem('trip_planner_pending_tokens'))
      expect(pendingTokens[token].email).toBe('happy@example.com')
    })
  })

  describe('verifyLoginToken', () => {
    it('throws if no token is provided', async () => {
      await expect(verifyLoginToken('')).rejects.toThrow('No token provided.')
      await expect(verifyLoginToken(null)).rejects.toThrow('No token provided.')
    })

    it('authenticates existing user using local fallback token when public.login_tokens is missing (PGRST205)', async () => {
      const email = 'existing.traveler@example.com'
      const token = 'test-token-uuid-123'
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

      // Set pending token in localStorage
      localStorage.setItem('trip_planner_pending_tokens', JSON.stringify({
        [token]: {
          email,
          token,
          expires_at: expiresAt,
          used: false
        }
      }))

      const existingUser = {
        id: 'user-uuid-1',
        email,
        first_name: 'Existing',
        username: 'existing'
      }

      // Mock Supabase calls:
      // 1. from('login_tokens') -> throws PGRST205
      // 2. from('users').select('*').ilike('email', email).maybeSingle() -> returns existing user
      supabase.from.mockImplementation((table) => {
        if (table === 'login_tokens') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: {
                    code: 'PGRST205',
                    message: "Could not find the table 'public.login_tokens' in the schema cache"
                  }
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          }
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: existingUser,
                  error: null
                })
              })
            })
          }
        }
        return {}
      })

      const user = await verifyLoginToken(token)

      expect(user).toEqual(existingUser)

      // Verify token in localStorage is marked as used
      const pendingTokens = JSON.parse(localStorage.getItem('trip_planner_pending_tokens'))
      expect(pendingTokens[token].used).toBe(true)
    })

    it('creates new user with clean web schema (no telegram_id) when public.login_tokens is missing', async () => {
      const email = 'new.traveler@example.com'
      const token = 'test-token-uuid-456'
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

      localStorage.setItem('trip_planner_pending_tokens', JSON.stringify({
        [token]: {
          email,
          token,
          expires_at: expiresAt,
          used: false
        }
      }))

      const createdUser = {
        id: 'new-user-uuid-99',
        email,
        first_name: 'New',
        username: 'newtraveler'
      }

      let insertedPayload = null

      supabase.from.mockImplementation((table) => {
        if (table === 'login_tokens') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST205' }
                })
              })
            })
          }
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            }),
            insert: vi.fn((payload) => {
              insertedPayload = payload
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: createdUser,
                    error: null
                  })
                })
              }
            })
          }
        }
        return {}
      })

      const user = await verifyLoginToken(token)

      expect(user).toEqual(createdUser)
      // Check that insert did not include telegram_id
      expect(insertedPayload.email).toBe(email)
      expect(insertedPayload.telegram_id).toBeUndefined()
    })

    it('falls back to inserting negative telegram_id if legacy schema NOT NULL constraint triggers', async () => {
      const email = 'legacy.user@example.com'
      const token = 'test-token-uuid-789'
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

      localStorage.setItem('trip_planner_pending_tokens', JSON.stringify({
        [token]: {
          email,
          token,
          expires_at: expiresAt,
          used: false
        }
      }))

      let insertCalls = 0
      const legacyCreatedUser = {
        id: 'legacy-user-1',
        email,
        first_name: 'Legacy',
        username: 'legacyuser',
        telegram_id: -123456789
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'login_tokens') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          }
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            }),
            insert: vi.fn((payload) => {
              insertCalls++
              if (insertCalls === 1) {
                // First insert without telegram_id fails with NOT NULL constraint error
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'null value in column "telegram_id" of relation "users" violates not-null constraint' }
                    })
                  })
                }
              }
              // Second insert with telegram_id succeeds
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { ...legacyCreatedUser, telegram_id: payload.telegram_id },
                    error: null
                  })
                })
              }
            })
          }
        }
        return {}
      })

      const user = await verifyLoginToken(token)

      expect(insertCalls).toBe(2)
      expect(user.email).toBe(email)
      expect(user.telegram_id).toBeLessThan(0)
    })

    it('rejects a token that is marked as used', async () => {
      const token = 'used-token-uuid'
      localStorage.setItem('trip_planner_pending_tokens', JSON.stringify({
        [token]: {
          email: 'used@example.com',
          token,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          used: true
        }
      }))

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      })

      await expect(verifyLoginToken(token)).rejects.toThrow('This magic link has already been used.')
    })

    it('rejects an expired token', async () => {
      const token = 'expired-token-uuid'
      localStorage.setItem('trip_planner_pending_tokens', JSON.stringify({
        [token]: {
          email: 'expired@example.com',
          token,
          expires_at: new Date(Date.now() - 60 * 1000).toISOString(), // 1 minute in the past
          used: false
        }
      }))

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      })

      await expect(verifyLoginToken(token)).rejects.toThrow('This magic link has expired.')
    })

    it('supports base64url encoded email tokens for cross-tab or cross-context links', async () => {
      const email = 'crosstab@example.com'
      const base64Token = Buffer.from(email).toString('base64url')

      const existingUser = {
        id: 'cross-tab-user',
        email,
        first_name: 'Crosstab'
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'login_tokens') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          }
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: existingUser, error: null })
              })
            })
          }
        }
        return {}
      })

      const user = await verifyLoginToken(base64Token)
      expect(user).toEqual(existingUser)
    })
  })

  describe('loginOrRegisterByEmail', () => {
    it('validates email parameter', async () => {
      await expect(loginOrRegisterByEmail('')).rejects.toThrow('Please enter a valid email address.')
      await expect(loginOrRegisterByEmail('not-an-email')).rejects.toThrow('Please enter a valid email address.')
    })

    it('returns existing user if already in public.users', async () => {
      const existing = {
        id: 'u-1',
        email: 'found@example.com',
        first_name: 'Found'
      }

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null })
          })
        })
      })

      const user = await loginOrRegisterByEmail('found@example.com')
      expect(user).toEqual(existing)
    })

    it('creates new user if not found in public.users', async () => {
      const created = {
        id: 'u-2',
        email: 'brandnew@example.com',
        first_name: 'Brandnew'
      }

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: created, error: null })
          })
        })
      })

      const user = await loginOrRegisterByEmail('brandnew@example.com', 'Brandnew')
      expect(user).toEqual(created)
    })
  })

  describe('createUser in users.js', () => {
    it('inserts clean user without telegram_id first', async () => {
      const newUser = {
        id: 'u-3',
        username: 'alice',
        first_name: 'Alice',
        email: 'alice@example.com'
      }

      let payloadUsed = null
      supabase.from.mockReturnValue({
        insert: vi.fn((p) => {
          payloadUsed = p
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: newUser, error: null })
            })
          }
        })
      })

      const res = await createUser('alice', 'Alice', 'alice@example.com')
      expect(res).toEqual(newUser)
      expect(payloadUsed.telegram_id).toBeUndefined()
      expect(payloadUsed.email).toBe('alice@example.com')
    })

    it('retries with negative telegram_id on legacy schema constraint', async () => {
      let callCount = 0
      supabase.from.mockReturnValue({
        insert: vi.fn((p) => {
          callCount++
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'null value in column "telegram_id" violates not-null constraint' }
                })
              })
            }
          }
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'u-4', ...p },
                error: null
              })
            })
          }
        })
      })

      const res = await createUser('bob', 'Bob')
      expect(callCount).toBe(2)
      expect(res.telegram_id).toBeLessThan(0)
    })
  })
})
