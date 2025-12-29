# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**mytops** is a platform that enables users to track and share their favorite things, powered by AI-driven database generation. The core innovation is a **self-building database**: when users search for items that don't exist, AI automatically generates structured data and adds it to the database.

### Key Concepts

- **Dynamic Database Growth**: Entries are generated on-demand via AI when users search for non-existent items
- **Rating as Curation**: Users rate items (1-5 stars) to add them to their personal "preferables" collection
- **User-Defined Topics**: Flexible categories (movies, series, books, anime, games, restaurants)
- **Community-Shaped Data**: The database evolves organically as users contribute through searches

### Brand Personality

The app has a "backend developer who reluctantly built a frontend" vibe with self-deprecating humor:
- *"I'm a backend dev... I don't usually do frontend."*
- *"Yes, the registration form is just those fields. I don't need your data."*
- Minimal, honest, no BS design

## Architecture

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth (Email + Google + GitHub) |
| **Backend Logic** | Supabase Edge Functions (Deno/TypeScript) |
| **Background Jobs** | pg_cron + pg_net |
| **AI Provider** | Claude API (Anthropic) |
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State Management** | Zustand |

### Database Schema

Tables in `public` schema (all with RLS enabled):

- **topics**: Available categories (movies, series, books, anime, games, restaurants)
- **items**: All items across topics with flexible JSONB metadata
- **profiles**: User profiles (auto-created on signup)
- **user_ratings**: User's rated items (preferables) - 1-5 stars
- **ai_enrichment_queue**: Pending AI enrichment requests

### Project Structure

```
mytops/
├── docs/
│   ├── ARCHITECTURE_PLAN.md  # Full architecture documentation
│   └── CHANGELOG.md          # Decision log
├── frontend/
│   ├── src/
│   │   ├── components/       # UI components (Layout, ThemeToggle)
│   │   ├── pages/            # Route pages
│   │   ├── lib/
│   │   │   └── supabase.ts   # Supabase client
│   │   └── store/            # Zustand stores
│   └── tailwind.config.js
├── .env.example              # Environment template
├── CLAUDE.md                 # This file
└── README.md
```

> **Note:** Database migrations and Edge Functions are managed via Supabase Dashboard/MCP, not stored locally.

## Development Commands

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Access at `http://localhost:5173`

### Database

Database is managed via Supabase Dashboard or MCP tools. No local migration files.

Key tables query:
```sql
SELECT name, slug, icon FROM topics;
```

List all migrations applied:
```sql
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in `VITE_SUPABASE_ANON_KEY` from Supabase Dashboard
3. Set Edge Function secrets in Supabase Dashboard:
   - `ANTHROPIC_API_KEY`

## Security Guidelines

**NEVER commit to git:**
- `.env` files with real values
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

**Safe for frontend:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (protected by RLS)

All tables have Row Level Security (RLS) enabled. See `docs/ARCHITECTURE_PLAN.md` for policy details.

---

## Development Guidelines

> **CRITICAL**: These guidelines are mandatory for every task. No exceptions.

### Core Principles

1. **Security First**: During analysis and implementation, always consider security hazards and edge cases. No mistakes are allowed in this field. Every change must be evaluated for security implications.

2. **Plan Before Build**: After the basic implementation is complete, every new feature request or change must be validated through a plan and thoroughly tested. All decisions must be documented in the changelog.

3. **Documentation is Law**: Keeping all documentation up to date is mandatory. Documentation must always reflect the actual state of the project. Outdated documentation is unacceptable.

---

### Security Standards (OWASP)

Follow OWASP Top 10 guidelines. Key areas for this project:

| Vulnerability | Mitigation |
|---------------|------------|
| **Injection (SQL/NoSQL)** | Always use parameterized queries. Never concatenate user input into SQL. Supabase client handles this, but verify in Edge Functions. |
| **Broken Authentication** | Use Supabase Auth exclusively. Never implement custom auth. Validate sessions server-side. |
| **Sensitive Data Exposure** | RLS on all tables. Never expose service_role key. Audit what data is returned to clients. |
| **Broken Access Control** | RLS policies are mandatory. Test that users cannot access other users' data. Verify `auth.uid()` checks. |
| **Security Misconfiguration** | Review Supabase Dashboard settings. Disable unused auth providers. Audit RLS policies after changes. |
| **XSS** | React escapes by default. Never use `dangerouslySetInnerHTML`. Sanitize any user-generated content displayed. |
| **Insecure Deserialization** | Validate all JSON input structure. Use TypeScript types. Reject unexpected fields. |
| **Insufficient Logging** | Log security events (failed logins, permission denials). Never log sensitive data (passwords, tokens). |

**Before every PR/commit, verify:**
- [ ] No secrets in code
- [ ] RLS policies cover new tables/columns
- [ ] User input is validated and sanitized
- [ ] Error messages don't leak sensitive info
- [ ] Auth checks are in place for protected routes

---

### Testing Standards

Follow the **testing pyramid**:

```
        /\
       /  \        Few E2E tests (critical user flows)
      /────\
     /      \      Some integration tests (API, database)
    /────────\
   /          \    Many unit tests (functions, components)
  /────────────\
```

**Unit Tests** (many):
- All utility functions
- Component rendering and interactions
- State management logic
- Input validation functions
- Edge cases and error handling

**Integration Tests** (some):
- Supabase queries return expected data
- RLS policies work correctly
- Auth flows complete successfully
- Edge Functions respond correctly

**E2E Tests** (few):
- User registration → login → rate item → view profile
- Search → AI enrichment → item created
- OAuth flow completion

**Required before merge:**
- All existing tests pass
- New code has corresponding tests
- Manual testing of affected features
- Edge cases documented and tested:
  - Empty states
  - Long strings / special characters
  - Concurrent operations
  - Network failures
  - Invalid/malformed input

---

### Code Patterns & Consistency

**File Naming:**
- Components: `PascalCase.tsx` (e.g., `TopicCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Types: `types.ts` or `*.types.ts`
- Tests: `*.test.ts` or `*.test.tsx`

**Component Structure:**
```typescript
// 1. Imports (external, then internal, then types)
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Topic } from '../types'

// 2. Types/interfaces for this component
interface Props {
  topic: Topic
  onSelect: (id: string) => void
}

// 3. Component
export function TopicCard({ topic, onSelect }: Props) {
  // hooks first
  const [loading, setLoading] = useState(false)

  // handlers
  const handleClick = () => { ... }

  // render
  return ( ... )
}
```

**Where to put new code:**
- Reusable UI → `frontend/src/components/`
- Page-specific UI → inside the page file or `pages/[PageName]/`
- Supabase queries → `frontend/src/lib/` or co-located with component
- Global state → `frontend/src/store/`
- Types → `frontend/src/types/`

---

### Database Safety

**RLS is mandatory:**
- Every table must have RLS enabled
- Never use `service_role` key in frontend
- Test policies: "Can user A access user B's data?" (answer must be NO)

**Migration guidelines:**
- Test queries in Supabase SQL editor before applying migration
- Name migrations descriptively: `add_user_preferences_table`, `fix_rls_policy_items`
- Consider rollback strategy before applying
- Document breaking changes in CHANGELOG.md

**Query safety:**
- Always use Supabase client methods (not raw SQL in frontend)
- Validate and sanitize any dynamic values
- Use TypeScript types generated from schema when available

---

### Error Handling

**User-facing errors** (match the brand voice):
- Generic: *"Something broke. Honestly, I'm surprised it worked this long."*
- Not found: *"Couldn't find that. Maybe it doesn't exist. Maybe I'm bad at searching."*
- Auth required: *"You need to log in for this. I know, I know, another login."*
- Network: *"Can't reach the server. It's probably my fault."*

**Technical errors:**
- Log to console in development
- Never expose stack traces to users
- Never log sensitive data (tokens, passwords, PII)
- Include context: what operation failed, what user action triggered it

**Error boundaries:**
- Wrap major sections in React Error Boundaries
- Provide recovery actions when possible

---

### Supabase-Specific Patterns

**When to use Edge Functions vs Client queries:**
- Client query: Simple CRUD protected by RLS
- Edge Function: Complex logic, external API calls, operations needing service_role

**Edge Function structure:**
```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req: Request) => {
  try {
    // 1. Validate request
    // 2. Authenticate (verify JWT if needed)
    // 3. Business logic
    // 4. Return response

    return new Response(JSON.stringify({ data }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    // Log error (not to user)
    console.error('Function error:', error)

    return new Response(JSON.stringify({
      error: 'Something went wrong' // Generic message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

**RLS Policy Testing:**
After any RLS change, verify:
1. Unauthenticated users see only public data
2. Authenticated users see only their own private data
3. Users cannot modify other users' data
4. Admin operations (if any) are properly restricted

---

### Accessibility Requirements

**Minimum standards:**
- All interactive elements keyboard accessible
- Focus indicators visible
- Color contrast: 4.5:1 for normal text, 3:1 for large text
- Images have alt text (or aria-hidden if decorative)
- Form inputs have associated labels
- Error messages announced to screen readers

**Dark/Light mode:**
- Both modes must meet contrast requirements
- Test both modes for readability
- Respect system preference by default

---

### Dependencies

**When to add a new dependency:**
- Does it solve a real problem we have now? (not hypothetical)
- Is there a simpler solution without adding a dep?
- Is it actively maintained?
- What's the bundle size impact?
- Does it have security vulnerabilities? (check npm audit)

**Preferences:**
- Smaller packages over feature-rich ones
- Well-maintained over popular
- TypeScript support preferred
- Check if Supabase/React already provides the functionality

**Before adding, document in PR:**
- Why this package
- What alternatives were considered
- Bundle size impact

---

### Commit & Change Management

**Commit messages:**
- Clear and descriptive
- Reference what changed and why
- Format will be standardized when Linear integration is added

**Change process (post-MVP):**
1. Document the proposed change
2. Create a plan with implementation steps
3. Get approval if significant
4. Implement with tests
5. Update all affected documentation
6. Add entry to CHANGELOG.md
7. Review security implications

**CHANGELOG entries must include:**
- Date
- What changed
- Why it changed
- Any breaking changes
- Migration steps if needed

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

### Rating Flow (Core Feature)

```
User finds item → Rates 1-5 stars → Item added to preferables
User profile shows preferables organized by topic
```

## Current Phase: Core Features

### Completed
- [x] Supabase project setup
- [x] Database schema with migrations
- [x] RLS policies
- [x] Initial topics seeded (6 topics)
- [x] Frontend scaffolding (React + Vite + TypeScript)
- [x] Tailwind CSS with dark/light mode
- [x] Authentication UI (Login, Register pages)
- [x] Topic browsing page
- [x] User profile page structure
- [x] Item search within topics (TopicDetailPage)

### In Progress
- [ ] Rating component (5 stars)
- [ ] AI enrichment Edge Functions

## Documentation

- **Architecture**: `docs/ARCHITECTURE_PLAN.md`
- **Decisions Log**: `docs/CHANGELOG.md`
