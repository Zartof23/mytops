# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

> **IMPORTANT**: Development Guidelines in `docs/DEVELOPMENT_GUIDELINES.md` are **MANDATORY** for **EVERY task**. Before starting work, review Security Standards and Testing Standards. After completing work, update documentation and CHANGELOG.md.

## Project Overview

**mytops** is a platform that enables users to track and share their favorite things, powered by AI-driven database generation. The core innovation is a **self-building database**: when users search for items that don't exist, AI automatically generates structured data and adds it to the database.

### Key Concepts

- **Dynamic Database Growth**: Entries are generated on-demand via AI when users search for non-existent items (coming in MVP 2)
- **Rating as Curation**: Users rate items (1-5 stars) to add them to their personal "preferables" collection
- **User-Defined Topics**: Flexible categories (movies, series, books, anime, games, restaurants)
- **Community-Shaped Data**: The database evolves organically as users contribute through searches

### Brand Personality

The app has a "backend developer who reluctantly built a frontend" vibe with self-deprecating humor:
- *"I'm a backend dev... I don't usually do frontend."*
- *"Yes, the registration form is just those fields. I don't need your data."*
- Minimal, honest, no BS design

---

## What Users Can Do Now (Current E2E Flows)

### Working End-to-End Flows

1. **Authentication Flow**
   - Register/Login via email or OAuth (Google, GitHub)
   - Auto-profile creation via database trigger
   - Authenticated session management

2. **Browse & Discover**
   - Browse 6 topics (Movies, Series, Books, Anime, Games, Restaurants)
   - View items with rich metadata (title, description, image, topic-specific fields)
   - Search within topic items (debounced, real-time filtering)

3. **Rate & Curate**
   - Find items within topics
   - Rate items 1-5 stars with interactive UI
   - Build personal "preferables" collection
   - Optimistic updates with rollback on error

4. **Profile Management**
   - View personal profile page
   - See all rated items organized by topic
   - Responsive UI with dark/light mode

### Technical Capabilities

- Full authentication system (Email + Google + GitHub OAuth)
- RLS-protected database with 5 core tables (topics, items, profiles, user_ratings, ai_enrichment_queue)
- Dark/light mode with accessible UI (shadcn/ui monochrome theme)
- Responsive design (mobile-first)
- Comprehensive test coverage (50+ tests across components, services, pages)
- Production deployment at https://mytops.io
- Toast notifications for user feedback

### Known Limitations

- **No AI enrichment yet**: Users can only browse pre-seeded items (20+ items across 5 topics)
- **No search for new items**: Cannot add items not already in database
- **No recommendations**: No personalized suggestions based on ratings
- **Static topic list**: Cannot create custom topics
- **No social features**: No public sharing, follows, or lists

See `docs/ROADMAP.md` for upcoming features and future MVPs.

---

## Quick Start

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Access at `http://localhost:5173`

### Testing

```bash
cd frontend
npm test              # Run tests in watch mode
npm test -- --run     # Run tests once
npm run test:coverage # Run with coverage report
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in `VITE_SUPABASE_ANON_KEY` from Supabase Dashboard
3. Set Edge Function secrets in Supabase Dashboard:
   - `ANTHROPIC_API_KEY`

**NEVER commit to git:**
- `.env` files with real values
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

**Safe for frontend:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (protected by RLS)

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth (Email + Google + GitHub) |
| **Backend Logic** | Supabase Edge Functions (Deno/TypeScript) |
| **Background Jobs** | pg_cron + pg_net |
| **AI Provider** | Claude API (Anthropic) |
| **Frontend** | React 19 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui (new-york style, neutral palette) |
| **State Management** | Zustand |
| **Testing** | Vitest + React Testing Library |

See `docs/ARCHITECTURE.md` for detailed architecture documentation.

---

## Project Structure

```
mytops/
├── docs/
│   ├── ARCHITECTURE.md          # Technical architecture details
│   ├── DEVELOPMENT_GUIDELINES.md # Mandatory development standards
│   ├── ROADMAP.md               # Future MVPs and features
│   └── CHANGELOG.md             # Decision log
├── supabase/
│   ├── config.toml              # Supabase CLI configuration
│   └── migrations/              # Database migrations (version controlled)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui primitives
│   │   │   └── ...              # App components
│   │   ├── pages/               # Route pages
│   │   ├── services/            # API service layer
│   │   ├── test/                # Test utilities
│   │   ├── lib/                 # Shared utilities, Supabase client
│   │   ├── store/               # Zustand stores
│   │   └── types/               # TypeScript types
│   ├── components.json          # shadcn/ui configuration
│   ├── vitest.config.ts         # Test configuration
│   └── tailwind.config.js
├── .env.example                 # Environment template
├── CLAUDE.md                    # This file
└── README.md
```

> **Note:** Migrations are version-controlled locally in `supabase/migrations/`. Edge Functions are deployed via Supabase MCP tools and not stored locally.

---

## Core Development Principles

> Full guidelines in `docs/DEVELOPMENT_GUIDELINES.md`

### Pre-Task Checklist (ALWAYS DO FIRST)

Before starting ANY task:
- [ ] Read relevant documentation sections
- [ ] Review Security Standards for potential hazards
- [ ] Check existing patterns in the codebase
- [ ] Plan the implementation approach

### Post-Task Checklist (ALWAYS DO AFTER)

After completing ANY task:
- [ ] Run tests: `npm run test:run`
- [ ] Run build: `npm run build`
- [ ] Update CHANGELOG.md with what changed and why
- [ ] Update documentation if architecture/patterns changed
- [ ] Review for security implications

### Three Pillars

1. **Security First**: No mistakes allowed. Every change must be evaluated for security implications (OWASP Top 10).

2. **Plan Before Build**: Every feature must be validated through a plan and thoroughly tested. Document all decisions in CHANGELOG.md.

3. **Documentation is Law**: Documentation must always reflect the actual state of the project. Outdated documentation is unacceptable.

---

## Key Patterns

### Supabase Client (Frontend)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### Authentication Flow

- Supabase Auth handles email/password and OAuth
- Profile auto-created on signup via database trigger
- Session managed by Supabase JS client
- Route guards: `ProtectedRoute` (auth required), `PublicOnlyRoute` (redirect if authenticated)

### Rating Flow (Core Feature)

```
User finds item → Rates 1-5 stars → Item added to preferables
User profile shows preferables organized by topic
```

### Error Handling (Brand Voice)

- Generic: *"Something broke. Honestly, I'm surprised it worked this long."*
- Not found: *"Couldn't find that. Maybe it doesn't exist. Maybe I'm bad at searching."*
- Auth required: *"You need to log in for this. I know, I know, another login."*
- Network: *"Can't reach the server. It's probably my fault."*

---

## Documentation Reference

- **Architecture Details**: `docs/ARCHITECTURE.md`
- **Development Guidelines**: `docs/DEVELOPMENT_GUIDELINES.md` (MANDATORY)
- **Roadmap & Future MVPs**: `docs/ROADMAP.md`
- **Decision Log**: `docs/CHANGELOG.md`

---

## Database Quick Reference

### Tables (all with RLS enabled)

- **topics**: Available categories (movies, series, books, anime, games, restaurants)
- **items**: All items across topics with flexible JSONB metadata
- **profiles**: User profiles (auto-created on signup)
- **user_ratings**: User's rated items (preferables) - 1-5 stars
- **ai_enrichment_queue**: Pending AI enrichment requests (future use)

### Local Migrations

Migrations are version-controlled in `supabase/migrations/`. Apply via:
- Supabase MCP: `mcp__supabase__apply_migration`
- Supabase CLI: `supabase db push`

**Verify applied migrations:**
```sql
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

**Query topics:**
```sql
SELECT name, slug, icon FROM topics;
```

---

## File Naming Conventions

- Components: `PascalCase.tsx` (e.g., `TopicCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Types: `types.ts` or `*.types.ts`
- Tests: `*.test.ts` or `*.test.tsx`

## Where to Put New Code

- Reusable UI → `frontend/src/components/`
- Page-specific UI → inside the page file or `pages/[PageName]/`
- Supabase queries → `frontend/src/lib/` or co-located with component
- Global state → `frontend/src/store/`
- Types → `frontend/src/types/`

---

**When in doubt, refer to `docs/DEVELOPMENT_GUIDELINES.md` for detailed standards.**
