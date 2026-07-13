# Phase 8: Option Pitching & Voting Upgrades - Research

**Researched:** 2026-07-12
**Domain:** Telegram Poll API, ConversationHandler Wizard, Supabase Schema Upgrades
**Confidence:** HIGH

## Summary

This phase upgrades the option pitching and voting systems. Pitching upgrades require adding an optional `description` field to pitched options. Voting upgrades require showing a structured voting tally overview of active polls.

For pitching, we will introduce a new step in the PM wizard to prompt for description and store it in a new `description` column in `poll_options`.
For voting tallies, we will register a new group command `/polls` which reads active polls from `active_polls` and dynamically queries the real-time vote count for each option directly from Telegram's API via `context.bot.get_poll()`. We will match these counts against the original option names saved in `poll_options_json` to display a beautiful, untruncated vote breakdown.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema Migration | Database | — | Add `description` column to `poll_options` table |
| Pitching Wizard Step | Client / Bot | — | Add optional description prompt state to `pm_wizard_handler` |
| Real-time Poll Tallies | Client / Bot | Telegram API | Query native poll state from Telegram API and format structured overview |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `supabase` | 2.28.3 | Database Client | Primary database client |
| `python-telegram-bot` | 22.7 | Telegram client framework | Bot framework |
| `pytest` | 9.1.1 | Unit testing framework | Testing wizard state transitions and message rendering |

## Architecture Patterns

### Recommended Project Structure
```
.planning/phases/08-option-pitching-voting-upgrades/
tests/
└── test_pitch_voting.py
```

### Pattern 1: Telegram Poll Tally Resolving
To get the latest vote count for active polls without storing every vote in our database, we can dynamically fetch the poll status from Telegram:
```python
async def fetch_poll_tallies(bot, telegram_poll_id: str, poll_options_json: list) -> dict[str, int]:
    try:
        poll_obj = await bot.get_poll(telegram_poll_id)
        # Match option indices to their original text
        tallies = {}
        for option in poll_obj.options:
            for opt_meta in poll_options_json:
                # Telegram options match indexes
                if opt_meta["index"] == option.position:
                    tallies[opt_meta["text"]] = option.voter_count
        return tallies
    except Exception as e:
        logger.error(f"Failed to fetch poll from Telegram: {e}")
        return {}
```

### Anti-Patterns to Avoid
- **Hardcoding Description Prompts without Skip Options:** Forcing users to enter description text blocks. Descriptions must remain optional; a `Skip description` button is required.
- **Polling inside a loop:** Do not fetch poll states in a recurring background loop, as this can trigger Telegram API rate limits. Only fetch them dynamically when `/polls` is explicitly called.

## Open Questions

None. All gray areas were resolved in discuss-phase.

## Validation Architecture

### Test Framework
- Framework: `pytest`
- Location: `tests/test_pitch_voting.py`

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| PITCH-01 | Pitching wizard supports links | unit | `pytest tests/test_pitch_voting.py -k test_pitch_wizard_with_links` |
| PITCH-02 | Pitching wizard prompts for description | unit | `pytest tests/test_pitch_voting.py -k test_pitch_wizard_description` |
| PITCH-03 | Displays structured voting tallies | unit | `pytest tests/test_pitch_voting.py -k test_voting_poll_tallies` |

## Sources

### Primary (HIGH confidence)
- Base python-telegram-bot codebase — `main.py`
- Telegram Bot API `getPoll` method specifications
