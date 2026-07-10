# Testing Patterns

**Analysis Date:** 2026-07-10

## Test Framework

**Runner:**
- **None Configured:** The codebase currently has no test runner or unit testing framework set up.

**Assertion Library:**
- **None Configured:** No assertion libraries are in use.

**Run Commands:**
- No test suite scripts exist.

## Test File Organization

- No test files or test directories (`tests/`, `test_*.py`, `*_test.py`) are present in the repository root. All logic is verified manually by running the bot.

## Recommended Testing Architecture (Future Implementation)

If testing is introduced, the following framework is recommended:

**1. Test Runner:**
- `pytest` for handling async tests and fixtures.

**2. Mocking Integrations:**
- `unittest.mock` or `pytest-mock` to stub/mock Telegram Bot context, updates, and messages.
- Stubs/mocks for the Supabase Postgres client (`postgrest` / `Client`) responses to bypass database hits during unit tests.
- Mocking exchange rate HTTP calls (`urlopen` responses).

---

*Testing patterns analysis: 2026-07-10*
*Update when test frameworks are configured*
