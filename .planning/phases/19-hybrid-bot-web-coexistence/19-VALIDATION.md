# Phase 19: Hybrid Bot-Web Coexistence - Validation Plan

This document outlines the testing strategy and validation routines to confirm successful implementation of hybrid bot-web coexistence.

---

## 1. Automated Test Cases (Python)

### Test Case: `test_username_auto_linking`
- **Setup**: Create a user profile with a negative telegram ID and username `guestTraveler`.
- **Action**: Call `_get_or_link_user` with a mock Telegram user having `telegram_id = 998877` and `username = "guesttraveler"` (different casing).
- **Assertions**:
  - The returned database UUID matches the original profile's UUID.
  - The database record's `telegram_id` has been updated from negative to `998877`.
  - No duplicate profile is created.

---

## 2. Integration Verification Scripts (Node.js)

### Script: `web/verify-hybrid-coexistence.cjs`
- **Step 1**: Connects to the Supabase instance using `.env` variables.
- **Step 2**: Inserts a temporary user with a negative telegram ID and username `CoexistTest`.
- **Step 3**: Queries the user record case-insensitively using `.ilike('username', 'coexisttest')`.
- **Step 4**: Verifies that the record matches and retrieves it.
- **Step 5**: Cleans up the test records.

---

## 3. Manual Verification Steps

### Step 1: Web Roster Badges
- Open the web app and view the RSVP roster.
- Confirm that users with connected Telegram accounts display a blue `✈️ Telegram` badge.
- Confirm that users who registered via Email display a green `✉️ Email` badge.

### Step 2: Auto-linking from Telegram
- Register a user via the Web Invite onboarding view (`/join/:tripId`) with first name `TestLink` and username `my_test_link_name`.
- In Telegram, message the bot using an account with username `@my_test_link_name`.
- Verify the bot links the profile, and when checking the web Roster, the user `TestLink` now displays a `✈️ Telegram` badge instead of `✉️ Email`.
