# Agent Rules & Integration Guidelines

## GitHub & Version Control Integration

- **Remote & Repository Setup**: The workspace is a local Git repository. When linking to GitHub, the remote is set to `origin` (`main` branch).
- **Environment & Secrets Safety**: Never track or commit `.env`, secret API keys (`SUPABASE_KEY`, `SUPABASE_DB_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`), `venv/`, or build output (`dist/`, `node_modules/`). Ensure root `.gitignore` rules remain enforced.
- **Atomic Commits**: Standard GSD task completions commit changes atomically with conventional commit prefixes (`feat(...)`, `fix(...)`, `docs(...)`, `refactor(...)`).
- **Shipping & Pull Requests**: Use `/gsd-ship` or `/gsd-pr-branch` when preparing code for GitHub pull requests and releases.
