---
phase: 18
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/App.jsx
  - web/src/views/JoinTrip.jsx
  - web/src/views/VerifyLogin.jsx
  - web/src/views/TripDetails.jsx
  - tests/test_invite_onboarding.py
  - web/verify-invite-flow.cjs
autonomous: true
requirements:
  - INV-01
  - INV-02
user_setup: []
must_haves:
  truths:
    - "Unauthenticated visitor landing on /join/:tripId can register first name to join trip and get redirected"
    - "Unauthenticated visitor landing on /join/:tripId can request magic link, verify, and join trip as Tentative"
    - "Authenticated visitor landing on /join/:tripId is directly added as Tentative and redirected to trip details"
    - "User can copy unique invite link with visual confirmation tooltip/toast fading after 2 seconds"
  artifacts:
    - "web/src/views/JoinTrip.jsx"
    - "tests/test_invite_onboarding.py"
    - "web/verify-invite-flow.cjs"
---

<objective>
Implement shareable web invite links and guest onboarding flows. 
This includes routing `/join/:tripId`, building a dual-path guest registration/magic link view, auto-subscribing joining users to the trip roster as Tentative, persisting target trip IDs in localStorage across login redirects, and clipboard-copy button with temporary toast alerts in the trip dashboard.
</objective>

<execution_context>
@.agents/gsd-core/workflows/execute-plan.md
@.agents/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/18-shareable-web-invite-links-standalone-roster-onboarding/18-CONTEXT.md
@.planning/phases/18-shareable-web-invite-links-standalone-roster-onboarding/18-RESEARCH.md
@.planning/phases/18-shareable-web-invite-links-standalone-roster-onboarding/18-VALIDATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Set up Wave 0 verification scripts and test cases</name>
  <files>tests/test_invite_onboarding.py, web/verify-invite-flow.cjs</files>
  <read_first>.planning/phases/18-shareable-web-invite-links-standalone-roster-onboarding/18-RESEARCH.md</read_first>
  <action>
    Create the stub files for verifying invite joins:
    1. Create `tests/test_invite_onboarding.py` containing basic python unit tests to verify database relationships for RSVPs with 'Tentative' status and mock bot-side display.
    2. Create `web/verify-invite-flow.cjs` containing test routines to verify Supabase connections, RSVP insertions, and user registrations under negative telegram_id parameters.
  </action>
  <verify>
    Run: `.\venv\Scripts\pytest tests/test_invite_onboarding.py` and `node web/verify-invite-flow.cjs`
  </verify>
  <acceptance_criteria>
    - `tests/test_invite_onboarding.py` pytest tests run and pass
    - `web/verify-invite-flow.cjs` execution connects to Supabase and passes basic stub verification
  </acceptance_criteria>
  <done>Wave 0 verification stubs are created and run successfully.</done>
</task>

<task type="auto">
  <name>Task 2: Implement /join/:tripId route and JoinTrip onboarding view</name>
  <files>web/src/App.jsx, web/src/views/JoinTrip.jsx</files>
  <read_first>web/src/App.jsx, web/src/services/rsvps.js, web/src/services/users.js</read_first>
  <action>
    1. Modify `web/src/App.jsx` to import a new component `JoinTrip` from `./views/JoinTrip` and configure the route `<Route path="/join/:tripId" element={<JoinTrip />} />` within the Router layout.
    2. Create `web/src/views/JoinTrip.jsx` implementing the join landing logic:
       - Use `useParams()` to retrieve `tripId`.
       - Check if `activeUser` from `useUserSession` context is signed in.
         - If signed in: call `createRsvp(tripId, activeUser.id, 'Tentative')` (catch if they already have an RSVP record, in which case do nothing) and redirect to `/trips/${tripId}` immediately using `useNavigate`.
         - If NOT signed in: render the dual-option onboarding panel.
       - Implement Onboarding UI panel:
         - Display the trip's destination name (fetch via `supabase` table query for trip details) to contextualize the invitation.
         - **Fast Path Form:** Input field for First Name, and optional Telegram Username. On submission, call `createUser(username, firstName)`, log the user in using `login(newUser)` context, call `createRsvp(tripId, newUser.id, 'Tentative')`, and redirect to `/trips/${tripId}`.
         - **Secure Path Form:** Input field for Email. On submission, call `requestLoginLink(email)`, store `tripId` in `localStorage` under the key `trip_planner_pending_invite_trip_id`, and show a confirmation notification to the user to check their inbox.
  </action>
  <verify>
    Run: `node web/verify-invite-flow.cjs`
  </verify>
  <acceptance_criteria>
    - `/join/:tripId` path is mapped in routing configuration.
    - `JoinTrip.jsx` compiles and renders form components for first name and email.
    - Fast path successfully registers user profile, adds RSVP as 'Tentative', and redirects user to dashboard.
  </acceptance_criteria>
  <done>Join routing and dual-path guest registration components are built and online.</done>
</task>

<task type="auto">
  <name>Task 3: Update VerifyLogin redirect cache interception</name>
  <files>web/src/views/VerifyLogin.jsx</files>
  <read_first>web/src/views/VerifyLogin.jsx, web/src/services/rsvps.js</read_first>
  <action>
    Modify `web/src/views/VerifyLogin.jsx` to intercept cached redirect destinations:
    1. Before redirecting the logged-in user to `/trips`, check if `localStorage.getItem('trip_planner_pending_invite_trip_id')` contains a valid value.
    2. If present, read the value as `pendingTripId`.
    3. Call `createRsvp(pendingTripId, user.id, 'Tentative')` (swallowing duplicate key errors) to add the traveler to the trip roster.
    4. Remove the `trip_planner_pending_invite_trip_id` item from `localStorage`.
    5. Navigate the router to `/trips/${pendingTripId}` instead of `/trips`.
  </action>
  <verify>
    Run: `node web/verify-invite-flow.cjs`
  </verify>
  <acceptance_criteria>
    - Redirect interceptor reads and clears the cached invitation key.
    - Successfully creates an RSVP and redirects magic link logins to the correct trip.
  </acceptance_criteria>
  <done>Login verification flow successfully parses cached invite indicators and redirects users to target trips.</done>
</task>

<task type="auto">
  <name>Task 4: Add Clipboard-Copy controls and toast notification in TripDetails</name>
  <files>web/src/views/TripDetails.jsx</files>
  <read_first>web/src/views/TripDetails.jsx</read_first>
  <action>
    Modify `web/src/views/TripDetails.jsx` to add shareable links controls:
    1. Add a "Copy Invite Link" action button near the trip header or details layout.
    2. Add click handler that copies the link URL (`window.location.origin + '/join/' + id`) to the clipboard using `navigator.clipboard.writeText`.
    3. Implement a clean floating toast notification or inline tooltip component near the action button that displays "Invite link copied to clipboard!" upon successful copy.
    4. Use a `setTimeout` of 2000ms to fade out or dismiss the notification automatically.
  </action>
  <verify>
    Run: `.\venv\Scripts\pytest` and confirm all tests compile and pass
  </verify>
  <acceptance_criteria>
    - "Copy Invite Link" button is visible and active on the trip details screen.
    - Tooltip/Toast renders on copy click and auto-fades after 2 seconds.
  </acceptance_criteria>
  <done>Clipboard copying interface and animated notifications are integrated in Trip Details.</done>
</task>

</tasks>

<must_haves>
  truths:
    - "Unauthenticated visitor landing on /join/:tripId can register first name to join trip and get redirected"
    - "Unauthenticated visitor landing on /join/:tripId can request magic link, verify, and join trip as Tentative"
    - "Authenticated visitor landing on /join/:tripId is directly added as Tentative and redirected to trip details"
    - "User can copy unique invite link with visual confirmation tooltip/toast fading after 2 seconds"
  prohibitions: []
</must_haves>

**Artifacts this phase produces:**
- `web/src/views/JoinTrip.jsx`
- `tests/test_invite_onboarding.py`
- `web/verify-invite-flow.cjs`
