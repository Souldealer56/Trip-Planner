---
phase: 26
plan: 1
title: Webapp Option Voting Integration & Real-time Sync Implementation
wave: 1
depends_on: []
files_modified:
  - web/src/services/options.js
  - web/src/views/TripDetails.jsx
  - web/verify-options-voting.cjs
autonomous: true
requirements:
  - VOTE-01
  - VOTE-02
  - VOTE-03
  - SYNC-02
---

# Plan 26-1: Webapp Option Voting Integration & Real-time Sync Implementation

## Goal

Integrate complete option voting into the web app UI—including casting and retracting votes, stacked voter badges, a Poll Breakdown & Voter Recap modal, option locking controls for trip creators, and database synchronization between Telegram bot polls and the web app.

---

## Task 1: Enhance `web/src/services/options.js` with Option Locking & Vote Helpers

<read_first>
- `web/src/services/options.js`
- `web/src/services/supabase.js`
- `.planning/phases/26-webapp-option-voting-integration-real-time-sync/26-CONTEXT.md`
</read_first>

<action>
1. In `web/src/services/options.js`, add `lockOption(tripId, category, optionId, userId)`:
   - Fetches active poll for `tripId` and `category`.
   - Updates `active_polls` row setting `locked_option_id: optionId` (or toggles `null` if unlocking).
   - Also updates `poll_options` setting `is_locked: true` for `optionId` if column exists, or sets `locked_option_id` in `active_polls`.
   - Inserts an `activity_log` entry recording `lock_option` with description `${userName} locked option choice in ${category}`.
2. Verify `toggleVote(tripId, category, optionId, userId, cast)` updates `voter_selections` and `votes_by_option` cleanly and returns the updated `active_polls` record.
</action>

<acceptance_criteria>
- `web/src/services/options.js` exports `lockOption`.
- `lockOption` updates `active_polls` `locked_option_id` and logs activity.
- `toggleVote` correctly increments/decrements votes and updates JSONB columns.
</acceptance_criteria>

---

## Task 2: Implement Voter Badges, Poll Recap Modal & Lock Option Controls in `TripDetails.jsx`

<read_first>
- `web/src/views/TripDetails.jsx`
- `web/src/services/options.js`
- `.planning/phases/26-webapp-option-voting-integration-real-time-sync/26-CONTEXT.md`
</read_first>

<action>
1. In `web/src/views/TripDetails.jsx`:
   - On each option card:
     - Map `activePoll.voter_selections` to extract users who voted for that option.
     - Display a stacked voter badges container showing small avatar chips/first-names for voters.
     - If the option is locked (`activePoll?.locked_option_id === opt.id` or `opt.is_locked`), render a `🏆 Locked Choice` badge.
     - Provide a "Lock Choice" / "Unlock" button for trip creator/organizer profiles.
   - Poll Breakdown & Voter Recap Modal:
     - Add state `const [showPollRecapModal, setShowPollRecapModal] = useState(false)`.
     - Add button / click target on voter badges to set `showPollRecapModal(true)`.
     - Modal renders a detailed breakdown of all options in `activeTab`, total votes cast, percentage per option, and the names of all voters for each option.
   - Sync & Refresh:
     - Add a "Refresh Votes" button next to "🗳️ Pitched Options" that triggers `loadOptionsAndPoll()`.
</action>

<acceptance_criteria>
- Option cards render stacked voter badges for travelers who voted on that option.
- Clicking the voter stack or recap button opens the "Poll Breakdown & Voter Recap" modal listing options and voter names.
- Locked options display a `🏆 Locked Choice` badge.
- Clicking "Refresh Votes" re-fetches options and poll tallies from Supabase.
</acceptance_criteria>

---

## Task 3: Automated Option Voting & Sync Verification Script

<read_first>
- `web/verify-options-service.cjs`
- `web/src/services/options.js`
</read_first>

<action>
1. Create `web/verify-options-voting.cjs`:
   - Read `.env` using custom fs/path parser.
   - Connect to Supabase via `@supabase/supabase-js`.
   - Query test trip and two test users.
   - Call `toggleVote` for User 1 on a test option and assert vote cast.
   - Call `toggleVote` for User 2 on the same option and assert tally equals 2 and both user IDs are present in `voter_selections`.
   - Test `lockOption` function and assert `locked_option_id` is updated in `active_polls`.
   - Call `toggleVote` to retract vote for User 1 and assert tally equals 1.
   - Clean up test votes and unlock poll.
   - Output `✓ Option voting integration and real-time sync verified successfully.`
2. Execute script via Node.js to verify pass.
</action>

<acceptance_criteria>
- `web/verify-options-voting.cjs` executes cleanly via `node web/verify-options-voting.cjs` with exit code 0.
- Output includes `✓ Option voting integration and real-time sync verified successfully.`
</acceptance_criteria>

---

## Verification Plan

### Automated Tests
- Run `node web/verify-options-voting.cjs`
- Run `node web/verify-options-service.cjs`

### Manual Verification
- Open trip details in web UI, view option cards, toggle votes, verify voter badges update, click voter stack to inspect the Poll Recap modal, and test locking a choice.

---

## Artifacts This Phase Produces

- `web/src/services/options.js` (added `lockOption`)
- `web/src/views/TripDetails.jsx` (added voter badges stack, Poll Recap modal, Lock Choice button, Refresh Votes button)
- `web/verify-options-voting.cjs` (new verification test script)
