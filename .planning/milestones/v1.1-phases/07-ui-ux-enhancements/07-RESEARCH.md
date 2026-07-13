# Phase 7: UI & UX Enhancements - Research

**Researched:** 2026-07-12
**Domain:** Telegram Bot UI/UX Formatting, HTML Parse Mode, Emojis Consistency
**Confidence:** HIGH

## Summary

This phase focuses on enhancing the UI/UX consistency and premium presentation of the Telegram bot's replies. Python-telegram-bot supports HTML parse mode which allows rich formatting options like bold (`<b>`), italic (`<i>`), code (`<code>`), and underline (`<u>`). 

Currently, formatting styles and emojis are scattered: `/roster` uses dashes `-` for lists, `/ledger` uses bullet points `•` and bold names in list items but unbolded in total person paid, and category emojis are handled via a local dictionary `CATEGORY_EMOJI` that is incomplete and doesn't map all categories.

We will centralize all UI emojis and format elements into standard mappings. We will also align list elements (using `•` for itemized bullet lists and bold text for subjects/names) and success/warning notification messages (using a uniform bold-header style: `✅ <b>[Header]!</b>\n[Details]`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Emoji Mapping & Registry | Client / Bot | — | Centralized dictionary defining all standard emojis for categories and commands |
| Roster & Reports Formatting | Client / Bot | — | Harmonized HTML list outputs for `/roster`, `/budget`, `/ledger`, and `/itinerary` |
| Alert UI Templates | Client / Bot | — | Standardized templates formatting success notifications, warnings, and error messages |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `python-telegram-bot` | 22.7 | Telegram client framework | Underlying bot event loop and command handler framework |
| `pytest` | 9.1.1 | Unit testing framework | Testing message outputs and parsing logic |

## Architecture Patterns

### Recommended Project Structure
```
.planning/phases/07-ui-ux-enhancements/
tests/
└── test_ui_ux.py
```

### Pattern 1: Centralized Emoji Registry
We define a global centralized dictionary in `main.py` containing standard category emojis, command headers, and status markers:
```python
_UX_EMOJIS = {
    # Categories
    "accommodation": "🏠",
    "flights": "✈️",
    "flight": "✈️",
    "activities": "🎟️",
    "activity": "🎟️",
    "food": "🍴",
    "transport": "🚗",
    "transportation": "🚗",
    "other": "✨",
    
    # Modules / Headers
    "roster": "📋",
    "budget": "📊",
    "ledger": "🧾",
    "itinerary": "📅",
    
    # Status Indicators
    "success": "✅",
    "warning": "⚠️",
    "info": "ℹ️"
}
```

### Anti-Patterns to Avoid
- **Hardcoding Emojis in Handlers:** Writing ad-hoc emojis inside handlers. If we decide to tweak a category emoji, we must update it in 10 different places. Use the registry.
- **Mix of Bullets and Hyphens:** Having `/roster` use `-` while `/ledger` uses `•` creates a disjointed experience. Standardize list items to `•`.
- **Parsing Mode Failures:** Neglecting to register `parse_mode="HTML"` or failing to properly escape HTML special characters (`<`, `>`, `&`) in user inputs, causing Telegram API `BadRequest` errors.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Local `CATEGORY_EMOJI` dictionary | Global `_UX_EMOJIS` registry dictionary | Phase 7 | Unified visuals across all options, itinerary, and ledger outputs |
| Ad-hoc bulleting/bolding styles | Structured list formatting | Phase 7 | Cohesive visual layout and easy scanning |

## Open Questions

1. **How should we escape HTML symbols in names and descriptions?**
   - Recommendation: Use a helper function `_escape_html(text: str)` or standard python replacement `text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')` before inserting text into HTML strings to prevent parsing exceptions.

## Validation Architecture

### Test Framework
- Framework: `pytest`
- Location: `tests/test_ui_ux.py`

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| UX-01 | Uniform HTML formatting layouts | unit | `pytest tests/test_ui_ux.py -k test_roster_formatting` |
| UX-02 | Consistent emojis and centralized dictionary | unit | `pytest tests/test_ui_ux.py -k test_emoji_consistency` |

## Sources

### Primary (HIGH confidence)
- Base python-telegram-bot codebase — `main.py`
- Telegram Bot API MarkdownV2 / HTML formatting limits

## Metadata

**Research date:** 2026-07-12
**Valid until:** 2026-08-12
