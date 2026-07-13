# Phase 9: RSVP Nudging & Roster Tracking - Research

**Researched:** 2026-07-13
**Domain:** Telegram Poll Updates, asyncio task scheduling, React web components
**Confidence:** HIGH

## Summary

This phase implements automatic background reminders for RSVPs and unvoted polls in group chats, alongside supporting custom RSVP notes/details for participants across both Telegram and the React web app.

For RSVP notes:
- User will run manual SQL migrations to add `notes` to `rsvps` table and `last_rsvp_nudge_at` to `trips` table.
- Bot gets `/rsvp_notes <text>` command updating the notes column for the active user's RSVP. Roster `/roster` lists notes next to names.
- Web app loads `notes` field in `fetchRsvpRoster(tripId)`, renders it in Roster, and provides an input form for the logged-in user to write and save notes to Supabase.

For background reminders:
- A non-blocking `asyncio` loop is spawned in `main.py` post_init hook.
- RSVP reminder loops every N hours, scans database users, queries Telegram's `get_chat_member` to verify active group chat membership, and posts group tags listing un-RSVP'd users.
- Poll reminder uses a `PollAnswerHandler` to capture user votes in real time, storing voter Telegram IDs in `active_polls.voter_ids`.
- The reminder loop monitors active polls. If open > 48 hours and total committed participation < 50%, it nudges outstanding committed voters in the group chat.
- If participation reaches >= 60%, it tags the organizer in the group chat suggesting they lock the poll.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RSVP Notes | Database / Client | Web Frontend | Add notes column to rsvps table; build Telegram command/format; add UI entry/display on Web |
| Background Loop | Bot Server | asyncio | Spawn background loop running periodic checks |
| Poll Voter Tracking | Bot Server | Database | Listen to PollAnswer updates and update active_polls voter_ids |
| Group Nudges | Bot Server | Telegram API | Format and dispatch announcement tags to group chat |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `supabase` | 2.28.3 | Database Client | Primary database client |
| `python-telegram-bot` | 22.7 | Telegram client framework | Bot framework |
| `pytest` | 9.1.1 | Unit testing framework | Testing nudge loops and UI formatting |

## Architecture Patterns

### Pattern 1: Telegram Poll Voter Tracking
When users vote, Telegram sends `PollAnswer` updates. We register a `PollAnswerHandler` to store voter IDs:
```python
async def handle_poll_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    poll_answer = update.poll_answer
    poll_id = poll_answer.poll_id
    tg_user_id = poll_answer.user.id
    selected_options = poll_answer.option_ids  # list of ints
    
    # Query active_polls to see if we track this poll
    active_poll = supabase.table("active_polls").select("*").eq("telegram_poll_id", poll_id).execute()
    if not active_poll.data:
        return
        
    voter_ids = active_poll.data[0].get("voter_ids") or []
    
    if not selected_options:
        # User retracted vote
        if tg_user_id in voter_ids:
            voter_ids.remove(tg_user_id)
    else:
        # User voted/changed vote
        if tg_user_id not in voter_ids:
            voter_ids.append(tg_user_id)
            
    # Update voter_ids array in DB
    supabase.table("active_polls").update({"voter_ids": voter_ids}).eq("telegram_poll_id", poll_id).execute()
```

### Pattern 2: asyncio Non-Blocking Background Loop
Start the nudging check on startup:
```python
async def _background_nudge_loop(bot) -> None:
    while True:
        try:
            await check_and_send_rsvp_nudges(bot)
            await check_and_send_poll_nudges(bot)
        except Exception as e:
            logger.error(f"Error in background nudge loop: {e}")
        await asyncio.sleep(BACKGROUND_CHECK_INTERVAL_SECONDS)
```

## Open Questions

None. All gray areas were resolved in discuss-phase.

## Validation Architecture

### Test Framework
- Framework: `pytest`
- Location: `tests/test_nudges_roster.py`

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| RSVP-01 | Custom RSVP notes (Telegram and Web) | unit | `pytest tests/test_nudges_roster.py -k test_rsvp_notes` |
| RSVP-02 | Background RSVP reminders | unit | `pytest tests/test_nudges_roster.py -k test_rsvp_nudges` |
| RSVP-03 | Background poll vote reminders / organizer majority warnings | unit | `pytest tests/test_nudges_roster.py -k test_poll_nudges` |

## Sources

- Base python-telegram-bot codebase — `main.py`
- React Web App Roster components — `TripDetails.jsx` and `rsvps.js`
