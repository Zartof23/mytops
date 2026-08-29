# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

---

## Quick Reference

- **Project**: mytops - AI-powered favorites tracking platform
- **Stack**: React 19 + TypeScript + Supabase + Claude API
- **Production**: https://mytops.io
- **Current Phase**: MVP 1 (Browse & Rate) + MVP 2 (AI Enrichment)

---

## Issue Tracking — Linear (Official)

**Linear is the single source of truth for bugs and feature work.**

- Workspace/team: `ZartofApp` (key `ZAR`)
- Project: **mytops.io** — https://linear.app/zartofapp/project/mytopsio-cee0479c3109/overview
- Labels: `Bug`, `Feature`, `Improvement`
- Statuses: `Backlog` → `Todo` → `In Progress` → `In Review` → `Done` (also `Canceled`, `Duplicate`)

### Rules

1. **Every bug reported by the user gets a Linear ticket**, created in the mytops.io project with the `Bug` label.
2. **Every feature refinement is captured in a ticket** — all relevant information (problem, proposed behaviour, acceptance criteria, technical notes, security considerations) lives in the ticket description, not only in chat. Refine the ticket *before* implementing.
3. **Status must reflect reality.** Whenever work is picked up from Linear, update the ticket:
   - Starting work → `In Progress`
   - Implementation done, awaiting review/verification → `In Review`
   - Verified and merged → `Done`
   - Dropped → `Canceled` (with a comment explaining why)
4. **Reference the ticket ID** (e.g. `ZAR-12`) in commit messages and CHANGELOG entries.
5. Docs remain law: CHANGELOG.md still records *what changed and why*; Linear records *what needs doing and its state*.

---

## Context Files by Task Type

**Choose the right context before starting work:**

| Task Type | Context File | When to Use |
|-----------|--------------|-------------|
| **Backend** | `docs/context/BACKEND_CONTEXT.md` | Database, RLS, Edge Functions, migrations, Supabase queries |
| **Frontend** | `docs/context/FRONTEND_CONTEXT.md` | React components, UI, state, styling, routing |
| **Testing** | `docs/context/TESTING_CONTEXT.md` | Writing tests, fixing failures, test patterns |
| **Deployment** | `docs/context/DEPLOYMENT_CONTEXT.md` | CI/CD, production, monitoring, performance |

**Always read:** `docs/DEVELOPMENT_GUIDELINES.md` (mandatory for all tasks)

---

## Mandatory Rules

### Before ANY Task
1. Read `docs/DEVELOPMENT_GUIDELINES.md`
2. Load relevant context file from `docs/context/`
3. Check existing patterns in codebase
4. Ensure a Linear ticket exists for the work; set it to `In Progress`

### After ANY Task
1. Run tests: `cd frontend && npm test -- --run`
2. Run build: `cd frontend && npm run build`
3. Update `docs/CHANGELOG.md` with what changed and why (reference the ticket ID)
4. Update relevant context file if patterns changed
5. Move the Linear ticket to `In Review` (or `Done` once verified)

---

## Core Principles

1. **Security First**: No mistakes allowed. OWASP Top 10 compliance.
2. **Plan Before Build**: Document decisions in CHANGELOG.md
3. **Documentation is Law**: Keep docs current. Outdated docs are unacceptable.

---

## Brand Personality

"Backend developer who reluctantly built a frontend" vibe:
- *"Something broke. Honestly, I'm surprised it worked this long."*
- *"You need to log in for this. I know, I know, another login."*
- Minimal, honest, no BS design

---

## Quick Start

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm test        # Run tests
npm run build   # Production build
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Set `VITE_SUPABASE_ANON_KEY` from Supabase Dashboard
3. Edge Function secrets set in Supabase Dashboard

---

## Project Structure

```
mytops/
├── CLAUDE.md                    # This file (router)
├── docs/
│   ├── ARCHITECTURE.md          # Full technical architecture
│   ├── DEVELOPMENT_GUIDELINES.md # Mandatory standards
│   ├── ROADMAP.md               # Future MVPs
│   ├── CHANGELOG.md             # Decision log
│   ├── context/                 # Task-specific context
│   │   ├── BACKEND_CONTEXT.md
│   │   ├── FRONTEND_CONTEXT.md
│   │   ├── TESTING_CONTEXT.md
│   │   └── DEPLOYMENT_CONTEXT.md
│   └── changelogs/              # Archived changelog entries
├── supabase/
│   └── migrations/              # Version-controlled migrations
└── frontend/
    └── src/
        ├── components/          # React components
        ├── pages/               # Route pages
        ├── services/            # API service layer
        ├── store/               # Zustand stores
        └── types/               # TypeScript types
```

---

## Current Capabilities (MVP 1 + 2)

### Working Features
- Authentication (Email + Google + GitHub OAuth)
- Cross-topic search from the home page (Movies, Series, Books, Anime, Games, Restaurants), with `/topics` browse kept as a secondary path
- Rate items 1-5 stars, build preferables collection
- Profile page: poster-image cards, topic-filtered Watch Later, topic stats that jump to that topic's ratings
- AI-powered item enrichment (search + add new items)
- Item flagging (report a problem with an item) and admin moderation (flag queue, hard delete with link preview, AI re-scan with review-before-apply) at `/admin`
- Responsive UI with dark/light mode
- 261 tests across components, services, pages

### Known Limitations
- No personalized recommendations (MVP 3)
- No social features (MVP 4)
- No custom topics

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Email + OAuth) |
| Backend | Supabase Edge Functions (Deno) |
| AI | Claude API (Anthropic) + Tavily Search |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| Testing | Vitest + React Testing Library |

---

## Documentation Links

- **Architecture**: `docs/ARCHITECTURE.md`
- **Guidelines**: `docs/DEVELOPMENT_GUIDELINES.md` (MANDATORY)
- **Roadmap**: `docs/ROADMAP.md`
- **Changelog**: `docs/CHANGELOG.md`

---

**When in doubt, read the relevant context file in `docs/context/`.**
