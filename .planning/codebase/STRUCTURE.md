# Codebase Structure

**Analysis Date:** 2026-07-10

## Directory Layout

```
[project-root]/
├── .agents/               # Workspace local GSD customizations (skills, rules, workflows)
├── .planning/             # GSD planning documents, configurations, and graphs
│   └── codebase/          # Codebase analysis files (this document)
├── venv/                  # Python virtual environment containing third-party dependencies
├── .env                   # Local environment credentials configuration (gitignored)
├── .gitignore             # Git ignore instructions
├── GEMINI.md              # Project status, rules, and stack declarations
├── main.py                # Main script containing all application logic and bot handlers
└── main.py.old            # Backup/older version of the main application script
```

## Directory Purposes

**.agents/:**
- Purpose: Contains agentic custom instructions, workflows, and skills.
- Contains: GSD skills under `skills/`, rules under `rules/`, and workflows under `workflows/`.
- Key files: [.agents/settings.json](file:///c:/Users/alex_/Documents/Trip%20Planner/.agents/settings.json)

**.planning/:**
- Purpose: Houses structured specifications, state documents, roadmap milestones, and analysis files.
- Contains: Configuration JSON and codebase markdown documentation.
- Key files:
  - [.planning/config.json](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/config.json) - GSD configuration toggles and preferences.
  - [.planning/graphs/graph.json](file:///c:/Users/alex_/Documents/Trip%20Planner/.planning/graphs/graph.json) - Codebase dependency knowledge graph.

**venv/:**
- Purpose: Isolates python dependencies for the project.
- Contains: Virtual env scripts and package libs (`site-packages`).

## Key File Locations

**Entry Points:**
- [main.py](file:///c:/Users/alex_/Documents/Trip%20Planner/main.py): Single application entry point containing initialization, handlers, and the long-polling loop.

**Configuration:**
- [.env](file:///c:/Users/alex_/Documents/Trip%20Planner/.env): Local system configurations containing secret keys (`TELEGRAM_TOKEN`, `SUPABASE_KEY`, etc.).
- [GEMINI.md](file:///c:/Users/alex_/Documents/Trip%20Planner/GEMINI.md): Integration guidelines and active workflows.

**Backups:**
- [main.py.old](file:///c:/Users/alex_/Documents/Trip%20Planner/main.py.old): Retained backup of previous main script.

---

*Structure analysis: 2026-07-10*
*Update when directories change*
