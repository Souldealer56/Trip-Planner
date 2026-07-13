# Phase 3: Trips List & Details UI Views - Discussion Log

## Alternatives Considered

### 1. Theme/Aesthetics Styling
- **Option A (Chosen):** Vibrant Slate Dark Theme. Deep dark backdrop, neon primary colors, glassmorphism containers, and glowing hover borders. Fits the requirement for premium, state-of-the-art aesthetics that wow the user.
- **Option B:** Sleek Light Theme. Clean whites and grays, but lacks the high-end premium visual impact of glassmorphism.
- **Option C:** Auto Preference. Can lead to inconsistent branding experiences when switching between dark and light modes.

### 2. Card Navigation Method
- **Option A (Chosen):** Semantic react-router-dom Link routing. Ensures correct browser link handling (tab openings, middle clicks, back/forward cache) and improves accessibility.
- **Option B:** Programmatic onClick. Simpler layout code, but breaks middle-clicking to open in new tab and degrades standard web navigation patterns.

### 3. Date and Currency Presentation
- **Option A (Chosen):** Localized human-friendly helper formats. Formats date ranges (`Jul 12 – Jul 18, 2026`) and converts currency labels to symbols (`$`, `€`, `£`).
- **Option B:** Raw database outputs. Renders standard ISO date-time strings and ISO currency code labels. Low quality and degrades premium feel.

### 4. Fetching/Loading State Representation
- **Option A (Chosen):** Animated pulsing skeleton loaders + custom suitcase empty cards. Gives users clear visual progress feedback during queries and a beautiful illustration when empty.
- **Option B:** Simple text status labels. Low quality, basic feedback.

---

*Phase: 3-Trips List & Details UI Views*
*Discussion logged: 2026-07-12*
