# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

---

## Quick Reference

- **Project**: mytops - AI-powered favorites tracking platform
- **Stack**: React 19 + TypeScript + Supabase + Claude API
- **Production**: https://mytops.io
- **Current Phase**: MVP 1 (Browse & Rate) + MVP 2 (AI Enrichment)

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

### After ANY Task
1. Run tests: `cd frontend && npm test -- --run`
2. Run build: `cd frontend && npm run build`
3. Update `docs/CHANGELOG.md` with what changed and why
4. Update relevant context file if patterns changed

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
- Browse 6 topics (Movies, Series, Books, Anime, Games, Restaurants)
- Rate items 1-5 stars, build preferables collection
- Profile management, TODO lists
- AI-powered item enrichment (search + add new items)
- Responsive UI with dark/light mode
- 119 tests across components, services, pages

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
