# Phase 19: Hybrid Bot-Web Coexistence - Research

## 1. Existing System Analysis

### Bot User Registration & Identification
In the Telegram bot (`main.py`), users are registered in two primary handlers:
- **`/start`** (lines 654–664):
  ```python
  if not tg_user.is_bot:
      user_data = {
          "telegram_id": tg_user.id,
          "username": tg_user.username,
          "first_name": tg_user.first_name,
      }
      try:
          supabase.table("users").upsert(user_data, on_conflict="telegram_id").execute()
      except Exception:
          pass
  ```
- **`handle_rsvp` callback** (lines 1166–1182):
  ```python
  user_data = {
      "telegram_id": query.from_user.id,
      "username": query.from_user.username,
      "first_name": query.from_user.first_name,
  }
  try:
      user_response = (
          supabase.table("users")
          .upsert(user_data, on_conflict="telegram_id")
          .execute()
      )
      db_user_id = user_response.data[0]["id"]
  ...
  ```

If a guest registers on the webapp (`JoinTrip.jsx`) using Fast Path (First Name and Username), they are assigned a negative `telegram_id` (e.g., `-1589410`) to prevent primary key collision.

**Issue/Gap**: If they later start the bot or click RSVP in a group, the bot will see that their positive `telegram_id` does not exist in the database and create a brand new profile record, resulting in a duplicate traveler profile and disconnected history.

### Webapp Roster & Ledger Rendering
In `web/src/views/TripDetails.jsx`, roster participants and expense splits are retrieved via RSVPs and displayed directly using:
- `member.users?.first_name` and `member.users?.username`

Currently, there are no visual indicators showing whether a participant is email-only or has active Telegram linking.

---

## 2. Proposed Changes

### Bot Side: Auto-Linking Helper (`main.py`)
Introduce a new async helper `_get_or_link_user(tg_user: User) -> str` to handle user registration and linking:
1. Lookup by `telegram_id == tg_user.id`. If found, return internal UUID.
2. If not found, lookup by `username` case-insensitively using `.ilike("username", tg_user.username)`.
3. If a matching username record is found (with a negative `telegram_id` created on the web), update the existing record:
   - Set `telegram_id` to the user's positive `tg_user.id`.
   - Update first name and username.
   - Return the user UUID.
4. If no match is found, insert a new record and return the user UUID.

Update `start` and `handle_rsvp` to call `_get_or_link_user`.

### Web Client: Subtle Badges (`TripDetails.jsx`)
In the Roster Participant list card in `TripDetails.jsx`, render:
- A `✈️ Telegram` badge if `telegram_id > 0`.
- An `✉️ Email` badge if `telegram_id < 0`.

---

## 3. Verification Plan

### Automated Pytest Checks
Create `tests/test_hybrid_coexistence.py` to verify:
- `_get_or_link_user` successfully links an existing username-only record by updating its `telegram_id` case-insensitively.

### Node Database Integration Checks
Create `web/verify-hybrid-coexistence.cjs` to verify that when a user is created with a negative telegram ID and username, querying by that username case-insensitively returns the record.
