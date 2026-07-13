import os
import re
import html
import json
import asyncio
import logging
from urllib.request import urlopen
from urllib.error import URLError
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client, Client
from telegram import (
    Update,
    ReplyKeyboardRemove,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    BotCommand,
    BotCommandScopeAllPrivateChats,
    BotCommandScopeAllGroupChats,
    BotCommandScopeChatMember,
)
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ConversationHandler,
    ContextTypes,
    CallbackQueryHandler,
    PollAnswerHandler,
)

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

load_dotenv()
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# ---------------------------------------------------------------------------
# UI & UX Formatting Central Registry
# ---------------------------------------------------------------------------

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

def _escape(text: str) -> str:
    """
    Safely escapes HTML special characters to prevent Telegram API parsing exceptions.
    """
    if not text:
        return ""
    return html.escape(text)

# ---------------------------------------------------------------------------
# Error Resilience & DB Hardening Helpers
# ---------------------------------------------------------------------------

async def _safe_db_call(query_fn, fallback=None):
    """
    Executes a Supabase query synchronously in a thread pool using asyncio.to_thread,
    performing up to 3 retry attempts with exponential backoff on transient errors.
    """
    attempts = 3
    delay = 1.0
    backoff_multiplier = 2.0

    for attempt in range(attempts):
        try:
            # Delegate blocking sync database call to thread pool
            result = await asyncio.to_thread(query_fn)
            return result
        except Exception as e:
            logger.error(f"Database query failed on attempt {attempt + 1}: {e}", exc_info=True)
            if attempt == attempts - 1:
                break
            await asyncio.sleep(delay)
            delay *= backoff_multiplier

    return fallback

async def _send_db_error_message(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    callback_query=None
) -> None:
    """
    Replies or edits message text with a standardized premium HTML database error block.
    """
    error_text = (
        "⚠️ <b>Database Connection Issue</b>\n\n"
        "We are currently having trouble communicating with our database server. "
        "Your request could not be completed at this time.\n\n"
        "Please wait a moment and try your action again."
    )
    try:
        if callback_query:
            await callback_query.answer("Database connection issue. Please retry.", show_alert=True)
            try:
                await callback_query.edit_message_text(
                    text=error_text,
                    parse_mode="HTML"
                )
            except Exception:
                if update.effective_chat:
                    await context.bot.send_message(
                        chat_id=update.effective_chat.id,
                        text=error_text,
                        parse_mode="HTML"
                    )
        elif update.effective_message:
            await update.effective_message.reply_html(text=error_text)
    except Exception as e:
        logger.error(f"Failed to output database error message: {e}", exc_info=True)


# ---------------------------------------------------------------------------
# Poll nudge thresholds & background configuration
# ---------------------------------------------------------------------------
STALE_POLL_HOURS                  = 48    # hours before a low-participation poll is nudged
STALE_PARTICIPATION               = 0.50  # nudge if fewer than 50% of committed voters have voted
MAJORITY_THRESHOLD                = 0.60  # nudge organiser once ≥ 60% of committed voters have voted
RSVP_NUDGE_INTERVAL_HOURS         = 24    # interval between RSVP nudges to the group
BACKGROUND_CHECK_INTERVAL_SECONDS = 3600  # run check loop hourly

# ---------------------------------------------------------------------------
# Currency helpers
# ---------------------------------------------------------------------------

# Common ISO codes shown as keyboard buttons in the new_trip wizard
_COMMON_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "MXN"]

# Symbol → ISO fallback map (ambiguous symbols default to the most common code)
_SYMBOL_TO_ISO: dict[str, str] = {
    "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY",
    "₹": "INR", "₩": "KRW", "₣": "CHF", "kr": "SEK",
}

# Prettier display symbols for known codes
_ISO_TO_SYMBOL: dict[str, str] = {
    "USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥",
    "CAD": "CA$", "AUD": "A$", "CHF": "Fr", "INR": "₹",
    "KRW": "₩", "MXN": "MX$", "SEK": "kr", "NOK": "kr",
    "DKK": "kr", "HKD": "HK$", "SGD": "S$", "NZD": "NZ$",
}


def _fmt(amount: float, currency: str) -> str:
    """Format an amount with its currency symbol, e.g. €1,200 or CA$450."""
    sym = _ISO_TO_SYMBOL.get(currency.upper(), currency.upper() + " ")
    if amount == int(amount):
        return f"{sym}{amount:,.0f}"
    return f"{sym}{amount:,.2f}"


def _parse_price_and_currency(text: str, default_currency: str) -> tuple[float | None, str]:
    """
    Parse user input like:
        "800"        → (800.0, default_currency)
        "800 EUR"    → (800.0, "EUR")
        "EUR 800"    → (800.0, "EUR")
        "€1,200.50"  → (1200.5, "EUR")
        "$1200"      → (1200.0, "USD")

    Returns (None, default_currency) if parsing fails.
    """
    text = text.strip()

    # Try to extract a leading currency symbol
    for sym, iso in _SYMBOL_TO_ISO.items():
        if text.startswith(sym):
            num_part = text[len(sym):].strip().replace(",", "")
            try:
                return float(num_part), iso
            except ValueError:
                return None, default_currency

    # Try "AMOUNT CODE" or "CODE AMOUNT"
    parts = text.upper().replace(",", "").split()
    if len(parts) == 2:
        # Which part is the number?
        for num_idx, code_idx in [(0, 1), (1, 0)]:
            try:
                amount = float(parts[num_idx])
                code   = parts[code_idx]
                if re.fullmatch(r"[A-Z]{3}", code):
                    return amount, code
            except ValueError:
                continue

    # Plain number — use default currency
    cleaned = text.replace(",", "")
    try:
        return float(cleaned), default_currency
    except ValueError:
        return None, default_currency


def _fetch_rates_sync(app_id: str) -> dict:
    """Blocking fetch — run via asyncio.to_thread."""
    url = f"https://openexchangerates.org/api/latest.json?app_id={app_id}"
    with urlopen(url, timeout=10) as resp:
        return json.loads(resp.read())


async def _get_exchange_rates(bot_data: dict) -> dict[str, float] | None:
    """
    Returns a {ISO_CODE: rate_vs_USD} dict, e.g. {"EUR": 0.92, "GBP": 0.79}.
    Rates are cached in bot_data for 1 hour to avoid hammering the API.
    Returns None on failure (callers should fall back to original amounts).
    """
    cache     = bot_data.get("fx_rates")
    cache_ts  = bot_data.get("fx_rates_ts")
    now       = datetime.now(timezone.utc)

    if cache and cache_ts and (now - cache_ts).total_seconds() < 3600:
        return cache

    app_id = os.getenv("OPENEXCHANGERATES_APP_ID")
    if not app_id:
        return None

    try:
        data   = await asyncio.to_thread(_fetch_rates_sync, app_id)
        rates  = data.get("rates", {})
        if not rates:
            return None
        bot_data["fx_rates"]    = rates
        bot_data["fx_rates_ts"] = now
        return rates
    except (URLError, Exception):
        return cache  # serve stale cache on network error


def _convert(amount: float, from_iso: str, to_iso: str, rates: dict) -> float | None:
    """
    Convert amount from_iso → to_iso using USD as the intermediary.
    All rates in `rates` are expressed as: 1 USD = X <currency>.
    Returns None if either currency is not in the rates dict.
    """
    from_iso = from_iso.upper()
    to_iso   = to_iso.upper()
    if from_iso == to_iso:
        return amount
    if from_iso not in rates or to_iso not in rates:
        return None
    # amount in from_iso → USD → to_iso
    return amount / rates[from_iso] * rates[to_iso]

# ---------------------------------------------------------------------------
# Conversation States
# ---------------------------------------------------------------------------
TITLE, DESTINATION, DATES, BASE_CURRENCY = range(4)

# Wizard States
ADD_OPT_CAT, ADD_OPT_NAME, ADD_OPT_DESC, ADD_OPT_DATES, ADD_OPT_LINK, ADD_OPT_PRICE = range(10, 16)
PAID_AMOUNT, PAID_DESC = range(15, 17)
LOCK_CAT, LOCK_TITLE, LOCK_DATES = range(17, 20)
LOCK_COST_TYPE, LOCK_COST = range(20, 22)
VOTE_CAT, VOTE_DATES = range(22, 24)
TRIP_SELECT          = 24

# Pending-action tokens — stored in user_data when the trip switcher fires
ACTION_ADDOPT = "addopt"
ACTION_LOCK   = "lock"
ACTION_VOTE   = "vote"
ACTION_PAID   = "paid"

# ---------------------------------------------------------------------------
# Shared DB Helpers
# ---------------------------------------------------------------------------

async def get_db_user_id(telegram_id: int) -> str | None:
    """
    Looks up a user's internal DB id by their Telegram id.
    Returns None if the user is not found.
    """
    result = await _safe_db_call(
        lambda: supabase.table("users")
        .select("id")
        .eq("telegram_id", telegram_id)
        .single()
        .execute()
    )
    if result and result.data:
        return result.data.get("id")
    return None


async def get_trip_context(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> tuple[str | None, str]:
    """
    Resolves the active trip_id and title based on the chat type.

    - In a group chat: finds the trip bound to that group.
    - In a PM: falls back to the user's most recent RSVP.

    Returns (trip_id, title) or (None, "") on failure, after sending an
    appropriate error message to the user.
    """
    chat = update.effective_chat

    if chat.type in ["group", "supergroup"]:
        result = await _safe_db_call(
            lambda: supabase.table("trips")
            .select("id, title")
            .eq("group_chat_id", chat.id)
            .execute()
        )
        if result is None:
            await _send_db_error_message(update, context)
            return None, ""

        if not result.data:
            await update.message.reply_text("This group isn't linked to a trip yet!")
            return None, ""

        return result.data[0]["id"], result.data[0].get("title", "")

    # --- PM fallback ---
    db_user_id = await get_db_user_id(update.effective_user.id)
    if not db_user_id:
        await update.message.reply_text(
            "You don't have an account yet. Join a trip group first!"
        )
        return None, ""

    rsvp_q = await _safe_db_call(
        lambda: supabase.table("rsvps")
        .select("trip_id")
        .eq("user_id", db_user_id)
        .order("id", desc=True)
        .limit(1)
        .execute()
    )
    if rsvp_q is None:
        await _send_db_error_message(update, context)
        return None, ""

    if not rsvp_q.data:
        await update.message.reply_text(
            "You aren't in any active trips yet! Use /new_trip to start one."
        )
        return None, ""

    trip_id = rsvp_q.data[0]["trip_id"]

    title_q = await _safe_db_call(
        lambda: supabase.table("trips")
        .select("title")
        .eq("id", trip_id)
        .single()
        .execute()
    )
    if title_q is None or not title_q.data:
        title = ""
    else:
        title = title_q.data.get("title", "")

    return trip_id, title


# ---------------------------------------------------------------------------
# Date Parsing Helpers
# ---------------------------------------------------------------------------

def smart_parse_dates(user_input: str, trip_start_str: str, trip_end_str: str):
    """
    Context-aware date parser.
    Understands "15-18", "Day 1 to Day 3", "June 15", or just "15".
    Returns (start_date, end_date) as date objects, or (None, None) on failure.
    """
    main_start = datetime.strptime(trip_start_str, "%Y-%m-%d").date()
    main_end = datetime.strptime(trip_end_str, "%Y-%m-%d").date()

    trip_days = [
        main_start + timedelta(days=i)
        for i in range((main_end - main_start).days + 1)
    ]

    def find_date(frag):
        frag = frag.strip().lower()
        if not frag:
            return None

        # 1. Exact day number (e.g. "15")
        if frag.isdigit():
            day = int(frag)
            for d in trip_days:
                if d.day == day:
                    return d

        # 2. Relative day (e.g. "day 2" or "day2")
        if frag.startswith("day"):
            try:
                num = int(re.sub(r"\D", "", frag))
                idx = num - 1
                if 0 <= idx < len(trip_days):
                    return trip_days[idx]
            except ValueError:
                pass

        # 3. Month + day (e.g. "15 jun" or "june 15")
        for d in trip_days:
            month_name = d.strftime("%B").lower()
            month_abbr = d.strftime("%b").lower()
            words = frag.replace(",", "").split()
            if str(d.day) in words and (month_name in words or month_abbr in words):
                return d

        return None

    parts = re.split(
        r"\s+to\s+|\s+until\s+|\s*-\s*", user_input.strip(), flags=re.IGNORECASE
    )

    if len(parts) == 1:
        d = find_date(parts[0])
        return d, d
    elif len(parts) >= 2:
        s_date = find_date(parts[0])
        e_date = find_date(parts[1])
        if s_date and e_date and s_date > e_date:
            return e_date, s_date
        return s_date, e_date

    return None, None


def parse_trip_dates(text: str):
    """
    Strictly enforces 'DD Month [YYYY] to DD Month YYYY'.
    The first year is optional. Rejects impossible calendar days.
    Returns (start_date, end_date) as date objects, or (None, None) on failure.
    """
    pattern = (
        r"^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?"
        r"\s+to\s+(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$"
    )
    match = re.match(pattern, text.strip(), re.IGNORECASE)

    if not match:
        return None, None

    start_day, start_month, start_year, end_day, end_month, end_year = match.groups()

    if not start_year:
        start_year = end_year

    start_string = f"{start_day} {start_month[:3]} {start_year}"
    end_string = f"{end_day} {end_month[:3]} {end_year}"

    try:
        start_date = datetime.strptime(start_string, "%d %b %Y").date()
        end_date = datetime.strptime(end_string, "%d %b %Y").date()
        return start_date, end_date
    except ValueError:
        return None, None


# ---------------------------------------------------------------------------
# /new_trip Conversation
# ---------------------------------------------------------------------------

async def new_trip(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📝 Let's start a new trip!\n\n"
        "Step 1: What are we calling this adventure?\n"
        "(e.g., <i>Austin Boys Trip</i>, <i>Sarah's Bachelorette</i>)",
        parse_mode="HTML",
    )
    return TITLE


async def get_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    title = update.message.text.strip()

    if len(title) < 2:
        await update.message.reply_text("Let's give it a real name! Try again.")
        return TITLE

    context.user_data["title"] = title
    await update.message.reply_text(
        f"Awesome, <b>{title}</b> it is.\n\n"
        "Step 2: Where are we actually going?\n"
        "(e.g., <i>Austin, TX</i>, <i>Miami</i>)",
        parse_mode="HTML",
    )
    return DESTINATION


async def get_destination(update: Update, context: ContextTypes.DEFAULT_TYPE):
    dest = update.message.text.strip()

    if len(dest) < 2:
        await update.message.reply_text(
            "That's a bit short! Please provide a real destination name."
        )
        return DESTINATION

    context.user_data["destination"] = dest
    await update.message.reply_text(
        f"📍 Destination set to: <b>{dest}</b>\n\n"
        "Step 3: When are we going?\n"
        "Please use the format: <b>DD Month to DD Month YYYY</b>\n"
        "Example: <code>15 June to 20 June 2026</code>",
        parse_mode="HTML",
    )
    return DATES


async def get_dates(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_input = update.message.text
    start_date, end_date = parse_trip_dates(user_input)

    if not start_date or not end_date:
        await update.message.reply_text(
            "❌ I couldn't understand those dates.\n"
            "Please use the exact format: <code>15 June to 20 June 2026</code>",
            parse_mode="HTML",
        )
        return DATES

    if start_date > end_date:
        await update.message.reply_text(
            "Wait, you can't come back before you leave! Try again."
        )
        return DATES

    context.user_data["start_date"] = start_date
    context.user_data["end_date"]   = end_date

    # Build currency keyboard: common options + Other
    rows = [_COMMON_CURRENCIES[i:i+4] for i in range(0, len(_COMMON_CURRENCIES), 4)]
    rows.append(["Other (type your own)"])

    await update.message.reply_text(
        "Step 4: What's the <b>base currency</b> for the trip budget?\n\n"
        "All prices in different currencies will be converted to this one "
        "when showing estimates.\n\n"
        "Tap one below or type any 3-letter ISO code (e.g. <code>THB</code>, <code>BRL</code>).",
        reply_markup=ReplyKeyboardMarkup(rows, one_time_keyboard=True, resize_keyboard=True),
        parse_mode="HTML",
    )
    return BASE_CURRENCY


async def get_currency(update: Update, context: ContextTypes.DEFAULT_TYPE):
    raw = update.message.text.strip().upper()

    # Handle "Other (type your own)" — ask them to just type it
    if "OTHER" in raw:
        await update.message.reply_text(
            "Type any 3-letter ISO currency code (e.g. <code>THB</code>, <code>BRL</code>, <code>ZAR</code>):",
            reply_markup=ReplyKeyboardRemove(),
            parse_mode="HTML",
        )
        return BASE_CURRENCY

    # Validate: must be a 3-letter alpha code
    if not re.fullmatch(r"[A-Z]{3}", raw):
        await update.message.reply_text(
            "❌ Please enter a valid 3-letter currency code like <code>EUR</code> or <code>THB</code>.",
            parse_mode="HTML",
        )
        return BASE_CURRENCY

    base_currency = raw
    start_date    = context.user_data["start_date"]
    end_date      = context.user_data["end_date"]

    user_id    = update.effective_user.id
    db_user_id = await get_db_user_id(user_id)
    if not db_user_id:
        await update.message.reply_text(
            "⚠️ Couldn't find your account. Please try /start first."
        )
        return ConversationHandler.END

    trip_data = {
        "organizer_id":  db_user_id,
        "title":         context.user_data["title"],
        "destination":   context.user_data["destination"],
        "start_date":    start_date.isoformat(),
        "end_date":      end_date.isoformat(),
        "vibe":          f"Trip to {context.user_data['destination']}",
        "base_currency": base_currency,
    }

    try:
        result = supabase.table("trips").insert(trip_data).execute()
        new_trip_id = result.data[0]["id"]
        supabase.table("rsvps").insert(
            {"trip_id": new_trip_id, "user_id": db_user_id, "status": "Committed"}
        ).execute()
    except Exception:
        await update.message.reply_text(
            "⚠️ Something went wrong saving your trip. Please try again."
        )
        return ConversationHandler.END

    bot_username      = context.bot.username
    add_to_group_url  = f"https://t.me/{bot_username}?startgroup={new_trip_id}"
    keyboard          = [[InlineKeyboardButton("➕ Add Bot to your Trip Group", url=add_to_group_url)]]
    sym               = _ISO_TO_SYMBOL.get(base_currency, base_currency)

    await update.message.reply_text(
        f"✅ <b>{context.user_data['title']} Locked In!</b>\n"
        f"📍 Destination: {context.user_data['destination']}\n"
        f"📅 {start_date.strftime('%b %d')} – {end_date.strftime('%b %d, %Y')}\n"
        f"💱 Base currency: <b>{base_currency}</b> ({sym})\n\n"
        "<b>Next step:</b> Create a Telegram group for this trip (or use an existing one), "
        "then click the button below to add me to it!",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="HTML",
    )
    return ConversationHandler.END


# ---------------------------------------------------------------------------
# /start  &  Wizard Router
# ---------------------------------------------------------------------------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles direct /start in a group (linking) or PM (welcome message)."""
    chat = update.effective_chat
    tg_user = update.effective_user

    # Register the user (skip bots)
    if not tg_user.is_bot:
        user_data = {
            "telegram_id": tg_user.id,
            "username": tg_user.username,
            "first_name": tg_user.first_name,
        }
        try:
            supabase.table("users").upsert(user_data, on_conflict="telegram_id").execute()
        except Exception:
            pass  # Non-fatal; user may already exist

    # --- Group chat: bind to a trip ---
    if chat.type in ["group", "supergroup"]:
        if context.args:
            incoming_trip_id = context.args[0]

            try:
                existing_trip = (
                    supabase.table("trips")
                    .select("id, title")
                    .eq("group_chat_id", chat.id)
                    .execute()
                )
            except Exception:
                return

            if existing_trip.data:
                existing_id = existing_trip.data[0]["id"]
                existing_title = existing_trip.data[0].get("title", "another trip")

                if existing_id == incoming_trip_id:
                    await context.bot.send_message(
                        chat_id=chat.id,
                        text=f"I'm already set up and tracking <b>{existing_title}</b> in this chat!",
                        parse_mode="HTML",
                    )
                else:
                    await context.bot.send_message(
                        chat_id=chat.id,
                        text=(
                            f"⚠️ <b>Hold up!</b> This group is already dedicated to planning "
                            f"<b>{existing_title}</b>.\n\n"
                            "To prevent mixed-up budgets and overlapping RSVPs, please create a "
                            "brand <i>new</i> Telegram group for your new trip and click the invite "
                            "button again to add me there!"
                        ),
                        parse_mode="HTML",
                    )
                return

            # Clean group — bind it
            try:
                supabase.table("trips").update({"group_chat_id": chat.id}).eq(
                    "id", incoming_trip_id
                ).execute()
                trip_q = (
                    supabase.table("trips")
                    .select("title, destination, start_date, end_date, users!trips_organizer_id_fkey(telegram_id)")
                    .eq("id", incoming_trip_id)
                    .execute()
                )
            except Exception:
                return

            if not trip_q.data:
                return

            trip = trip_q.data[0]
            s_date = datetime.strptime(trip["start_date"], "%Y-%m-%d").strftime("%b %d")
            e_date = datetime.strptime(trip["end_date"], "%Y-%m-%d").strftime("%b %d, %Y")

            # Set the organiser's elevated command scope for this group
            org_tg_id = (trip.get("users") or {}).get("telegram_id")
            if org_tg_id:
                await setup_commands_for_group(context.bot, chat.id, org_tg_id)

            keyboard = [
                [
                    InlineKeyboardButton(
                        "I'm In! 🎒",
                        callback_data=f"rsvp_{incoming_trip_id}_Committed",
                    ),
                    InlineKeyboardButton(
                        "Maybe 🤔",
                        callback_data=f"rsvp_{incoming_trip_id}_Tentative",
                    ),
                ],
                [
                    InlineKeyboardButton(
                        "Can't Make It ❌",
                        callback_data=f"rsvp_{incoming_trip_id}_Declined",
                    )
                ],
            ]

            await context.bot.send_message(
                chat_id=chat.id,
                text=(
                    f"👋 <b>Hey everyone! I'm your TripSync Bot for {trip['title']}!</b>\n\n"
                    f"📍 <b>Destination:</b> {trip['destination']}\n"
                    f"📅 <b>Dates:</b> {s_date} to {e_date}\n\n"
                    "<b>Step 1: Who's in?</b>\n"
                    "Please lock in your RSVP below so we can keep track of who's coming! "
                    "You can change it later if your plans shift.\n\n"
                    "<b>Step 2: Start Pitching Ideas!</b>\n"
                    "Got an Airbnb you love? Found a cheap flight? Use /add_option to throw it in the ring!"
                ),
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode="HTML",
            )
        return

    # --- Normal PM welcome ---
    await update.message.reply_text(
        f"Welcome, {tg_user.first_name}! Use /new_trip to start a plan."
    )


async def _build_category_keyboard(trip_id: str) -> ReplyKeyboardMarkup:
    """
    Builds a category ReplyKeyboard for a given trip.

    Priority order:
    1. Categories already used in poll_options for this trip (preserves exact
       casing stored in the DB, title-cased for display).
    2. Standard fallback categories not yet represented.

    This prevents duplicate categories caused by capitalisation drift
    (e.g. "accommodation" vs "Accommodation").
    """
    _STANDARD_CATEGORIES = [
        "Accommodation", "Flights", "Activities", "Food", "Transport", "Other"
    ]

    try:
        opts_q = (
            supabase.table("poll_options")
            .select("category")
            .eq("trip_id", trip_id)
            .execute()
        )
        existing = sorted({
            row["category"].capitalize() for row in (opts_q.data or [])
        })
    except Exception:
        existing = []

    # Add standard defaults that aren't already covered
    existing_lower = {c.lower() for c in existing}
    extras = [c for c in _STANDARD_CATEGORIES if c.lower() not in existing_lower]

    all_cats = existing + extras
    # Chunk into rows of 2
    rows = [all_cats[i : i + 2] for i in range(0, len(all_cats), 2)]

    return ReplyKeyboardMarkup(rows, one_time_keyboard=True, resize_keyboard=True)


async def _get_user_trips(tg_user_id: int) -> list[dict]:
    """
    Returns all trips the user has an active (non-Declined) RSVP for,
    ordered newest first. Each dict has: id, title, destination, start_date, end_date.
    Returns [] on any error.
    """
    db_user_id = await get_db_user_id(tg_user_id)
    if not db_user_id:
        return []
    
    rsvp_q = await _safe_db_call(
        lambda: supabase.table("rsvps")
        .select("trip_id, trips(id, title, destination, start_date, end_date)")
        .eq("user_id", db_user_id)
        .neq("status", "Declined")
        .order("id", desc=True)
        .execute()
    )
    if not rsvp_q or not rsvp_q.data:
        return []
        
    trips = []
    seen  = set()
    for row in rsvp_q.data:
        t = row.get("trips")
        if t and t["id"] not in seen:
            seen.add(t["id"])
            trips.append(t)
    return trips


async def _launch_wizard(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    action: str,
    trip: dict,
) -> int:
    """
    Sends the first prompt for `action` and returns its opening ConversationHandler state.
    Called by both the deep-link path (wizard_router) and the PM-direct path
    (after trip selection or single-trip fast-path).
    """
    trip_id = trip["id"]
    title   = trip.get("title", "your trip")
    context.user_data["wiz_trip_id"] = trip_id

    if action == ACTION_ADDOPT:
        reply_markup = await _build_category_keyboard(trip_id)
        await update.message.reply_text(
            f"Let's add an option for <b>{title}</b>!\n\n"
            "First, what category is this? (Tap one or type your own)",
            reply_markup=reply_markup,
            parse_mode="HTML",
        )
        return ADD_OPT_CAT

    if action == ACTION_LOCK:
        reply_markup = await _build_category_keyboard(trip_id)
        await update.message.reply_text(
            "🔒 Let's lock in an itinerary item!\n\nFirst, what category is this?",
            reply_markup=reply_markup,
        )
        return LOCK_CAT

    if action == ACTION_PAID:
        await update.message.reply_text(
            "💸 Let's log an expense!\n\nHow much did you pay? (e.g., <code>150.50</code>)",
            parse_mode="HTML",
        )
        return PAID_AMOUNT

    if action == ACTION_VOTE:
        try:
            opts_q = (
                supabase.table("poll_options")
                .select("category")
                .eq("trip_id", trip_id)
                .execute()
            )
            cats = sorted({row["category"].capitalize() for row in (opts_q.data or [])})
        except Exception:
            cats = []

        if not cats:
            await update.message.reply_text(
                "⚠️ There are no options pitched yet!\n"
                "Use /add_option to start suggesting ideas first.",
                reply_markup=ReplyKeyboardRemove(),
            )
            return ConversationHandler.END

        keyboard_rows = [cats[i : i + 2] for i in range(0, len(cats), 2)]
        await update.message.reply_text(
            "🗳️ <b>Let's start a vote!</b>\n\nWhich category do you want to poll the group on?",
            reply_markup=ReplyKeyboardMarkup(
                keyboard_rows, one_time_keyboard=True, resize_keyboard=True
            ),
            parse_mode="HTML",
        )
        return VOTE_CAT

    return ConversationHandler.END


async def _start_wizard_pm(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    action: str,
) -> int:
    """
    PM-direct entry point for any wizard.

    • 0 trips  → error message, END
    • 1 trip   → skip switcher, launch wizard immediately
    • ≥2 trips → show trip-picker keyboard, return TRIP_SELECT
    """
    # FIX: Clear any stale wizard state from a previous abandoned flow
    for key in list(context.user_data.keys()):
        if key.startswith("wiz_"):
            del context.user_data[key]

    trips = await _get_user_trips(update.effective_user.id)

    if not trips:
        await update.message.reply_text(
            "You aren't in any active trips yet. Use /new_trip to start one,\n"
            "or ask a trip organiser to add the bot to your group!"
        )
        return ConversationHandler.END

    if len(trips) == 1:
        return await _launch_wizard(update, context, action, trips[0])

    # ≥ 2 trips — present the switcher
    context.user_data["wiz_pending_action"] = action
    # Map display label → trip dict for quick lookup in handle_trip_select
    options: dict[str, dict] = {}
    keyboard_rows = []
    for t in trips:
        s = datetime.strptime(t["start_date"], "%Y-%m-%d").strftime("%b %d")
        e = datetime.strptime(t["end_date"],   "%Y-%m-%d").strftime("%b %d '%y")
        label = f"{t['title']} ({s}–{e})"
        options[label] = t
        keyboard_rows.append([label])
    context.user_data["wiz_trip_options"] = options

    action_label = {
        ACTION_ADDOPT: "add an option",
        ACTION_LOCK:   "lock in an item",
        ACTION_VOTE:   "start a vote",
        ACTION_PAID:   "log an expense",
    }.get(action, "continue")

    await update.message.reply_text(
        f"You're in <b>{len(trips)} trips</b> — which one do you want to {action_label}?",
        reply_markup=ReplyKeyboardMarkup(
            keyboard_rows, one_time_keyboard=True, resize_keyboard=True
        ),
        parse_mode="HTML",
    )
    return TRIP_SELECT


async def handle_trip_select(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    """
    TRIP_SELECT state handler.
    Receives the tapped trip label, resolves the trip, then dispatches
    to the first state of the pending wizard action.
    """
    label   = update.message.text.strip()
    options = context.user_data.get("wiz_trip_options", {})
    action  = context.user_data.get("wiz_pending_action", "")

    if label not in options:
        # Re-show the keyboard — user typed something unexpected
        keyboard_rows = [[k] for k in options]
        await update.message.reply_text(
            "Please tap one of the trips below:",
            reply_markup=ReplyKeyboardMarkup(
                keyboard_rows, one_time_keyboard=True, resize_keyboard=True
            ),
        )
        return TRIP_SELECT

    trip = options[label]
    return await _launch_wizard(update, context, action, trip)


async def wizard_router(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Routes /start deep-links to the correct PM wizard flow, or falls
    through to the normal start logic for plain /start calls.
    """
    # FIX: Clear any stale wizard state from a previous abandoned flow
    for key in list(context.user_data.keys()):
        if key.startswith("wiz_"):
            del context.user_data[key]

    payload = context.args[0] if context.args else ""

    # --- Add Option Wizard ---
    if payload.startswith("addopt_"):
        trip_id = payload[len("addopt_"):]
        try:
            tq = supabase.table("trips").select("id, title, destination, start_date, end_date").eq("id", trip_id).single().execute()
            trip = tq.data
        except Exception:
            trip = {"id": trip_id, "title": "your trip"}
        return await _launch_wizard(update, context, ACTION_ADDOPT, trip)

    # --- Log Expense Wizard ---
    if payload.startswith("paid_"):
        trip_id = payload[len("paid_"):]
        try:
            tq = supabase.table("trips").select("id, title, destination, start_date, end_date").eq("id", trip_id).single().execute()
            trip = tq.data
        except Exception:
            trip = {"id": trip_id, "title": "your trip"}
        return await _launch_wizard(update, context, ACTION_PAID, trip)

    # --- Lock Itinerary Wizard ---
    if payload.startswith("lock_"):
        trip_id = payload[len("lock_"):]
        try:
            tq = supabase.table("trips").select("id, title, destination, start_date, end_date").eq("id", trip_id).single().execute()
            trip = tq.data
        except Exception:
            trip = {"id": trip_id, "title": "your trip"}
        return await _launch_wizard(update, context, ACTION_LOCK, trip)

    # --- Vote Wizard ---
    if payload.startswith("vote_"):
        trip_id = payload[len("vote_"):]
        try:
            tq = supabase.table("trips").select("id, title, destination, start_date, end_date").eq("id", trip_id).single().execute()
            trip = tq.data
        except Exception:
            trip = {"id": trip_id, "title": "your trip"}
        return await _launch_wizard(update, context, ACTION_VOTE, trip)

    # Plain /start — hand off to the normal start handler
    await start(update, context)
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Cancelled.", reply_markup=ReplyKeyboardRemove()
    )
    return ConversationHandler.END


# ---------------------------------------------------------------------------
# RSVP Callback
# ---------------------------------------------------------------------------

async def handle_rsvp(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query

    # callback_data format: "rsvp_{trip_id}_{status}"
    # Use maxsplit=2 to safely handle UUIDs that contain underscores
    _, trip_id, status = query.data.split("_", 2)

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
        supabase.table("rsvps").upsert(
            {"trip_id": trip_id, "user_id": db_user_id, "status": status},
            on_conflict="trip_id, user_id",
        ).execute()
    except Exception:
        await query.answer("⚠️ Something went wrong. Please try again.", show_alert=True)
        return

    await query.answer(
        f"✅ RSVP Locked! Got it, {query.from_user.first_name}! Your RSVP is locked as: {status}",
        show_alert=True,
    )


# ---------------------------------------------------------------------------
# /roster
# ---------------------------------------------------------------------------

async def roster(update: Update, context: ContextTypes.DEFAULT_TYPE):
    trip_id, destination = await get_trip_context(update, context)
    if not trip_id:
        return

    roster_q = await _safe_db_call(
        lambda: supabase.table("rsvps")
        .select("status, notes, users(first_name)")
        .eq("trip_id", trip_id)
        .execute()
    )
    if roster_q is None:
        await _send_db_error_message(update, context)
        return

    committed, tentative, declined = [], [], []
    for row in roster_q.data:
        name = row["users"]["first_name"]
        note = row.get("notes")
        s = row["status"]
        if s == "Committed":
            committed.append((name, note))
        elif s == "Tentative":
            tentative.append((name, note))
        elif s == "Declined":
            declined.append((name, note))

    def _format_member_line(name, note):
        line = f"• <b>{_escape(name)}</b>"
        if note:
            line += f" (📝 <i>{_escape(note)}</i>)"
        return line

    r_emoji = _UX_EMOJIS.get("roster", "📋")
    message = f"{r_emoji} <b>Current Roster for {_escape(destination)}</b>\n\n"
    message += f"🎒 <b>I'm In ({len(committed)}):</b>\n"
    message += (
        "\n".join(_format_member_line(n, nt) for n, nt in committed) if committed else "• None yet"
    )
    message += "\n\n"

    if tentative:
        message += f"🤔 <b>Maybe ({len(tentative)}):</b>\n"
        message += "\n".join(_format_member_line(n, nt) for n, nt in tentative)
        message += "\n\n"

    if declined:
        message += f"❌ <b>Out ({len(declined)}):</b>\n"
        message += "\n".join(_format_member_line(n, nt) for n, nt in declined)

    await update.message.reply_text(message, parse_mode="HTML")


async def rsvp_notes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    trip_id, _ = await get_trip_context(update, context)
    if not trip_id:
        return

    note_text = " ".join(context.args).strip()
    if not note_text:
        await update.message.reply_text(
            "⚠️ Usage: <code>/rsvp_notes &lt;your notes here&gt;</code>\n"
            "Example: <code>/rsvp_notes Gluten-free, arriving Friday night</code>",
            parse_mode="HTML"
        )
        return

    db_user_id = await get_db_user_id(update.effective_user.id)
    if not db_user_id:
        await update.message.reply_text("⚠️ Couldn't find your account. Please try again.")
        return

    res = await _safe_db_call(
        lambda: supabase.table("rsvps")
        .upsert(
            {
                "trip_id": trip_id,
                "user_id": db_user_id,
                "notes": note_text,
                "status": "Interested"
            },
            on_conflict="trip_id, user_id"
        )
        .execute()
    )
    if res is None:
        await _send_db_error_message(update, context)
        return

    await update.message.reply_text(
        f"✅ <b>RSVP Note Saved!</b>\nYour note has been updated for this trip:\n<i>{_escape(note_text)}</i>",
        parse_mode="HTML"
    )


async def handle_poll_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    poll_answer = update.poll_answer
    poll_id = poll_answer.poll_id
    tg_user_id = poll_answer.user.id
    selected_options = poll_answer.option_ids

    active_poll = await _safe_db_call(
        lambda: supabase.table("active_polls")
        .select("id, voter_ids")
        .eq("telegram_poll_id", poll_id)
        .execute()
    )
    if not active_poll or not active_poll.data:
        return

    record = active_poll.data[0]
    record_id = record["id"]
    voter_ids = record.get("voter_ids") or []

    if not selected_options:
        if tg_user_id in voter_ids:
            voter_ids.remove(tg_user_id)
    else:
        if tg_user_id not in voter_ids:
            voter_ids.append(tg_user_id)

    await _safe_db_call(
        lambda: supabase.table("active_polls")
        .update({"voter_ids": voter_ids})
        .eq("id", record_id)
        .execute()
    )


# ---------------------------------------------------------------------------
# /change_rsvp
# ---------------------------------------------------------------------------

async def change_rsvp(update: Update, context: ContextTypes.DEFAULT_TYPE):
    trip_id, _ = await get_trip_context(update, context)
    if not trip_id:
        return

    keyboard = [
        [
            InlineKeyboardButton("I'm In! 🎒", callback_data=f"rsvp_{trip_id}_Committed"),
            InlineKeyboardButton("Maybe 🤔", callback_data=f"rsvp_{trip_id}_Tentative"),
        ],
        [InlineKeyboardButton("Can't Make It ❌", callback_data=f"rsvp_{trip_id}_Declined")],
    ]
    await update.message.reply_text(
        "Update your RSVP status below:",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


# ---------------------------------------------------------------------------
# /add_option  (group redirect → PM wizard)
# ---------------------------------------------------------------------------

async def add_option(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat

    if chat.type not in ["group", "supergroup"]:
        return await _start_wizard_pm(update, context, ACTION_ADDOPT)

    trip_q = await _safe_db_call(
        lambda: supabase.table("trips")
        .select("id")
        .eq("group_chat_id", chat.id)
        .execute()
    )
    if trip_q is None:
        await _send_db_error_message(update, context)
        return

    if not trip_q.data:
        await update.message.reply_text("This group isn't linked to a trip yet!")
        return

    trip_id = trip_q.data[0]["id"]
    bot_username = context.bot.username
    url = f"https://t.me/{bot_username}?start=addopt_{trip_id}"

    keyboard = [[InlineKeyboardButton("Add Option in PM 💬", url=url)]]

    try:
        await update.message.delete()
    except Exception:
        pass  # Bot may not have delete permission

    await context.bot.send_message(
        chat_id=chat.id,
        text=(
            f"<b>{update.effective_user.first_name}</b> is adding an option!\n"
            "Let's do this in a private message so we don't clutter the group."
        ),
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="HTML",
    )


# ---------------------------------------------------------------------------
# /vote  (group redirect → PM wizard)
# ---------------------------------------------------------------------------

async def vote(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Group-side command: sends the user a deep-link to the PM vote wizard."""
    chat = update.effective_chat

    if chat.type not in ["group", "supergroup"]:
        return await _start_wizard_pm(update, context, ACTION_VOTE)

    try:
        trip_q = (
            supabase.table("trips")
            .select("id")
            .eq("group_chat_id", chat.id)
            .execute()
        )
    except Exception:
        await update.message.reply_text(
            "⚠️ Couldn't reach the database. Please try again."
        )
        return

    if not trip_q.data:
        await update.message.reply_text("This group isn't linked to a trip yet!")
        return

    trip_id = trip_q.data[0]["id"]
    bot_username = context.bot.username
    url = f"https://t.me/{bot_username}?start=vote_{trip_id}"

    keyboard = [[InlineKeyboardButton("Start a Vote in PM 🗳️", url=url)]]

    try:
        await update.message.delete()
    except Exception:
        pass  # Bot may not have delete permission

    await context.bot.send_message(
        chat_id=chat.id,
        text=(
            f"<b>{update.effective_user.first_name}</b> wants to start a vote!\n"
            "Let's set it up in a private message."
        ),
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="HTML",
    )


# ---------------------------------------------------------------------------
# Vote Wizard handlers (PM)
# ---------------------------------------------------------------------------

async def wiz_vote_cat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Stores chosen category, then asks whether to filter by date."""
    category = update.message.text.lower()
    context.user_data["wiz_vote_cat"] = category

    # Check how many options exist for this category
    trip_id = context.user_data["wiz_trip_id"]
    try:
        opts_q = (
            supabase.table("poll_options")
            .select("option_text, start_date, end_date, link, estimated_cost")
            .eq("trip_id", trip_id)
            .eq("category", category)
            .execute()
        )
    except Exception:
        await update.message.reply_text(
            "⚠️ Couldn't fetch options. Please try again."
        )
        return ConversationHandler.END

    if not opts_q.data or len(opts_q.data) < 2:
        await update.message.reply_text(
            f"⚠️ There are fewer than 2 options in <b>{category}</b> right now.\n"
            "Add more ideas first with <code>/add_option</code> in the group!",
            reply_markup=ReplyKeyboardRemove(),
            parse_mode="HTML",
        )
        return ConversationHandler.END

    # Store all options so we don't hit the DB a second time
    context.user_data["wiz_vote_all_options"] = opts_q.data

    # Check if any options carry dates — if none do, skip the date question
    has_dates = any(opt["start_date"] for opt in opts_q.data)

    if not has_dates:
        # No dates on any option — fire the poll immediately, no filter needed
        return await finalize_vote(update, context, start_date=None, end_date=None)

    # --- Build date-range buttons from the ACTUAL distinct ranges in the data ---
    # Each unique (start_date, end_date) pair becomes a tappable button so the
    # user never has to type dates manually.
    seen_ranges: set[tuple] = set()
    date_buttons: list[str] = []
    for opt in opts_q.data:
        if opt["start_date"]:
            key = (opt["start_date"], opt["end_date"])
            if key not in seen_ranges:
                seen_ranges.add(key)
                s = datetime.strptime(opt["start_date"], "%Y-%m-%d").strftime("%b %d")
                e = datetime.strptime(opt["end_date"], "%Y-%m-%d").strftime("%b %d")
                label = s if s == e else f"{s} – {e}"
                date_buttons.append(label)

    # Store the label→isodate mapping so wiz_vote_dates can resolve tapped buttons
    context.user_data["wiz_vote_date_map"] = {
        btn: (opt["start_date"], opt["end_date"])
        for opt in opts_q.data
        if opt["start_date"]
        for btn in [
            (lambda s, e: s if s == e else f"{s} – {e}")(
                datetime.strptime(opt["start_date"], "%Y-%m-%d").strftime("%b %d"),
                datetime.strptime(opt["end_date"], "%Y-%m-%d").strftime("%b %d"),
            )
        ]
    }

    # Show options summary + date picker
    preview_lines = []
    for opt in opts_q.data[:6]:
        if opt["start_date"]:
            s = datetime.strptime(opt["start_date"], "%Y-%m-%d").strftime("%b %d")
            e = datetime.strptime(opt["end_date"], "%Y-%m-%d").strftime("%b %d")
            preview_lines.append(f"• {opt['option_text']} ({s} – {e})")
        else:
            preview_lines.append(f"• {opt['option_text']}")

    preview = "\n".join(preview_lines)
    if len(opts_q.data) > 6:
        preview += f"\n…and {len(opts_q.data) - 6} more"

    # Build keyboard: one button per distinct date range + Skip row
    btn_rows = [date_buttons[i : i + 2] for i in range(0, len(date_buttons), 2)]
    btn_rows.append(["Skip (include all)"])

    await update.message.reply_text(
        f"Found <b>{len(opts_q.data)} options</b> in {category.capitalize()}:\n\n"
        f"{preview}\n\n"
        "Tap a date range to narrow the poll, or <b>Skip</b> to include all.",
        reply_markup=ReplyKeyboardMarkup(
            btn_rows, one_time_keyboard=True, resize_keyboard=True
        ),
        parse_mode="HTML",
    )
    return VOTE_DATES


async def wiz_vote_dates(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Parses the optional date filter, then fires the poll."""
    user_input = update.message.text.strip()

    # User skipped date filtering
    if user_input.lower() in ("skip", "skip (include all)"):
        return await finalize_vote(update, context, start_date=None, end_date=None)

    # --- Check if the user tapped one of the pre-built date-range buttons ---
    date_map: dict = context.user_data.get("wiz_vote_date_map", {})
    if user_input in date_map:
        iso_start, iso_end = date_map[user_input]
        start_date = datetime.strptime(iso_start, "%Y-%m-%d").date()
        end_date = datetime.strptime(iso_end, "%Y-%m-%d").date()
        return await finalize_vote(update, context, start_date=start_date, end_date=end_date)

    # --- Fall back to smart_parse_dates for manually typed dates ---
    trip_id = context.user_data["wiz_trip_id"]
    try:
        trip_q = (
            supabase.table("trips")
            .select("start_date, end_date")
            .eq("id", trip_id)
            .single()
            .execute()
        )
        t_start = trip_q.data["start_date"]
        t_end = trip_q.data["end_date"]
    except Exception:
        await update.message.reply_text(
            "⚠️ Couldn't fetch trip dates. Please try again."
        )
        return VOTE_DATES

    start_date, end_date = smart_parse_dates(user_input, t_start, t_end)

    if not start_date or not end_date:
        # Rebuild the button keyboard so the user can tap instead
        date_buttons = list(date_map.keys())
        btn_rows = [date_buttons[i : i + 2] for i in range(0, len(date_buttons), 2)]
        btn_rows.append(["Skip (include all)"])
        await update.message.reply_text(
            "❌ I couldn't understand those dates.\n"
            "Tap one of the date buttons above, or type e.g. <code>15-18</code>.",
            reply_markup=ReplyKeyboardMarkup(
                btn_rows, one_time_keyboard=True, resize_keyboard=True
            ),
            parse_mode="HTML",
        )
        return VOTE_DATES

    return await finalize_vote(update, context, start_date=start_date, end_date=end_date)


async def finalize_vote(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    start_date,
    end_date,
):
    """
    Builds and fires the Telegram poll.

    BUG FIX: Instead of filtering in SQL with exact start/end equality
    (which silently drops options with null dates or overlapping-but-not-
    identical ranges), we fetch ALL options for the category and filter
    in Python using inclusive date overlap logic.
    """
    trip_id = context.user_data["wiz_trip_id"]
    category = context.user_data["wiz_vote_cat"]
    all_options = context.user_data.get("wiz_vote_all_options", [])

    # Python-side date-overlap filter.
    # When the user explicitly picks a date window, options with NO stored dates
    # are excluded — we can't confirm they apply to that window.
    # (When no filter is active, all options including undated ones are shown.)
    #
    # FENCE-POST RULE:
    #   Accommodation dates represent *nights*.  June 15–19 = 4 nights (15,16,17,18).
    #   An option starting June 19 shares zero nights → excluded.
    #   Use STRICT inequality: opt_start < filter_end AND opt_end > filter_start
    #
    #   All other categories use *inclusive* overlap (an activity on June 19 IS
    #   inside a June 15–19 window):
    #   opt_start <= filter_end AND opt_end >= filter_start
    _NIGHT_BASED = {"accommodation", "accommodations", "lodging", "hotel", "hostel"}
    night_based = category.lower() in _NIGHT_BASED

    if start_date and end_date:
        filtered = []
        for opt in all_options:
            if not opt["start_date"]:
                continue  # no dates stored → skip when filter is active
            opt_start = datetime.strptime(opt["start_date"], "%Y-%m-%d").date()
            opt_end = datetime.strptime(opt["end_date"], "%Y-%m-%d").date()
            if night_based:
                overlaps = opt_start < end_date and opt_end > start_date
            else:
                overlaps = opt_start <= end_date and opt_end >= start_date
            if overlaps:
                filtered.append(opt)
        chosen_options = filtered
    else:
        chosen_options = all_options

    if len(chosen_options) < 2:
        date_note = (
            f" for <b>{start_date.strftime('%b %d')} – {end_date.strftime('%b %d')}</b>"
            if start_date
            else ""
        )
        # Restore the full date-range buttons so the user can try a different window
        date_map: dict = context.user_data.get("wiz_vote_date_map", {})
        date_buttons = list(date_map.keys())
        btn_rows = [date_buttons[i : i + 2] for i in range(0, len(date_buttons), 2)]
        btn_rows.append(["Skip (include all)"])
        await update.message.reply_text(
            f"⚠️ Only <b>{len(chosen_options)}</b> option(s) match{date_note}. "
            "Need at least 2 to run a poll — try a different date range or tap <b>Skip</b> to include everything.",
            reply_markup=ReplyKeyboardMarkup(
                btn_rows, one_time_keyboard=True, resize_keyboard=True
            ),
            parse_mode="HTML",
        )
        return VOTE_DATES

    # Telegram polls cap at 10 options
    if len(chosen_options) > 10:
        chosen_options = chosen_options[:10]

    # Fetch committed headcount for per-person pricing
    try:
        roster_q = (
            supabase.table("rsvps")
            .select("id")
            .eq("trip_id", trip_id)
            .eq("status", "Committed")
            .execute()
        )
        num_committed = len(roster_q.data) or 1  # guard against div/0
    except Exception:
        num_committed = 1

    _NIGHT_BASED_CHECK = {"accommodation", "accommodations", "lodging", "hotel", "hostel"}
    is_night_based = category.lower() in _NIGHT_BASED_CHECK

    # ------------------------------------------------------------------
    # Build poll option strings (100-char Telegram limit per option)
    # Format: "Name (Jun 15–19) · $800 total · $200/nt · $160/pp"
    # Links cannot fit — they go in the companion detail message below.
    # ------------------------------------------------------------------
    poll_options = []
    for opt in chosen_options:
        text = opt["option_text"]

        # Dates
        if opt["start_date"]:
            s = datetime.strptime(opt["start_date"], "%Y-%m-%d").strftime("%b %d")
            e = datetime.strptime(opt["end_date"], "%Y-%m-%d").strftime("%b %d")
            text += f" ({s})" if s == e else f" ({s}–{e})"

        # Price
        cost = opt.get("estimated_cost")
        if cost is not None:
            cost = float(cost)
            pp = cost / num_committed
            price_str = f" · ${cost:,.0f}"
            if is_night_based and opt["start_date"]:
                nights = (
                    datetime.strptime(opt["end_date"], "%Y-%m-%d").date()
                    - datetime.strptime(opt["start_date"], "%Y-%m-%d").date()
                ).days
                if nights > 0:
                    pn = cost / nights
                    price_str += f" · ${pn:,.0f}/nt · ${pp:,.0f}/pp"
                else:
                    price_str += f" · ${pp:,.0f}/pp"
            else:
                price_str += f" · ${pp:,.0f}/pp"
            text += price_str

        poll_options.append(text[:100])

    # Fetch trip info for poll question and companion message
    try:
        trip_q = (
            supabase.table("trips")
            .select("title, group_chat_id")
            .eq("id", trip_id)
            .single()
            .execute()
        )
        trip_title = trip_q.data["title"]
        group_chat_id = trip_q.data.get("group_chat_id")
    except Exception:
        trip_title = "the trip"
        group_chat_id = None

    poll_question = f"🗳️ {category.capitalize()} — {trip_title}"
    if start_date:
        poll_question += f" ({start_date.strftime('%b %d')}–{end_date.strftime('%b %d')})"
    poll_question = poll_question[:300]

    # ------------------------------------------------------------------
    # Companion detail message — sent right BEFORE the poll so the group
    # has full context. Includes links and complete price breakdowns.
    # ------------------------------------------------------------------
    detail_lines = [f"📋 <b>Options up for vote ({category.capitalize()}):</b>\n"]
    for i, opt in enumerate(chosen_options, 1):
        name = opt["option_text"]
        escaped_name = _escape(name)
        if opt.get("link"):
            line = f"<b>{i}. <a href='{opt['link']}'>{escaped_name}</a></b>"
        else:
            line = f"<b>{i}. {escaped_name}</b>"

        if opt.get("description"):
            line += f"\n   📝 <i>{_escape(opt['description'])}</i>"

        if opt["start_date"]:
            s = datetime.strptime(opt["start_date"], "%Y-%m-%d").strftime("%b %d")
            e = datetime.strptime(opt["end_date"], "%Y-%m-%d").strftime("%b %d")
            line += f"\n   📅 {s}" if s == e else f"\n   📅 {s} – {e}"

        cost = opt.get("estimated_cost")
        if cost is not None:
            cost = float(cost)
            pp = cost / num_committed
            line += f"\n   💰 ${cost:,.2f} total · ${pp:,.2f}/person"
            if is_night_based and opt["start_date"]:
                nights = (
                    datetime.strptime(opt["end_date"], "%Y-%m-%d").date()
                    - datetime.strptime(opt["start_date"], "%Y-%m-%d").date()
                ).days
                if nights > 0:
                    pn = cost / nights
                    line += f" · ${pn:,.2f}/night ({nights} nights)"

        detail_lines.append(line)

    detail_lines.append(f"\n<i>(Prices split across {num_committed} confirmed traveler{'s' if num_committed != 1 else ''})</i>")
    companion_msg = "\n\n".join(detail_lines)

    # PM confirmation
    if start_date:
        filter_note = (
            f"\n🗓 Filtered to: <b>{start_date.strftime('%b %d')} – {end_date.strftime('%b %d')}</b>"
            f" · {len(chosen_options)} option(s)"
        )
    else:
        filter_note = f"\n📋 All <b>{len(chosen_options)}</b> options included"

    await update.message.reply_text(
        f"✅ <b>Poll Published!</b>\nSending the poll to the group now!{filter_note}",
        reply_markup=ReplyKeyboardRemove(),
        parse_mode="HTML",
    )

    target = group_chat_id or update.effective_chat.id

    # Send companion details first, then the poll
    await context.bot.send_message(
        chat_id=target,
        text=companion_msg,
        parse_mode="HTML",
        disable_web_page_preview=True,
    )
    sent_msg = await context.bot.send_poll(
        chat_id=target,
        question=poll_question,
        options=poll_options,
        is_anonymous=False,
        allows_multiple_answers=True,
    )

    # ── Record the poll so the job queue can nudge on staleness/majority ──
    # Store original untruncated option texts (not the 100-char display strings)
    # so the majority nudge can reference the winning option by name.
    poll_options_json = [
        {"index": i, "text": opt["option_text"]}
        for i, opt in enumerate(chosen_options)
    ]
    try:
        supabase.table("active_polls").insert({
            "trip_id":           trip_id,
            "telegram_poll_id":  sent_msg.poll.id,
            "group_chat_id":     target,
            "category":          category,
            "poll_options_json": poll_options_json,
            "committed_count":   num_committed,
        }).execute()
    except Exception:
        pass  # Non-fatal — nudges won't fire but the poll still works

    return ConversationHandler.END


# ---------------------------------------------------------------------------
# /lock_master  (group redirect → PM wizard)
# ---------------------------------------------------------------------------

async def lock_master(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat

    if chat.type not in ["group", "supergroup"]:
        return await _start_wizard_pm(update, context, ACTION_LOCK)

    try:
        trip_q = (
            supabase.table("trips")
            .select("id")
            .eq("group_chat_id", chat.id)
            .execute()
        )
    except Exception:
        return

    if not trip_q.data:
        return

    trip_id = trip_q.data[0]["id"]
    bot_username = context.bot.username
    url = f"https://t.me/{bot_username}?start=lock_{trip_id}"

    keyboard = [[InlineKeyboardButton("Lock Itinerary in PM 🔒", url=url)]]

    try:
        await update.message.delete()
    except Exception:
        pass

    await context.bot.send_message(
        chat_id=chat.id,
        text=f"<b>{update.effective_user.first_name}</b> is locking in a plan!",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="HTML",
    )


# ---------------------------------------------------------------------------
# Accommodation coverage helper  (used by /check_gaps AND add_option nudge)
# ---------------------------------------------------------------------------

_NIGHT_BASED_CATS = {"accommodation", "accommodations", "lodging", "hotel", "hostel"}


def _coverage_nights(start_iso: str, end_iso: str) -> set:
    """Return the set of night-dates between start (inclusive) and end (exclusive)."""
    s = datetime.strptime(start_iso, "%Y-%m-%d").date()
    e = datetime.strptime(end_iso, "%Y-%m-%d").date()
    return {s + timedelta(days=i) for i in range((e - s).days)}


async def _accommodation_coverage(trip_id: str, trip_data: dict) -> dict | None:
    """
    Returns a dict describing accommodation coverage for every trip night:

        {
          "total_nights":   set[date],   # all nights of the trip
          "locked_nights":  set[date],   # nights covered by master_itinerary
          "option_nights":  set[date],   # nights covered by poll_options (not locked)
          "locked_items":   list[dict],  # master_itinerary rows
          "option_items":   list[dict],  # poll_options rows
        }

    Returns None on DB error.
    """
    main_start = datetime.strptime(trip_data["start_date"], "%Y-%m-%d").date()
    main_end   = datetime.strptime(trip_data["end_date"],   "%Y-%m-%d").date()
    total_nights = {
        main_start + timedelta(days=i)
        for i in range((main_end - main_start).days)
    }

    # Locked accommodation (master_itinerary)
    try:
        locked_q = (
            supabase.table("master_itinerary")
            .select("title, start_date, end_date")
            .eq("trip_id", trip_id)
            .eq("category", "accommodation")
            .execute()
        )
        locked_items = locked_q.data or []
    except Exception:
        return None

    locked_nights: set = set()
    for item in locked_items:
        if item["start_date"] and item["end_date"]:
            locked_nights |= _coverage_nights(item["start_date"], item["end_date"])

    # Pitched options (poll_options) — any night-based category
    try:
        opts_q = (
            supabase.table("poll_options")
            .select("option_text, start_date, end_date, category")
            .eq("trip_id", trip_id)
            .execute()
        )
        all_opts = opts_q.data or []
    except Exception:
        return None

    acc_options = [
        o for o in all_opts
        if o["category"].lower() in _NIGHT_BASED_CATS
        and o["start_date"] and o["end_date"]
    ]

    option_nights: set = set()
    for opt in acc_options:
        option_nights |= _coverage_nights(opt["start_date"], opt["end_date"])

    # option_nights should only contain nights NOT already locked
    option_nights -= locked_nights

    return {
        "total_nights":  total_nights,
        "locked_nights": locked_nights,
        "option_nights": option_nights,
        "locked_items":  locked_items,
        "option_items":  acc_options,
    }


async def check_gaps(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat

    # Resolve full trip_data (needs dates, not just id)
    trip_data = None
    if chat.type in ["group", "supergroup"]:
        trip_q = await _safe_db_call(
            lambda: supabase.table("trips")
            .select("id, start_date, end_date, title")
            .eq("group_chat_id", chat.id)
            .execute()
        )
        if trip_q is None:
            await _send_db_error_message(update, context)
            return
        if not trip_q.data:
            await update.message.reply_text("This group isn't linked to a trip yet!")
            return
        trip_data = trip_q.data[0]
    else:
        db_user_id = await get_db_user_id(update.effective_user.id)
        if not db_user_id:
            return
        rsvp_q = await _safe_db_call(
            lambda: supabase.table("rsvps")
            .select("trip_id")
            .eq("user_id", db_user_id)
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        if rsvp_q is None:
            await _send_db_error_message(update, context)
            return
        if not rsvp_q.data:
            return
        trip_id = rsvp_q.data[0]["trip_id"]
        trip_q = await _safe_db_call(
            lambda: supabase.table("trips")
            .select("id, start_date, end_date, title")
            .eq("id", trip_id)
            .single()
            .execute()
        )
        if trip_q is None:
            await _send_db_error_message(update, context)
            return
        trip_data = trip_q.data

    coverage = await _accommodation_coverage(trip_data["id"], trip_data)
    if coverage is None:
        await update.message.reply_text("⚠️ Couldn't fetch accommodation data. Please try again.")
        return

    main_start = datetime.strptime(trip_data["start_date"], "%Y-%m-%d").date()
    main_end   = datetime.strptime(trip_data["end_date"],   "%Y-%m-%d").date()

    total_nights  = coverage["total_nights"]
    locked_nights = coverage["locked_nights"]
    option_nights = coverage["option_nights"]
    locked_items  = coverage["locked_items"]

    bare_gaps     = sorted(total_nights - locked_nights - option_nights)
    options_only  = sorted(option_nights)   # has options, not locked
    fully_locked  = sorted(locked_nights)

    # ── Header ──────────────────────────────────────────────────────────────
    message = (
        f"🔎 <b>Accommodation Check: {trip_data['title']}</b>\n"
        f"Trip: {main_start.strftime('%b %d')} – {main_end.strftime('%b %d')}"
        f" ({len(total_nights)} night{'s' if len(total_nights) != 1 else ''})\n\n"
    )

    # ── Locked items ─────────────────────────────────────────────────────────
    if locked_items:
        message += "🔒 <b>Locked in:</b>\n"
        for item in locked_items:
            s = datetime.strptime(item["start_date"], "%Y-%m-%d").strftime("%b %d")
            e = datetime.strptime(item["end_date"],   "%Y-%m-%d").strftime("%b %d")
            message += f"  🏠 {item['title']}: {s} – {e}\n"
        message += "\n"

    # ── Three-state summary ───────────────────────────────────────────────────
    if not bare_gaps and not options_only:
        message += "✅ <b>All nights are locked in — you're sorted!</b>"

    elif not bare_gaps and options_only:
        message += (
            "🟡 <b>All nights have at least one option pitched, but nothing is locked yet.</b>\n"
            "Nights still needing a lock:\n"
        )
        for night in options_only:
            message += f"  • {night.strftime('%a, %b %d')} — options pitched, use /vote!\n"

    else:
        if bare_gaps:
            message += "🚨 <b>Nights with zero options pitched:</b>\n"
            for night in bare_gaps:
                message += f"  • {night.strftime('%a, %b %d')}\n"
            message += "\n"
        if options_only:
            message += "🟡 <b>Nights with options but not locked:</b>\n"
            for night in options_only:
                message += f"  • {night.strftime('%a, %b %d')} — use /vote to decide!\n"

    await update.message.reply_text(message, parse_mode="HTML")


# ---------------------------------------------------------------------------
# /paid  (group redirect → PM wizard)
# ---------------------------------------------------------------------------

async def paid(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat

    if chat.type not in ["group", "supergroup"]:
        return await _start_wizard_pm(update, context, ACTION_PAID)

    try:
        trip_q = (
            supabase.table("trips")
            .select("id")
            .eq("group_chat_id", chat.id)
            .execute()
        )
    except Exception:
        return

    if not trip_q.data:
        return

    trip_id = trip_q.data[0]["id"]
    bot_username = context.bot.username
    url = f"https://t.me/{bot_username}?start=paid_{trip_id}"

    keyboard = [[InlineKeyboardButton("Log Expense in PM 💸", url=url)]]

    try:
        await update.message.delete()
    except Exception:
        pass

    await context.bot.send_message(
        chat_id=chat.id,
        text=f"<b>{update.effective_user.first_name}</b> is logging an expense!",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="HTML",
    )


# ---------------------------------------------------------------------------
# /ledger
# ---------------------------------------------------------------------------

async def ledger(update: Update, context: ContextTypes.DEFAULT_TYPE):
    trip_id, title = await get_trip_context(update, context)
    if not trip_id:
        return

    expenses_q = await _safe_db_call(
        lambda: supabase.table("expenses")
        .select("amount, description, users(first_name)")
        .eq("trip_id", trip_id)
        .order("created_at")
        .execute()
    )
    if expenses_q is None:
        await _send_db_error_message(update, context)
        return

    l_emoji = _UX_EMOJIS.get("ledger", "🧾")
    if not expenses_q.data:
        await update.message.reply_text(
            f"{l_emoji} <b>Shared Ledger: {_escape(title)}</b>\n\n"
            "No expenses logged yet! Use <code>/paid</code> to start.",
            parse_mode="HTML",
        )
        return

    total_spent = 0.0
    user_totals: dict[str, float] = {}
    receipt_lines = []

    for row in expenses_q.data:
        name = _escape(row["users"]["first_name"])
        amount = float(row["amount"])
        desc = _escape(row["description"])
        total_spent += amount
        user_totals[name] = user_totals.get(name, 0) + amount
        receipt_lines.append(f"• <b>{name}</b>: ${amount:.2f} ({desc})")

    message = (
        f"{l_emoji} <b>Shared Ledger: {_escape(title)}</b>\n"
        f"<b>Total Group Spend: ${total_spent:.2f}</b>\n\n"
        "📝 <b>Itemized List:</b>\n"
        + "\n".join(receipt_lines)
        + "\n\n<b>👤 Total Paid by Person:</b>\n"
    )
    for name, total in sorted(user_totals.items(), key=lambda x: x[1], reverse=True):
        message += f"• <b>{name}</b>: ${total:.2f}\n"

    await update.message.reply_text(message, parse_mode="HTML")


# ---------------------------------------------------------------------------
# /settle
# ---------------------------------------------------------------------------

async def settle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    trip_id, _ = await get_trip_context(update, context)
    if not trip_id:
        return

    roster_q = await _safe_db_call(
        lambda: supabase.table("rsvps")
        .select("user_id, users(first_name)")
        .eq("trip_id", trip_id)
        .eq("status", "Committed")
        .execute()
    )
    if roster_q is None:
        await _send_db_error_message(update, context)
        return

    if not roster_q.data:
        await update.message.reply_text(
            "There are no 'Committed' members on this trip yet to split costs with!"
        )
        return

    balances = {
        row["user_id"]: {"name": row["users"]["first_name"], "paid": 0.0}
        for row in roster_q.data
    }
    num_people = len(balances)

    expenses_q = await _safe_db_call(
        lambda: supabase.table("expenses")
        .select("paid_by, amount")
        .eq("trip_id", trip_id)
        .execute()
    )
    if expenses_q is None:
        await _send_db_error_message(update, context)
        return

    for exp in expenses_q.data:
        payer_id = exp["paid_by"]
        if payer_id in balances:
            balances[payer_id]["paid"] += float(exp["amount"])

    total_spent = sum(b["paid"] for b in balances.values())
    if total_spent == 0:
        await update.message.reply_text(
            "The group hasn't spent any money yet. You're all settled!"
        )
        return

    split_amount = total_spent / num_people

    debtors = []
    creditors = []
    for uid, data in balances.items():
        net = data["paid"] - split_amount
        if net > 0.01:
            creditors.append({"name": data["name"], "amount": net})
        elif net < -0.01:
            debtors.append({"name": data["name"], "amount": abs(net)})

    # FIX: Sort both lists for the optimal (minimum-transactions) greedy match
    debtors.sort(key=lambda x: x["amount"], reverse=True)
    creditors.sort(key=lambda x: x["amount"], reverse=True)

    transactions = []
    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        debtor = debtors[i]
        creditor = creditors[j]
        amount_to_pay = min(debtor["amount"], creditor["amount"])
        transactions.append(
            f"• <b>{_escape(debtor['name'])}</b> owes <b>{_escape(creditor['name'])}</b>: ${amount_to_pay:.2f}"
        )
        debtor["amount"] -= amount_to_pay
        creditor["amount"] -= amount_to_pay
        if debtor["amount"] < 0.01:
            i += 1
        if creditor["amount"] < 0.01:
            j += 1

    message = (
        f"⚖️ <b>Time to Settle Up!</b>\n\n"
        f"<b>Total Group Spend:</b> ${total_spent:.2f}\n"
        f"<b>Per Person Split ({num_people} people):</b> ${split_amount:.2f}\n\n"
    )
    if not transactions:
        message += "✅ <b>Everyone is perfectly even!</b>"
    else:
        message += "👇 <b>How to balance the books:</b>\n" + "\n".join(transactions)

    await update.message.reply_text(message, parse_mode="HTML")


# ---------------------------------------------------------------------------
# /budget
# ---------------------------------------------------------------------------

async def budget(update: Update, context: ContextTypes.DEFAULT_TYPE):
    trip_id, title = await get_trip_context(update, context)
    if not trip_id:
        return

    trip_q = await _safe_db_call(
        lambda: supabase.table("trips")
        .select("base_currency")
        .eq("id", trip_id)
        .single()
        .execute()
    )
    if trip_q is None:
        await _send_db_error_message(update, context)
        return
    base_currency = trip_q.data.get("base_currency") or "USD"

    roster_q = await _safe_db_call(
        lambda: supabase.table("rsvps")
        .select("id")
        .eq("trip_id", trip_id)
        .eq("status", "Committed")
        .execute()
    )
    if roster_q is None:
        await _send_db_error_message(update, context)
        return

    num_committed = len(roster_q.data)
    if num_committed == 0:
        await update.message.reply_text(
            "Cannot calculate budget: No one is marked as 'Committed' yet!"
        )
        return

    itin_q = await _safe_db_call(
        lambda: supabase.table("master_itinerary")
        .select("title, cost_type, estimated_cost, currency")
        .eq("trip_id", trip_id)
        .execute()
    )
    if itin_q is None:
        await _send_db_error_message(update, context)
        return

    b_emoji = _UX_EMOJIS.get("budget", "📊")
    if not itin_q.data:
        await update.message.reply_text(
            f"{b_emoji} <b>Shared Budget: {_escape(title)}</b>\n\n"
            "No costs locked into the itinerary yet. Use <code>/lock_master</code> to build the budget!",
            parse_mode="HTML",
        )
        return

    # Fetch FX rates if any item has a foreign currency
    needs_fx = any(
        (i.get("currency") or base_currency).upper() != base_currency.upper()
        for i in itin_q.data
    )
    rates = await _get_exchange_rates(context.bot_data) if needs_fx else None

    group_total    = 0.0
    per_person_total = 0.0
    breakdown_lines  = []
    has_approx       = False
    fx_notes: list[str] = []

    for item in itin_q.data:
        raw_cost = item.get("estimated_cost") or 0.0
        if raw_cost == 0:
            continue

        item_cur  = (item.get("currency") or base_currency).upper()
        base_cur  = base_currency.upper()
        cost      = float(raw_cost)
        orig_note = ""

        if item_cur != base_cur:
            converted = _convert(cost, item_cur, base_cur, rates) if rates else None
            if converted is not None:
                orig_note = f" <i>({_fmt(cost, item_cur)})</i>"
                cost      = converted
                if item_cur not in [n.split("→")[0].strip() for n in fx_notes]:
                    rate_val = rates.get(item_cur, 0)
                    base_val = rates.get(base_cur, 1)
                    if rate_val:
                        display_rate = base_val / rate_val
                        fx_notes.append(f"1 {item_cur} ≈ {_fmt(display_rate, base_cur)}")
            else:
                orig_note  = f" <i>(rate unavailable)</i>"
                has_approx = True

        if item["cost_type"] == "Group":
            group_total += cost
            split_cost   = cost / num_committed
            breakdown_lines.append(
                f"• <b>{_escape(item['title'])}</b>: {_fmt(cost, base_currency)} total{orig_note}"
                f" ({_fmt(split_cost, base_currency)}/pp)"
            )
        elif item["cost_type"] == "Per Person":
            per_person_total += cost
            breakdown_lines.append(
                f"• <b>{_escape(item['title'])}</b>: {_fmt(cost, base_currency)}/pp{orig_note}"
            )

    group_split   = group_total / num_committed
    grand_total   = group_split + per_person_total
    base_sym      = _ISO_TO_SYMBOL.get(base_currency, base_currency)

    message = (
        f"{b_emoji} <b>Estimated Budget: {_escape(title)}</b>\n"
        f"<i>({num_committed} committed travelers · base currency: {base_currency} {base_sym})</i>\n\n"
        f"<b>Group Shared Costs:</b> {_fmt(group_total, base_currency)}\n"
        "<b>Per Person Breakdown:</b>\n"
    )
    message += "\n".join(breakdown_lines) if breakdown_lines else "No costs entered yet."
    message += (
        f"\n\n🔥 <b>Est. Total Per Person: {_fmt(grand_total, base_currency)}</b>"
    )
    if fx_notes:
        message += "\n\n💱 <i>Exchange rates used: " + " · ".join(fx_notes) + "</i>"
    if has_approx:
        message += "\n<i>⚠️ Some items couldn't be converted — shown in original currency</i>"
    message += (
        "\n\n<i>(Estimates only. Use Spliit or Splitwise for exact tracking.)</i>"
    )

    await update.message.reply_text(message, parse_mode="HTML")


# ---------------------------------------------------------------------------
# /itinerary
# ---------------------------------------------------------------------------

async def itinerary(update: Update, context: ContextTypes.DEFAULT_TYPE):
    trip_id, title = await get_trip_context(update, context)
    if not trip_id:
        return

    itin_q = await _safe_db_call(
        lambda: supabase.table("master_itinerary")
        .select("*")
        .eq("trip_id", trip_id)
        .order("start_date")
        .execute()
    )
    if itin_q is None:
        await _send_db_error_message(update, context)
        return

    i_emoji = _UX_EMOJIS.get("itinerary", "📅")
    if not itin_q.data:
        await update.message.reply_text(
            f"{i_emoji} <b>Itinerary for {_escape(title)}</b>\n\n"
            "Nothing locked in yet! Use <code>/lock_master</code> to start building the schedule.",
            parse_mode="HTML",
        )
        return

    message = f"{i_emoji} <b>Official Itinerary: {_escape(title)}</b>\n\n"

    for item in itin_q.data:
        cat = item["category"].capitalize()
        name = item["title"]
        s_date = datetime.strptime(item["start_date"], "%Y-%m-%d").strftime("%b %d")
        e_date = datetime.strptime(item["end_date"], "%Y-%m-%d").strftime("%b %d")
        emoji = _UX_EMOJIS.get(item["category"].lower(), "📍")

        if s_date == e_date:
            message += f"{emoji} <b>{_escape(cat)}:</b> {_escape(name)}\n📅 {s_date}\n\n"
        else:
            message += f"{emoji} <b>{_escape(cat)}:</b> {_escape(name)}\n📅 {s_date} to {e_date}\n\n"

    await update.message.reply_text(message, parse_mode="HTML")


# ---------------------------------------------------------------------------
# /delete_option
# ---------------------------------------------------------------------------

async def delete_option(update: Update, context: ContextTypes.DEFAULT_TYPE):
    raw_text = " ".join(context.args)
    parts = [p.strip() for p in raw_text.split("-")]

    if len(parts) != 2:
        await update.message.reply_text(
            "⚠️ Usage: <code>/delete_option &lt;category&gt; - &lt;Option Name&gt;</code>\n"
            "Example: <code>/delete_option accommodation - The Lamehouse</code>",
            parse_mode="HTML",
        )
        return

    category = parts[0].lower()
    option_text = parts[1]

    trip_id, _ = await get_trip_context(update, context)
    if not trip_id:
        return

    try:
        response = (
            supabase.table("poll_options")
            .delete()
            .eq("trip_id", trip_id)
            .eq("category", category)
            .eq("option_text", option_text)
            .execute()
        )
    except Exception:
        await update.message.reply_text(
            "⚠️ Couldn't delete the option right now. Please try again."
        )
        return

    if not response.data:
        await update.message.reply_text(
            f"❌ Couldn't find <b>{option_text}</b> in the {category} list. "
            "Make sure the spelling is exact!",
            parse_mode="HTML",
        )
    else:
        await update.message.reply_text(
            f"🗑️ Deleted <b>{option_text}</b> from the {category} options.",
            parse_mode="HTML",
        )


# ---------------------------------------------------------------------------
# /remove_itinerary
# ---------------------------------------------------------------------------

async def remove_itinerary(update: Update, context: ContextTypes.DEFAULT_TYPE):
    raw_text = " ".join(context.args)
    parts = [p.strip() for p in raw_text.split("-")]

    if len(parts) != 2:
        await update.message.reply_text(
            "⚠️ Usage: <code>/remove_itinerary &lt;category&gt; - &lt;Title&gt;</code>\n"
            "Example: <code>/remove_itinerary accommodation - The Beach House</code>",
            parse_mode="HTML",
        )
        return

    category = parts[0].lower()
    title = parts[1]

    trip_id, _ = await get_trip_context(update, context)
    if not trip_id:
        return

    try:
        response = (
            supabase.table("master_itinerary")
            .delete()
            .eq("trip_id", trip_id)
            .eq("category", category)
            .eq("title", title)
            .execute()
        )
    except Exception:
        await update.message.reply_text(
            "⚠️ Couldn't remove the item right now. Please try again."
        )
        return

    if not response.data:
        await update.message.reply_text(
            f"❌ Couldn't find <b>{title}</b> in the locked {category} itinerary. "
            "Check your spelling!",
            parse_mode="HTML",
        )
    else:
        await update.message.reply_text(
            f"🗑️ Removed <b>{title}</b> from the official itinerary. The schedule has been updated.",
            parse_mode="HTML",
        )


async def polls(update: Update, context: ContextTypes.DEFAULT_TYPE):
    trip_id, trip_title = await get_trip_context(update, context)
    if not trip_id:
        return

    active_q = await _safe_db_call(
        lambda: supabase.table("active_polls")
        .select("telegram_poll_id, category, poll_options_json")
        .eq("trip_id", trip_id)
        .execute()
    )
    if active_q is None:
        await update.message.reply_text(
            "⚠️ <b>Database Connection Issue</b>\n\nCouldn't load active polls right now.",
            parse_mode="HTML"
        )
        return

    if not active_q.data:
        await update.message.reply_text(
            "🗳️ <b>Active Polls</b>\n\nThere are no active polls for this trip right now.",
            parse_mode="HTML"
        )
        return

    lines = [f"🗳️ <b>Active Poll Results for {trip_title}</b>\n"]

    for poll_record in active_q.data:
        poll_id = poll_record["telegram_poll_id"]
        category = poll_record["category"]
        options_meta = poll_record.get("poll_options_json") or []

        try:
            telegram_poll = await context.bot.get_poll(poll_id)
        except Exception:
            continue

        category_emoji = _UX_EMOJIS.get(category.lower(), "✨")
        lines.append(f"{category_emoji} <b>{category.capitalize()} Poll:</b>")

        total_votes = sum(option.voter_count for option in telegram_poll.options)

        for option in telegram_poll.options:
            orig_text = option.text
            for meta in options_meta:
                if meta["index"] == option.position:
                    orig_text = meta["text"]
                    break

            percent = (option.voter_count / total_votes * 100) if total_votes > 0 else 0
            lines.append(f" • <b>{_escape(orig_text)}</b>: {option.voter_count} vote{'s' if option.voter_count != 1 else ''} ({percent:.0f}%)")

        lines.append("")

    if len(lines) <= 1:
        await update.message.reply_text(
            "🗳️ <b>Active Polls</b>\n\nCould not fetch active poll details from Telegram (they might have expired).",
            parse_mode="HTML"
        )
        return

    await update.message.reply_text("\n".join(lines).strip(), parse_mode="HTML")


# ---------------------------------------------------------------------------
# PM Wizard: Add Option Flow
# ---------------------------------------------------------------------------

async def wiz_addopt_cat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["wiz_cat"] = update.message.text.lower()
    await update.message.reply_text(
        "Got it. Now, what's the name or title of this option?\n(e.g., <i>The Beach House</i>)",
        reply_markup=ReplyKeyboardRemove(),
        parse_mode="HTML",
    )
    return ADD_OPT_NAME


async def wiz_addopt_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["wiz_name"] = update.message.text
    await update.message.reply_text(
        "Add a brief description for this option (optional):",
        reply_markup=ReplyKeyboardMarkup(
            [["Skip description"]], one_time_keyboard=True, resize_keyboard=True
        ),
        parse_mode="HTML",
    )
    return ADD_OPT_DESC


async def wiz_addopt_desc(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_input = update.message.text.strip()
    if user_input.lower() in ("skip", "skip description"):
        context.user_data["wiz_desc"] = None
    else:
        context.user_data["wiz_desc"] = user_input

    await update.message.reply_text(
        "What are the specific dates for this?\n"
        "Example: <code>15 June to 18 June 2026</code>, <code>15-18</code>, or <code>Day 1 to Day 3</code>.",
        reply_markup=ReplyKeyboardMarkup(
            [["Skip dates"]], one_time_keyboard=True, resize_keyboard=True
        ),
        parse_mode="HTML",
    )
    return ADD_OPT_DATES


async def wiz_addopt_dates(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_input = update.message.text.strip().lower()
    trip_id = context.user_data["wiz_trip_id"]

    start_date, end_date = None, None
    if user_input not in ("skip", "skip dates"):
        try:
            trip_q = (
                supabase.table("trips")
                .select("start_date, end_date")
                .eq("id", trip_id)
                .single()
                .execute()
            )
            t_start = trip_q.data["start_date"]
            t_end = trip_q.data["end_date"]
        except Exception:
            await update.message.reply_text(
                "⚠️ Couldn't fetch trip dates. Please try again."
            )
            return ADD_OPT_DATES

        start_date, end_date = smart_parse_dates(user_input, t_start, t_end)
        if not start_date or not end_date:
            await update.message.reply_text(
                "❌ I couldn't understand those dates.\n"
                "Try <code>15-18</code>, <code>Day 1 to Day 3</code>, or tap Skip.",
                reply_markup=ReplyKeyboardMarkup(
                    [["Skip dates"]], one_time_keyboard=True, resize_keyboard=True
                ),
                parse_mode="HTML",
            )
            return ADD_OPT_DATES

    context.user_data["wiz_start"] = start_date
    context.user_data["wiz_end"] = end_date

    await update.message.reply_text(
        "Got it! Do you have a link for this option? (e.g., Airbnb, booking.com, Google Maps)\n\n"
        "<i>Paste the URL or tap Skip.</i>",
        reply_markup=ReplyKeyboardMarkup(
            [["Skip link"]], one_time_keyboard=True, resize_keyboard=True
        ),
        parse_mode="HTML",
    )
    return ADD_OPT_LINK


async def wiz_addopt_link(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_input = update.message.text.strip()
    link = None if user_input.lower() in ("skip", "skip link") else user_input
    context.user_data["wiz_link"] = link

    # Fetch the trip's base currency so we can show it as the default
    trip_id = context.user_data["wiz_trip_id"]
    try:
        tq = (
            supabase.table("trips")
            .select("base_currency")
            .eq("id", trip_id)
            .single()
            .execute()
        )
        base_currency = tq.data.get("base_currency") or "USD"
    except Exception:
        base_currency = "USD"
    context.user_data["wiz_base_currency"] = base_currency

    sym = _ISO_TO_SYMBOL.get(base_currency, base_currency)
    await update.message.reply_text(
        f"What's the estimated total price?\n\n"
        f"• Just a number → treated as <b>{base_currency}</b> ({sym})\n"
        f"• With a code or symbol → e.g. <code>800 EUR</code>, <code>€1200</code>, <code>£450</code>\n\n"
        "<i>Tap Skip if you don't have a price yet.</i>",
        reply_markup=ReplyKeyboardMarkup(
            [["Skip price"]], one_time_keyboard=True, resize_keyboard=True
        ),
        parse_mode="HTML",
    )
    return ADD_OPT_PRICE


async def wiz_addopt_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_input    = update.message.text.strip()
    base_currency = context.user_data.get("wiz_base_currency", "USD")

    estimated_cost = None
    currency       = base_currency

    if user_input.lower() not in ("skip", "skip price"):
        estimated_cost, currency = _parse_price_and_currency(user_input, base_currency)
        if estimated_cost is None or estimated_cost < 0:
            sym = _ISO_TO_SYMBOL.get(base_currency, base_currency)
            await update.message.reply_text(
                f"❌ Please enter a valid amount (e.g. <code>800</code> or <code>800 EUR</code> or <code>€1200</code>) or tap Skip.\n"
                f"<i>No currency = {base_currency} ({sym})</i>",
                reply_markup=ReplyKeyboardMarkup(
                    [["Skip price"]], one_time_keyboard=True, resize_keyboard=True
                ),
                parse_mode="HTML",
            )
            return ADD_OPT_PRICE

    trip_id = context.user_data["wiz_trip_id"]
    cat = context.user_data["wiz_cat"]
    name = context.user_data["wiz_name"]
    start_date = context.user_data["wiz_start"]
    end_date = context.user_data["wiz_end"]
    link = context.user_data.get("wiz_link")

    db_user_id = await get_db_user_id(update.effective_user.id)
    if not db_user_id:
        await update.message.reply_text("⚠️ Couldn't find your account. Please try again.")
        return ConversationHandler.END

    res = await _safe_db_call(
        lambda: supabase.table("poll_options").insert(
            {
                "trip_id":        trip_id,
                "category":       cat,
                "option_text":    name,
                "start_date":     start_date.isoformat() if start_date else None,
                "end_date":       end_date.isoformat() if end_date else None,
                "link":           link,
                "description":    context.user_data.get("wiz_desc"),
                "estimated_cost": estimated_cost,
                "currency":       currency if estimated_cost is not None else None,
                "added_by":       db_user_id,
            }
        ).execute()
    )
    if res is None:
        await _send_db_error_message(update, context)
        return ConversationHandler.END

    # Build a summary for the user
    summary_parts = [f"✅ <b>Option Pitch Saved!</b>\n<b>{_escape(name)}</b> has been saved."]
    if start_date:
        s = start_date.strftime("%b %d")
        e = end_date.strftime("%b %d")
        summary_parts.append(f"📅 {s} – {e}")
    if estimated_cost is not None:
        summary_parts.append(f"💰 {_fmt(estimated_cost, currency)}")
    if link:
        summary_parts.append(f"🔗 {link}")
    summary_parts.append("I'll let the group know!")

    await update.message.reply_text(
        "\n".join(summary_parts),
        reply_markup=ReplyKeyboardRemove(),
        parse_mode="HTML",
    )

    # Announce to group
    try:
        group_q = (
            supabase.table("trips")
            .select("group_chat_id, start_date, end_date, title")
            .eq("id", trip_id)
            .execute()
        )
        if group_q.data and group_q.data[0]["group_chat_id"]:
            group_chat_id = group_q.data[0]["group_chat_id"]
            trip_row = group_q.data[0]
            first_name = update.effective_user.first_name

            date_str = (
                f" ({start_date.strftime('%b %d')} – {end_date.strftime('%b %d')})"
                if start_date else ""
            )
            price_str = f"\n💰 Est. cost: <b>${estimated_cost:,.2f}</b>" if estimated_cost is not None else ""
            link_str = f"\n🔗 <a href='{link}'>View listing</a>" if link else ""

            announcement = (
                f"💡 <b>New Idea from {first_name}!</b>\n"
                f"<b>{name}</b> ({cat.capitalize()}){date_str}"
                f"{price_str}{link_str}"
            )

            # ── Accommodation coverage nudge ──────────────────────────────
            if cat.lower() in _NIGHT_BASED_CATS:
                coverage = await _accommodation_coverage(trip_id, trip_row)
                if coverage:
                    total   = coverage["total_nights"]
                    locked  = coverage["locked_nights"]
                    options = coverage["option_nights"]
                    gaps    = sorted(total - locked - options)
                    opt_only = sorted(options)

                    if not gaps and not opt_only:
                        # Every night is locked
                        announcement += (
                            "\n\n✅ <b>All nights are fully locked in — you're sorted!</b>"
                        )
                    elif not gaps and opt_only:
                        # All nights covered by options, nothing locked yet
                        announcement += (
                            "\n\n🟡 <b>All nights now have at least one option!</b>\n"
                            "Nothing is locked yet though — use /vote to pick a winner "
                            "and /lock_master to confirm it."
                        )
                    else:
                        # Still bare gaps
                        gap_strs = ", ".join(n.strftime("%b %d") for n in gaps)
                        announcement += (
                            f"\n\n🚨 <b>Still no options for:</b> {gap_strs}\n"
                            "Keep pitching ideas to cover every night!"
                        )

            # ── First-option milestone nudge ──────────────────────────────
            options_q = (
                supabase.table("poll_options")
                .select("id")
                .eq("trip_id", trip_id)
                .execute()
            )
            if len(options_q.data) == 1:
                announcement += (
                    "\n\n🎓 <b>Pro Tip:</b> Keep adding options, then use "
                    "<code>/vote</code> to let the group decide!"
                )

            await context.bot.send_message(
                chat_id=group_chat_id, text=announcement,
                parse_mode="HTML", disable_web_page_preview=True,
            )
    except Exception:
        pass  # Non-fatal

    return ConversationHandler.END


# ---------------------------------------------------------------------------
# PM Wizard: Log Expense Flow
# ---------------------------------------------------------------------------

async def wiz_paid_amount(update: Update, context: ContextTypes.DEFAULT_TYPE):
    amount_text = update.message.text.replace("$", "").strip()
    try:
        amount = float(amount_text)
        if amount <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text(
            "❌ Please enter a valid number greater than 0 (e.g., <code>45.50</code>).",
            parse_mode="HTML",
        )
        return PAID_AMOUNT

    context.user_data["wiz_amount"] = amount
    await update.message.reply_text(
        "Great. What was this for?\n(e.g., <i>Uber to the airport</i>, <i>Dinner at Mario's</i>)",
        parse_mode="HTML",
    )
    return PAID_DESC


async def wiz_paid_desc(update: Update, context: ContextTypes.DEFAULT_TYPE):
    desc = update.message.text.strip()
    trip_id = context.user_data["wiz_trip_id"]
    amount = context.user_data["wiz_amount"]

    db_user_id = await get_db_user_id(update.effective_user.id)
    if not db_user_id:
        await update.message.reply_text("⚠️ Couldn't find your account. Please try again.")
        return ConversationHandler.END

    res = await _safe_db_call(
        lambda: supabase.table("expenses").insert(
            {
                "trip_id": trip_id,
                "paid_by": db_user_id,
                "amount": amount,
                "description": desc,
            }
        ).execute()
    )
    if res is None:
        await _send_db_error_message(update, context)
        return ConversationHandler.END

    await update.message.reply_text(
        f"✅ <b>Expense Logged!</b>\nYou logged ${amount:.2f} for <b>{_escape(desc)}</b>.",
        parse_mode="HTML"
    )

    # Announce to group
    group_q = await _safe_db_call(
        lambda: supabase.table("trips")
        .select("group_chat_id")
        .eq("id", trip_id)
        .execute()
    )
    if group_q and group_q.data and group_q.data[0]["group_chat_id"]:
        try:
            await context.bot.send_message(
                chat_id=group_q.data[0]["group_chat_id"],
                text=(
                    f"💸 <b>Expense Logged!</b>\n"
                    f"{update.effective_user.first_name} paid "
                    f"<b>${amount:.2f}</b> for {desc}."
                ),
                parse_mode="HTML",
            )
        except Exception:
            pass  # Non-fatal

    return ConversationHandler.END


# ---------------------------------------------------------------------------
# PM Wizard: Lock Itinerary Flow
# ---------------------------------------------------------------------------

async def wiz_lock_cat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["wiz_cat"] = update.message.text.lower()
    await update.message.reply_text(
        "What is the name or title of this booking?\n"
        "(e.g., <i>The Beach House</i>, <i>Delta Flight 102</i>)",
        reply_markup=ReplyKeyboardRemove(),
        parse_mode="HTML",
    )
    return LOCK_TITLE


async def wiz_lock_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["wiz_title"] = update.message.text.strip()
    await update.message.reply_text(
        "When is it? Please use the exact format:\n"
        "<code>15 June to 18 June 2026</code>\n\n"
        "<i>(For a one-day event like a flight, use the same date twice: "
        "<code>15 June to 15 June 2026</code>)</i>",
        parse_mode="HTML",
    )
    return LOCK_DATES


async def wiz_lock_dates(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_input = update.message.text.strip()
    trip_id = context.user_data["wiz_trip_id"]

    try:
        trip_q = (
            supabase.table("trips")
            .select("start_date, end_date")
            .eq("id", trip_id)
            .single()
            .execute()
        )
        t_start = trip_q.data["start_date"]
        t_end = trip_q.data["end_date"]
    except Exception:
        await update.message.reply_text(
            "⚠️ Couldn't fetch trip dates. Please try again."
        )
        return LOCK_DATES

    start_date, end_date = smart_parse_dates(user_input, t_start, t_end)

    if not start_date or not end_date:
        await update.message.reply_text(
            "❌ I couldn't find those dates in your trip window.\n"
            "Try just the days (e.g., <code>15-18</code>), or <code>Day 1 to Day 3</code>.",
            parse_mode="HTML",
        )
        return LOCK_DATES

    context.user_data["wiz_start"] = start_date
    context.user_data["wiz_end"] = end_date

    reply_markup = ReplyKeyboardMarkup(
        [["Group Cost", "Per Person Cost"], ["Skip Cost"]],
        one_time_keyboard=True,
        resize_keyboard=True,
    )
    await update.message.reply_text(
        "💰 How is this priced? Is it a total group cost (like an Airbnb) "
        "or a per-person cost (like a flight)?",
        reply_markup=reply_markup,
    )
    return LOCK_COST_TYPE


async def wiz_lock_cost_type(update: Update, context: ContextTypes.DEFAULT_TYPE):
    choice = update.message.text
    if choice == "Skip Cost":
        context.user_data["wiz_cost_type"]     = "None"
        context.user_data["wiz_cost"]          = 0.0
        context.user_data["wiz_cost_currency"] = None
        return await finalize_lock(update, context)

    context.user_data["wiz_cost_type"] = "Group" if "Group" in choice else "Per Person"

    # Fetch trip base currency to show as default in prompt
    trip_id = context.user_data["wiz_trip_id"]
    try:
        tq = (
            supabase.table("trips")
            .select("base_currency")
            .eq("id", trip_id)
            .single()
            .execute()
        )
        base_currency = tq.data.get("base_currency") or "USD"
    except Exception:
        base_currency = "USD"
    context.user_data["wiz_base_currency"] = base_currency

    sym = _ISO_TO_SYMBOL.get(base_currency, base_currency)
    await update.message.reply_text(
        f"What's the estimated amount?\n\n"
        f"• Just a number → treated as <b>{base_currency}</b> ({sym})\n"
        f"• With a code or symbol → e.g. <code>1200 EUR</code>, <code>€800</code>",
        reply_markup=ReplyKeyboardRemove(),
        parse_mode="HTML",
    )
    return LOCK_COST


async def wiz_lock_cost(update: Update, context: ContextTypes.DEFAULT_TYPE):
    base_currency = context.user_data.get("wiz_base_currency", "USD")
    cost, currency = _parse_price_and_currency(update.message.text, base_currency)

    if cost is None or cost < 0:
        await update.message.reply_text(
            "❌ Please enter a valid amount (e.g. <code>1200</code> or <code>1200 EUR</code>).",
            parse_mode="HTML",
        )
        return LOCK_COST

    context.user_data["wiz_cost"]          = cost
    context.user_data["wiz_cost_currency"] = currency
    return await finalize_lock(update, context)


async def _build_budget_snapshot(trip_id: str, bot_data: dict | None = None) -> str | None:
    """
    Returns a compact budget snapshot string from master_itinerary.
    Converts non-base-currency costs using live FX rates when available.
    """
    try:
        trip_q = (
            supabase.table("trips")
            .select("base_currency")
            .eq("id", trip_id)
            .single()
            .execute()
        )
        base_currency = trip_q.data.get("base_currency") or "USD"

        roster_q = (
            supabase.table("rsvps")
            .select("id")
            .eq("trip_id", trip_id)
            .eq("status", "Committed")
            .execute()
        )
        num_committed = len(roster_q.data) or 1

        itin_q = (
            supabase.table("master_itinerary")
            .select("title, category, cost_type, estimated_cost, currency, start_date, end_date")
            .eq("trip_id", trip_id)
            .execute()
        )
    except Exception:
        return None

    items = [i for i in (itin_q.data or []) if (i.get("estimated_cost") or 0) > 0]
    if not items:
        return None

    # Fetch rates if bot_data is available and any item has a foreign currency
    rates = None
    needs_fx = any(
        (i.get("currency") or base_currency).upper() != base_currency.upper()
        for i in items
    )
    if needs_fx and bot_data is not None:
        rates = await _get_exchange_rates(bot_data)

    base_sym = _ISO_TO_SYMBOL.get(base_currency, base_currency)
    lines    = [f"💰 <b>Budget snapshot ({base_currency}):</b>"]
    total_pp = 0.0
    has_approx = False

    for item in items:
        raw_cost = float(item["estimated_cost"])
        item_cur = (item.get("currency") or base_currency).upper()
        cost     = raw_cost
        approx   = ""

        if item_cur != base_currency.upper():
            converted = _convert(raw_cost, item_cur, base_currency, rates) if rates else None
            if converted is not None:
                cost   = converted
                approx = f" <i>({_fmt(raw_cost, item_cur)})</i>"
            else:
                approx     = f" <i>({_fmt(raw_cost, item_cur)}, rate unavailable)</i>"
                has_approx = True

        cat  = item["category"].capitalize()
        name = item["title"]

        if item["cost_type"] == "Group":
            pp = cost / num_committed
            total_pp += pp
            if (
                item["category"].lower() in _NIGHT_BASED_CATS
                and item["start_date"] and item["end_date"]
            ):
                nights = (
                    datetime.strptime(item["end_date"],   "%Y-%m-%d").date()
                    - datetime.strptime(item["start_date"], "%Y-%m-%d").date()
                ).days
                pn = cost / nights if nights > 0 else 0
                lines.append(
                    f"  🏠 {name}: {_fmt(cost, base_currency)} total{approx}"
                    f" · <b>{_fmt(pp, base_currency)}/pp</b>"
                    f" · {_fmt(pn, base_currency)}/night"
                )
            else:
                lines.append(
                    f"  📌 {name} ({cat}): {_fmt(cost, base_currency)} total{approx}"
                    f" · <b>{_fmt(pp, base_currency)}/pp</b>"
                )
        else:
            total_pp += cost
            lines.append(
                f"  📌 {name} ({cat}): <b>{_fmt(cost, base_currency)}/pp</b>{approx}"
            )

    lines.append("  ─────────────────────")
    lines.append(
        f"  📊 <b>Est. total: {_fmt(total_pp, base_currency)}/person</b>"
        f"  <i>({num_committed} traveler{'s' if num_committed != 1 else ''})</i>"
    )
    if has_approx:
        lines.append("  <i>⚠️ Some rates unavailable — amounts shown in original currency</i>")
    return "\n".join(lines)


async def finalize_lock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    trip_id    = context.user_data["wiz_trip_id"]
    cat        = context.user_data["wiz_cat"]
    title      = context.user_data["wiz_title"]
    start_date = context.user_data["wiz_start"]
    end_date   = context.user_data["wiz_end"]
    cost_type     = context.user_data["wiz_cost_type"]
    cost          = context.user_data["wiz_cost"]
    cost_currency = context.user_data.get("wiz_cost_currency") or context.user_data.get("wiz_base_currency") or "USD"

    db_user_id = await get_db_user_id(update.effective_user.id)
    if not db_user_id:
        await update.message.reply_text("⚠️ Couldn't find your account. Please try again.")
        return ConversationHandler.END

    # ── Snapshot coverage BEFORE insert (to detect the completion moment) ──
    is_acc = cat.lower() in _NIGHT_BASED_CATS
    pre_coverage = None
    trip_row_for_coverage = None
    if is_acc:
        tq = await _safe_db_call(
            lambda: supabase.table("trips")
            .select("id, start_date, end_date, title, organizer_id")
            .eq("id", trip_id)
            .single()
            .execute()
        )
        if tq:
            trip_row_for_coverage = tq.data
            try:
                pre_coverage = await _accommodation_coverage(trip_id, trip_row_for_coverage)
            except Exception:
                pass

    res = await _safe_db_call(
        lambda: supabase.table("master_itinerary").insert(
            {
                "trip_id":        trip_id,
                "category":       cat,
                "title":          title,
                "start_date":     start_date.isoformat(),
                "end_date":       end_date.isoformat(),
                "cost_type":      cost_type,
                "estimated_cost": cost,
                "currency":       cost_currency if cost > 0 else None,
                "locked_by":      db_user_id,
            }
        ).execute()
    )
    if res is None:
        await _send_db_error_message(update, context)
        return ConversationHandler.END

    await update.message.reply_text(
        "✅ <b>Itinerary Item Locked!</b>\nThe budget and itinerary have been updated with your locked item.",
        parse_mode="HTML"
    )

    # ── Announce to group ──────────────────────────────────────────────────
    group_q = await _safe_db_call(
        lambda: supabase.table("trips")
        .select("group_chat_id, organizer_id")
        .eq("id", trip_id)
        .execute()
    )
    if group_q is None or not (group_q.data and group_q.data[0]["group_chat_id"]):
        return ConversationHandler.END

    try:
        group_chat_id = group_q.data[0]["group_chat_id"]
        organizer_id  = group_q.data[0].get("organizer_id")

        cost_str = f"\n💰 Est. Cost: {_fmt(cost, cost_currency)} ({cost_type})" if cost > 0 else ""
        date_str = (
            start_date.strftime("%b %d")
            if start_date == end_date
            else f"{start_date.strftime('%b %d')} to {end_date.strftime('%b %d')}"
        )
        announcement = (
            f"🔒 <b>Itinerary Update!</b>\n"
            f"{update.effective_user.first_name} just locked in "
            f"<b>{title}</b> ({cat.capitalize()}) for {date_str}!{cost_str}"
        )

        # Milestone: first locked item ever
        itin_q = (
            supabase.table("master_itinerary")
            .select("id")
            .eq("trip_id", trip_id)
            .execute()
        )
        if len(itin_q.data) == 1:
            announcement += (
                "\n\n🎓 <b>Pro Tip:</b> We have officially locked in our first plan! "
                "Use <code>/itinerary</code> to see the timeline, "
                "or <code>/budget</code> to see running cost estimates."
            )

        # ── Accommodation fully locked nudge ──────────────────────────────
        # Fires exactly once: the moment coverage goes from incomplete → complete.
        if is_acc and pre_coverage and trip_row_for_coverage:
            post_coverage = await _accommodation_coverage(trip_id, trip_row_for_coverage)
            if post_coverage:
                pre_incomplete = bool(
                    pre_coverage["total_nights"]
                    - pre_coverage["locked_nights"]
                    - pre_coverage["option_nights"]   # bare gaps existed before
                ) or bool(pre_coverage["option_nights"])  # or option-only nights existed

                post_complete = (
                    not (post_coverage["total_nights"] - post_coverage["locked_nights"])
                )

                if pre_incomplete and post_complete:
                    # Build locked-nights summary
                    locked_items = post_coverage["locked_items"]
                    nights_summary = "\n".join(
                        f"  🏠 {i['title']}: "
                        f"{datetime.strptime(i['start_date'], '%Y-%m-%d').strftime('%b %d')}"
                        f" – "
                        f"{datetime.strptime(i['end_date'], '%Y-%m-%d').strftime('%b %d')}"
                        for i in locked_items
                    )

                    budget_snapshot = await _build_budget_snapshot(trip_id, context.bot_data)

                    # What's still missing from the itinerary?
                    locked_cats = {
                        r["category"].lower()
                        for r in (itin_q.data or [])
                    }
                    all_cats  = {"accommodation", "flights", "activities", "food", "transport"}
                    missing_cats = sorted(all_cats - locked_cats)
                    missing_str = (
                        "Still to lock in: "
                        + ", ".join(c.capitalize() for c in missing_cats)
                        if missing_cats else "Everything looks locked in!"
                    )

                    nudge = (
                        f"\n\n🎉 <b>All accommodation nights are sorted!</b>\n"
                        f"{nights_summary}\n\n"
                    )
                    if budget_snapshot:
                        nudge += budget_snapshot + "\n\n"
                    nudge += (
                        f"<b>⏭️ Next steps:</b>\n"
                        f"• {missing_str}\n"
                        f"• Once everything is locked, use <code>/paid</code> "
                        f"to start logging expenses as they happen.\n"
                        f"• Run <code>/budget</code> any time for the full breakdown."
                    )
                    announcement += nudge

        await context.bot.send_message(
            chat_id=group_chat_id, text=announcement, parse_mode="HTML"
        )

    except Exception:
        pass  # Announcement failure is non-fatal

    return ConversationHandler.END


# ---------------------------------------------------------------------------
# /help
# ---------------------------------------------------------------------------

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    help_text = (
        "🧳 <b>TripSync Bot — Command Menu</b> 🧳\n\n"
        "<b>🚀 Setup &amp; RSVPs</b>\n"
        "<code>/new_trip</code> — Start a new trip (PM only)\n"
        "<code>/start</code> — Join a trip (Group only)\n"
        "<code>/roster</code> — See who is coming\n"
        "<code>/change_rsvp</code> — Update your status\n\n"
        "<b>🗳️ Voting &amp; Itinerary</b>\n"
        "<code>/add_option</code> — Suggest an idea\n"
        "<code>/vote</code> — Start a poll (guided wizard via PM)\n"
        "<code>/lock_master</code> — Lock in a winner\n"
        "<code>/itinerary</code> — View the official schedule\n"
        "<code>/check_gaps</code> — Find missing accommodation nights\n\n"
        "<b>💰 Shared Ledger</b>\n"
        "<code>/paid</code> — Log an expense\n"
        "<code>/ledger</code> — View all expenses\n"
        "<code>/settle</code> — Calculate who owes who\n"
        "<code>/budget</code> — See estimated costs per person\n\n"
        "<b>🛠️ Admin / Cleanup</b>\n"
        "<code>/delete_option &lt;category&gt; - &lt;Name&gt;</code> — Remove a suggestion\n"
        "<code>/remove_itinerary &lt;category&gt; - &lt;Title&gt;</code> — Cancel a locked booking\n"
    )
    await update.message.reply_text(help_text, parse_mode="HTML")


# ---------------------------------------------------------------------------
# Dynamic command menus  (set_my_commands)
# ---------------------------------------------------------------------------

# Commands visible to every member in a group chat
_GROUP_MEMBER_COMMANDS = [
    BotCommand("roster",       "👥 See who's coming"),
    BotCommand("change_rsvp",  "✏️ Update your RSVP"),
    BotCommand("add_option",   "💡 Pitch a new idea"),
    BotCommand("vote",         "🗳 Start a vote in the group"),
    BotCommand("check_gaps",   "🔍 Check accommodation gaps"),
    BotCommand("itinerary",    "📅 View the locked schedule"),
    BotCommand("budget",       "📊 Estimated cost per person"),
    BotCommand("paid",         "💸 Log a shared expense"),
    BotCommand("ledger",       "📒 View all expenses"),
    BotCommand("settle",       "⚖️ Calculate who owes who"),
    BotCommand("polls",        "🗳️ View active poll results"),
    BotCommand("rsvp_notes",   "📝 Add notes to your RSVP"),
    BotCommand("help",         "📋 All commands"),
]

# Extra commands visible only to the organiser in their specific group
_ORGANISER_EXTRA_COMMANDS = [
    BotCommand("lock_master",       "🔒 Lock in an itinerary item"),
    BotCommand("delete_option",     "🗑 Remove a pitched option"),
    BotCommand("remove_itinerary",  "🗑 Remove a locked item"),
]

_PM_COMMANDS = [
    BotCommand("new_trip",   "🗺 Start planning a new trip"),
    BotCommand("rsvp_notes", "📝 Add notes to your RSVP"),
    BotCommand("help",       "📋 All commands"),
    BotCommand("cancel",     "✖️ Cancel the current action"),
]


async def setup_commands_for_group(bot, group_chat_id: int, organizer_tg_id: int) -> None:
    """
    Sets the elevated organiser command scope for one specific group.
    Called whenever a group is linked to a trip, and at startup for
    all already-linked trips.
    """
    try:
        await bot.set_my_commands(
            _GROUP_MEMBER_COMMANDS + _ORGANISER_EXTRA_COMMANDS,
            scope=BotCommandScopeChatMember(
                chat_id=group_chat_id, user_id=organizer_tg_id
            ),
        )
    except Exception:
        # User may not have opened the group yet — silently skip.
        # The global group menu still applies for them.
        pass


async def _check_and_send_rsvp_nudges(bot) -> None:
    now = datetime.now(timezone.utc)
    res_trips = await _safe_db_call(
        lambda: supabase.table("trips")
        .select("id, title, group_chat_id, last_rsvp_nudge_at")
        .not_.is_("group_chat_id", "null")
        .execute()
    )
    if not res_trips or not res_trips.data:
        return

    for trip in res_trips.data:
        trip_id = trip["id"]
        title = trip["title"]
        group_chat_id = trip["group_chat_id"]
        last_nudge = trip.get("last_rsvp_nudge_at")

        should_nudge = False
        if last_nudge is None:
            should_nudge = True
        else:
            try:
                last_nudge_dt = datetime.fromisoformat(last_nudge.replace("Z", "+00:00"))
                if now - last_nudge_dt >= timedelta(hours=RSVP_NUDGE_INTERVAL_HOURS):
                    should_nudge = True
            except Exception:
                should_nudge = True

        if not should_nudge:
            continue

        res_users = await _safe_db_call(
            lambda: supabase.table("users")
            .select("id, telegram_id, first_name, username")
            .execute()
        )
        if not res_users or not res_users.data:
            continue

        res_rsvps = await _safe_db_call(
            lambda: supabase.table("rsvps")
            .select("user_id")
            .eq("trip_id", trip_id)
            .execute()
        )
        if res_rsvps is None:
            continue

        rsvp_user_ids = {r["user_id"] for r in res_rsvps.data}
        unrsvp_members = []

        for user in res_users.data:
            user_id = user["id"]
            tg_user_id = user["telegram_id"]
            if not tg_user_id:
                continue
            if user_id in rsvp_user_ids:
                continue

            try:
                chat_member = await bot.get_chat_member(chat_id=group_chat_id, user_id=tg_user_id)
                if chat_member.status in ["creator", "administrator", "member"]:
                    unrsvp_members.append(user)
            except Exception:
                continue

        if unrsvp_members:
            member_lines = []
            for u in unrsvp_members:
                name = _escape(u["first_name"])
                username = u["username"]
                if username:
                    member_lines.append(f"• <b>{name}</b> (@{_escape(username)})")
                else:
                    member_lines.append(f"• <b>{name}</b>")

            msg = (
                f"🔔 <b>Pending RSVPs for {_escape(title)}!</b>\n\n"
                f"The following group members have not RSVP'd yet:\n"
                f"{'\n'.join(member_lines)}\n\n"
                f"Please update your status using `/change_rsvp`!"
            )
            try:
                await bot.send_message(chat_id=group_chat_id, text=msg, parse_mode="HTML")
                await _safe_db_call(
                    lambda: supabase.table("trips")
                    .update({"last_rsvp_nudge_at": now.isoformat()})
                    .eq("id", trip_id)
                    .execute()
                )
            except Exception as e:
                logger.error(f"Failed to send RSVP nudge or update trip: {e}")


async def _check_and_send_poll_nudges(bot) -> None:
    now = datetime.now(timezone.utc)
    res_polls = await _safe_db_call(
        lambda: supabase.table("active_polls")
        .select("*")
        .execute()
    )
    if not res_polls or not res_polls.data:
        return

    for poll_rec in res_polls.data:
        poll_id = poll_rec["id"]
        trip_id = poll_rec["trip_id"]
        tg_poll_id = poll_rec["telegram_poll_id"]
        group_chat_id = poll_rec["group_chat_id"]
        category = poll_rec["category"]
        sent_at_str = poll_rec["sent_at"]
        voter_ids = poll_rec.get("voter_ids") or []
        stale_sent = poll_rec.get("stale_nudge_sent") or False
        majority_sent = poll_rec.get("majority_nudge_sent") or False

        res_rsvps = await _safe_db_call(
            lambda: supabase.table("rsvps")
            .select("status, users(telegram_id, first_name, username)")
            .eq("trip_id", trip_id)
            .eq("status", "Committed")
            .execute()
        )
        if not res_rsvps or not res_rsvps.data:
            continue

        committed_users = []
        committed_tg_ids = set()
        for r in res_rsvps.data:
            user_info = r.get("users")
            if user_info and user_info.get("telegram_id"):
                committed_users.append(user_info)
                committed_tg_ids.add(user_info["telegram_id"])

        voted_committed_tg_ids = committed_tg_ids.intersection(set(voter_ids))
        voted_count = len(voted_committed_tg_ids)
        total_committed = len(committed_tg_ids)

        try:
            sent_at_dt = datetime.fromisoformat(sent_at_str.replace("Z", "+00:00"))
            is_stale = now - sent_at_dt >= timedelta(hours=STALE_POLL_HOURS)
        except Exception:
            is_stale = True

        if is_stale and not stale_sent:
            if total_committed > 0 and (voted_count / total_committed < STALE_PARTICIPATION):
                unvoted_users = [u for u in committed_users if u["telegram_id"] not in voter_ids]
                if unvoted_users:
                    user_lines = []
                    for u in unvoted_users:
                        name = _escape(u["first_name"])
                        username = u["username"]
                        if username:
                            user_lines.append(f"• <b>{name}</b> (@{_escape(username)})")
                        else:
                            user_lines.append(f"• <b>{name}</b>")

                    msg = (
                        f"🗳️ <b>Vote Reminder: {category.capitalize()} Poll</b>\n\n"
                        f"We need votes from the following committed travelers:\n"
                        f"{'\n'.join(user_lines)}\n\n"
                        f"Please cast your vote in the poll above!"
                    )
                    try:
                        await bot.send_message(chat_id=group_chat_id, text=msg, parse_mode="HTML")
                        await _safe_db_call(
                            lambda: supabase.table("active_polls")
                            .update({"stale_nudge_sent": True})
                            .eq("id", poll_id)
                            .execute()
                        )
                    except Exception as e:
                        logger.error(f"Failed to send stale poll nudge: {e}")

        if not majority_sent:
            if total_committed > 0 and (voted_count / total_committed >= MAJORITY_THRESHOLD):
                res_trip = await _safe_db_call(
                    lambda: supabase.table("trips")
                    .select("organizer_id")
                    .eq("id", trip_id)
                    .execute()
                )
                if res_trip and res_trip.data:
                    org_id = res_trip.data[0]["organizer_id"]
                    res_user = await _safe_db_call(
                        lambda: supabase.table("users")
                        .select("telegram_id, first_name, username")
                        .eq("id", org_id)
                        .execute()
                    )
                    if res_user and res_user.data:
                        org_user = res_user.data[0]
                        org_name = _escape(org_user["first_name"])
                        org_username = org_user["username"]
                        org_tag = f"<b>{org_name}</b> (@{_escape(org_username)})" if org_username else f"<b>{org_name}</b>"

                        msg = (
                            f"🎉 <b>Poll Majority Reached!</b>\n\n"
                            f"Hey {org_tag}, the <b>{category.capitalize()}</b> poll has reached a majority "
                            f"of votes ({voted_count}/{total_committed} committed travelers voted).\n\n"
                            f"You can now lock in the winning option using `/lock_master`!"
                        )
                        try:
                            await bot.send_message(chat_id=group_chat_id, text=msg, parse_mode="HTML")
                            await _safe_db_call(
                                lambda: supabase.table("active_polls")
                                .update({"majority_nudge_sent": True})
                                .eq("id", poll_id)
                                .execute()
                            )
                        except Exception as e:
                            logger.error(f"Failed to send majority poll nudge: {e}")


async def _background_nudging_loop(bot) -> None:
    logger.info("Starting background nudging loop...")
    while True:
        try:
            await _check_and_send_rsvp_nudges(bot)
            await _check_and_send_poll_nudges(bot)
        except Exception as e:
            logger.error(f"Error in background nudging loop: {e}", exc_info=True)
        await asyncio.sleep(BACKGROUND_CHECK_INTERVAL_SECONDS)


async def setup_global_commands(app) -> None:
    """
    PTB post_init hook — runs once after the bot connects, before polling.

    1. Sets static PM and group-member menus for everyone.
    2. Iterates every already-linked trip and restores organiser scopes
       so a bot restart doesn't lose the elevated menu.
    """
    # ── Global static menus ──────────────────────────────────────────────
    await app.bot.set_my_commands(
        _PM_COMMANDS,
        scope=BotCommandScopeAllPrivateChats(),
    )
    await app.bot.set_my_commands(
        _GROUP_MEMBER_COMMANDS,
        scope=BotCommandScopeAllGroupChats(),
    )

    # ── Restore per-organiser scopes for every linked trip ───────────────
    try:
        trips_q = (
            supabase.table("trips")
            .select("group_chat_id, organizer_id, users!trips_organizer_id_fkey(telegram_id)")
            .not_.is_("group_chat_id", "null")
            .execute()
        )
        for trip in trips_q.data or []:
            gcid       = trip.get("group_chat_id")
            user_node  = trip.get("users") or {}
            org_tg_id  = user_node.get("telegram_id")
            if gcid and org_tg_id:
                await setup_commands_for_group(app.bot, gcid, org_tg_id)
    except Exception:
        pass  # Non-fatal — static menus already set above

    # Start background nudging task
    asyncio.create_task(_background_nudging_loop(app.bot))


# ---------------------------------------------------------------------------
# Global Error Handler
# ---------------------------------------------------------------------------

async def global_error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Log exceptions and present a clean database/system warning alert to users.
    """
    logger.error("Exception while handling update:", exc_info=context.error)
    if isinstance(update, Update):
        await _send_db_error_message(update, context)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    app = Application.builder().token(os.getenv("TELEGRAM_TOKEN")).post_init(setup_global_commands).build()
    app.add_error_handler(global_error_handler)

    # New Trip creation flow (/new_trip in PM)
    new_trip_handler = ConversationHandler(
        entry_points=[CommandHandler("new_trip", new_trip)],
        states={
            TITLE:         [MessageHandler(filters.TEXT & ~filters.COMMAND, get_title)],
            DESTINATION:   [MessageHandler(filters.TEXT & ~filters.COMMAND, get_destination)],
            DATES:         [MessageHandler(filters.TEXT & ~filters.COMMAND, get_dates)],
            BASE_CURRENCY: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_currency)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    # Master PM Wizard (handles /start deep-links for add_option, paid, lock)
    pm_wizard_handler = ConversationHandler(
        entry_points=[
            CommandHandler("start",       wizard_router),
            # PM-direct entry points (bypass group redirect, trigger trip switcher)
            CommandHandler("add_option",  add_option,   filters=filters.ChatType.PRIVATE),
            CommandHandler("lock_master", lock_master,  filters=filters.ChatType.PRIVATE),
            CommandHandler("vote",        vote,         filters=filters.ChatType.PRIVATE),
            CommandHandler("paid",        paid,         filters=filters.ChatType.PRIVATE),
        ],
        states={
            TRIP_SELECT:   [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_trip_select)],
            ADD_OPT_CAT:   [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_addopt_cat)],
            ADD_OPT_NAME:  [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_addopt_name)],
            ADD_OPT_DESC:  [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_addopt_desc)],
            ADD_OPT_DATES: [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_addopt_dates)],
            ADD_OPT_LINK:  [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_addopt_link)],
            ADD_OPT_PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_addopt_price)],
            PAID_AMOUNT:   [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_paid_amount)],
            PAID_DESC:     [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_paid_desc)],
            LOCK_CAT:      [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_lock_cat)],
            LOCK_TITLE:    [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_lock_title)],
            LOCK_DATES:    [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_lock_dates)],
            LOCK_COST_TYPE:[MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_lock_cost_type)],
            LOCK_COST:     [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_lock_cost)],
            VOTE_CAT:      [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_vote_cat)],
            VOTE_DATES:    [MessageHandler(filters.TEXT & ~filters.COMMAND, wiz_vote_dates)],
        },
        fallbacks=[
            CommandHandler("cancel", cancel),
            CommandHandler("start",       wizard_router),
            CommandHandler("add_option",  add_option,   filters=filters.ChatType.PRIVATE),
            CommandHandler("lock_master", lock_master,  filters=filters.ChatType.PRIVATE),
            CommandHandler("vote",        vote,         filters=filters.ChatType.PRIVATE),
            CommandHandler("paid",        paid,         filters=filters.ChatType.PRIVATE),
        ],
    )

    # Register conversation handlers first (highest priority)
    app.add_handler(pm_wizard_handler)
    app.add_handler(new_trip_handler)

    # Inline keyboard callback
    app.add_handler(CallbackQueryHandler(handle_rsvp, pattern="^rsvp_"))
    app.add_handler(PollAnswerHandler(handle_poll_answer))

    # Standalone command handlers
    app.add_handler(CommandHandler("roster", roster))
    app.add_handler(CommandHandler("change_rsvp", change_rsvp))
    app.add_handler(CommandHandler("add_option", add_option))
    app.add_handler(CommandHandler("vote", vote))
    app.add_handler(CommandHandler("lock_master", lock_master))
    app.add_handler(CommandHandler("check_gaps", check_gaps))
    app.add_handler(CommandHandler("paid", paid))
    app.add_handler(CommandHandler("ledger", ledger))
    app.add_handler(CommandHandler("settle", settle))
    app.add_handler(CommandHandler("budget", budget))
    app.add_handler(CommandHandler("itinerary", itinerary))
    app.add_handler(CommandHandler("delete_option", delete_option))
    app.add_handler(CommandHandler("remove_itinerary", remove_itinerary))
    app.add_handler(CommandHandler("polls", polls))
    app.add_handler(CommandHandler("rsvp_notes", rsvp_notes))
    app.add_handler(CommandHandler("help", help_command))

    print("TripSync is online...")
    app.run_polling()


if __name__ == "__main__":
    main()