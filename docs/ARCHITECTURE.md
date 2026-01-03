# Technical Architecture

This document provides detailed technical information about the mytops platform architecture.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Security Model (RLS)](#security-model-rls)
5. [Authentication Flow](#authentication-flow)
6. [Frontend Architecture](#frontend-architecture)
7. [Backend Architecture](#backend-architecture)
8. [Deployment](#deployment)

---

## System Overview

**mytops** is a full-stack web application built on Supabase with a React frontend. The platform enables users to track and rate their favorite items across various topics.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│              React 19 + TypeScript + Vite + Tailwind            │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │  Auth    │  │  Topics  │  │  Items   │  │  User Profile    ││
│  │  Pages   │  │  Browse  │  │  Search  │  │  & Preferables   ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Supabase JS Client (RLS-protected)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                 │
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────────────────────┐   │
│  │   Supabase      │     │      Edge Functions             │   │
│  │   Auth          │     │  (Deno/TypeScript)              │   │
│  │                 │     │                                 │   │
│  │  - Email/Pass   │     │  ┌───────────┐  ┌────────────┐  │   │
│  │  - Google OAuth │     │  │ ai-enrich │  │   (future) │  │   │
│  │  - GitHub OAuth │     │  │  (future) │  │            │  │   │
│  └─────────────────┘     │  └───────────┘  └────────────┘  │   │
│                          └─────────────────────────────────┘   │
│                                        │                        │
│                                        ▼                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   PostgreSQL Database                     │  │
│  │                                                           │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────────────┐  │  │
│  │  │profiles │ │ topics  │ │ items   │ │ user_ratings   │  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────┐ ┌──────────────────────────┐    │  │
│  │  │ai_enrichment_queue  │ │ RLS Policies (security)  │    │  │
│  │  └─────────────────────┘ └──────────────────────────┘    │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  pg_cron (background jobs - future)                 │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Future: MVP 2)
                    ┌─────────────────┐
                    │   Claude API    │
                    │   (Anthropic)   │
                    └─────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19 | UI framework |
| **TypeScript** | 5.x | Type safety |
| **Vite** | 5.x | Build tool & dev server |
| **Tailwind CSS** | 3.x | Utility-first styling |
| **shadcn/ui** | Latest | Component library (copy-paste, not dependency) |
| **Zustand** | 4.x | State management |
| **Vitest** | 2.x | Testing framework |
| **React Testing Library** | 16.x | Component testing |

### Backend

| Technology | Purpose |
|------------|---------|
| **Supabase** | Backend-as-a-Service platform |
| **PostgreSQL** | Database (via Supabase) |
| **Supabase Auth** | Authentication & authorization |
| **Supabase Edge Functions** | Serverless functions (Deno runtime) |
| **pg_cron** | Scheduled jobs (future use) |
| **pg_net** | HTTP requests from database (future use) |

### AI & External Services

| Service | Purpose |
|---------|---------|
| **Claude API** (Anthropic) | AI-powered metadata generation (future: MVP 2) |
| **Google OAuth** | Social login |
| **GitHub OAuth** | Social login |

### Deployment

| Component | Platform |
|-----------|----------|
| **Frontend** | Cloudflare Pages (https://mytops.io) |
| **Backend** | Supabase (managed) |
| **Database** | Supabase (PostgreSQL managed instance) |
| **Edge Functions** | Supabase (deployed via MCP tools) |

---

## Database Schema

### Tables Overview

```
public schema:
├── topics              (available categories)
├── items               (all items across topics)
├── profiles            (user profiles)
├── user_ratings        (user's rated items)
└── ai_enrichment_queue (pending AI enrichment requests)
```

All tables have Row Level Security (RLS) enabled.

### Table: `topics`

Available categories for items (movies, series, books, etc.)

```sql
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,  -- emoji
    image_url TEXT,  -- topic cover image (added in migration)
    schema_template JSONB,  -- expected metadata fields for this topic
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Current topics (seed data):**
- Movies (🎬)
- Series (📺)
- Books (📚)
- Anime (🎌)
- Games (🎮)
- Restaurants (🍽️)

### Table: `items`

All items across all topics with flexible JSONB metadata

```sql
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    metadata JSONB,  -- flexible: year, director, author, genre, etc.
    image_url TEXT,
    source TEXT DEFAULT 'seed',  -- 'seed' | 'ai_generated'
    ai_confidence DECIMAL(3,2),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(topic_id, slug)
);
```

**Metadata examples by topic:**
- Movies: `{ genre, director, year, runtime, rating }`
- Books: `{ author, genre, year, pages, isbn }`
- Games: `{ platform, genre, developer, year }`
- Restaurants: `{ cuisine, location, price_range }`

### Table: `user_ratings`

User's rated items (preferables collection)

```sql
CREATE TABLE user_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, item_id)
);
```

**Behavior:**
- Rating an item adds it to user's "preferables"
- Deleting a rating removes it from collection
- Updating a rating changes the star value

### Table: `profiles`

User profiles (auto-created on signup)

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Table: `ai_enrichment_queue`

Queue for AI-powered item enrichment (future use)

```sql
CREATE TABLE ai_enrichment_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES topics(id),
    search_query TEXT NOT NULL,
    requested_by UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'completed' | 'failed'
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
```

### Database Functions

**`get_item_stats(item_uuid UUID)`**
Returns aggregated rating statistics for an item.

```sql
CREATE OR REPLACE FUNCTION get_item_stats(item_uuid UUID)
RETURNS TABLE (
  total_ratings BIGINT,
  average_rating NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_ratings,
    ROUND(AVG(rating), 2) as average_rating
  FROM user_ratings
  WHERE item_id = item_uuid;
END;
$$ LANGUAGE plpgsql;
```

**`batch_upsert_user_ratings(ratings JSONB)`**
Batch insert/update user ratings for performance.

```sql
CREATE OR REPLACE FUNCTION batch_upsert_user_ratings(ratings JSONB)
RETURNS SETOF user_ratings AS $$
BEGIN
  RETURN QUERY
  INSERT INTO user_ratings (user_id, item_id, rating, notes)
  SELECT
    (r->>'user_id')::UUID,
    (r->>'item_id')::UUID,
    (r->>'rating')::INTEGER,
    r->>'notes'
  FROM jsonb_array_elements(ratings) AS r
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET
    rating = EXCLUDED.rating,
    notes = EXCLUDED.notes,
    updated_at = NOW()
  RETURNING *;
END;
$$ LANGUAGE plpgsql;
```

---

## Security Model (RLS)

All tables have Row Level Security (RLS) enabled to ensure data isolation and security.

### RLS Policies

#### Topics (public read)

```sql
-- Anyone can view topics
CREATE POLICY "Anyone can view topics" ON topics
FOR SELECT TO anon, authenticated USING (true);
```

#### Items (public read, authenticated create)

```sql
-- Anyone can view items
CREATE POLICY "Anyone can view items" ON items
FOR SELECT TO anon, authenticated USING (true);

-- Authenticated users can insert items (via AI enrichment)
CREATE POLICY "Authenticated users can create items" ON items
FOR INSERT TO authenticated WITH CHECK (true);
```

#### User Ratings (private)

```sql
-- Users can view their own ratings
CREATE POLICY "Users can view own ratings" ON user_ratings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own ratings
CREATE POLICY "Users can insert own ratings" ON user_ratings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update own ratings" ON user_ratings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete own ratings" ON user_ratings
FOR DELETE TO authenticated
USING (auth.uid() = user_id);
```

#### Profiles (public read, owner update)

```sql
-- Anyone can view public profiles
CREATE POLICY "Anyone can view public profiles" ON profiles
FOR SELECT TO anon, authenticated
USING (is_public = true);

-- Users can view their own profile (even if private)
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

#### AI Enrichment Queue (authenticated)

```sql
-- Users can view their own enrichment requests
CREATE POLICY "Users can view own enrichment requests" ON ai_enrichment_queue
FOR SELECT TO authenticated
USING (auth.uid() = requested_by);

-- Users can create enrichment requests
CREATE POLICY "Users can create enrichment requests" ON ai_enrichment_queue
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requested_by);
```

### Security Testing

After any RLS changes, verify:
1. Unauthenticated users see only public data
2. Authenticated users see only their own private data
3. Users cannot modify other users' data

**Test queries:**
```sql
-- As anonymous user
SET LOCAL ROLE anon;
SELECT * FROM user_ratings; -- Should return 0 rows

-- As authenticated user
SET LOCAL request.jwt.claims = '{"sub": "user-123"}';
SELECT * FROM user_ratings; -- Should return only user-123's ratings
```

---

## Authentication Flow

### Providers

- **Email/Password**: Supabase Auth built-in
- **Google OAuth**: Configured in Supabase Dashboard
- **GitHub OAuth**: Configured in Supabase Dashboard

### Client-Side Flow

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Email/Password signup
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123'
})

// Email/Password login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
})

// OAuth login
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
})

// Get current session
const { data: { session } } = await supabase.auth.getSession()

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  // Handle auth events
})

// Logout
await supabase.auth.signOut()
```

### OAuth Callback Flow

1. User clicks "Sign in with Google/GitHub"
2. User is redirected to OAuth provider
3. User authorizes the app
4. Provider redirects to `/auth/callback?code=...`
5. Frontend exchanges code for session
6. Profile auto-created via database trigger
7. User redirected to main app

**Route guard implementation:**
```typescript
// ProtectedRoute: requires authentication
<ProtectedRoute>
  <ProfilePage />
</ProtectedRoute>

// PublicOnlyRoute: redirects authenticated users
<PublicOnlyRoute>
  <LoginPage />
</PublicOnlyRoute>
```

### Session Management

- Sessions stored in browser localStorage
- Auto-refresh on expiration
- Server-side validation via RLS (`auth.uid()`)

---

## Frontend Architecture

### Project Structure

```
frontend/src/
├── components/
│   ├── ui/              # shadcn/ui primitives (Button, Card, Input, etc.)
│   ├── Layout.tsx       # Main layout (header, nav, footer)
│   ├── ItemCard.tsx     # Item display with rating
│   ├── StarRating.tsx   # 5-star rating component
│   ├── ErrorBoundary.tsx
│   ├── ProtectedRoute.tsx
│   └── ...
├── pages/
│   ├── HomePage.tsx
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── TopicsPage.tsx
│   ├── TopicDetailPage.tsx
│   ├── ProfilePage.tsx
│   └── AuthCallback.tsx
├── services/
│   └── ratingService.ts # API calls for ratings
├── lib/
│   ├── supabase.ts      # Supabase client instance
│   ├── hooks.ts         # Custom React hooks
│   └── utils.ts         # Utility functions (cn)
├── store/
│   └── authStore.ts     # Zustand auth state
├── types/
│   └── index.ts         # TypeScript types
├── test/
│   ├── setup.ts         # Global test setup
│   └── utils.tsx        # Test utilities (custom render)
├── App.tsx              # Route configuration
└── main.tsx             # Entry point
```

### State Management

**Zustand** for global state (auth, user profile)

```typescript
// store/authStore.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  session: Session | null
  setAuth: (user: User | null, session: Session | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  setAuth: (user, session) => set({ user, session })
}))
```

**Local state** via React hooks for component-specific state

### Data Fetching

Direct Supabase client calls (no additional abstraction layer)

```typescript
// Fetch items for a topic
const { data: items, error } = await supabase
  .from('items')
  .select('*, topic:topics(*)')
  .eq('topic_id', topicId)

// Fetch user's ratings
const { data: ratings, error } = await supabase
  .from('user_ratings')
  .select('*, item:items(*)')
  .eq('user_id', userId)
```

### Component Patterns

**shadcn/ui components:**
- Copy-paste, not installed as dependency
- Customizable via Tailwind
- Accessible by default (built on Radix UI)

**Custom components:**
- TypeScript interfaces for props
- Co-located tests (*.test.tsx)
- Compound components for complex UI (e.g., StarRating)

### Styling

**Tailwind CSS** with custom configuration:
```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom color palette (monochrome neutral theme)
      }
    }
  }
}
```

**shadcn/ui theme:**
- Style: new-york
- Color: neutral (monochrome)
- Dark/light mode built-in

---

## Backend Architecture

### Edge Functions

**Current:** None deployed (future: MVP 2)

**Planned for MVP 2:**
- `ai-enrich-item`: AI-powered item metadata generation

**Structure:**
```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req: Request) => {
  // 1. Validate request
  // 2. Authenticate
  // 3. Business logic
  // 4. Return response
})
```

**Deployment:**
Via Supabase MCP tools:
```typescript
mcp__supabase__deploy_edge_function({
  name: 'ai-enrich-item',
  files: [{ name: 'index.ts', content: '...' }],
  verify_jwt: true
})
```

### Background Jobs (Future)

**pg_cron** for scheduled tasks:
- AI enrichment queue processing
- Database cleanup
- Statistics aggregation

---

## Deployment

### Frontend (Cloudflare Pages)

**Production URL:** https://mytops.io

**Build command:**
```bash
cd frontend && npm run build
```

**Output directory:** `frontend/dist`

**Environment variables:**
- `VITE_SUPABASE_URL` (public)
- `VITE_SUPABASE_ANON_KEY` (public, RLS-protected)

**Deployment:**
- Automatic on push to `main` branch
- Preview deployments for PRs

### Backend (Supabase)

**Managed service:**
- Database: Automatic backups, scaling
- Auth: Managed by Supabase
- Edge Functions: Deployed via MCP tools

**Secrets management:**
- Edge Function secrets via Supabase Dashboard
- Never commit secrets to git

### Database Migrations

**Local migrations:** `supabase/migrations/*.sql`

**Apply migrations:**
1. Via Supabase MCP: `mcp__supabase__apply_migration`
2. Via Supabase CLI: `supabase db push`

**Verify migrations:**
```sql
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

---

## Performance Considerations

### Frontend

- **Code splitting**: Vite automatic chunk splitting
- **Image optimization**: Use appropriate formats (WebP), lazy loading
- **Bundle size**: Monitor via `npm run build`
- **Caching**: Browser cache for static assets

### Database

- **Indexes**: On frequently queried columns (topic_id, user_id)
- **JSONB queries**: GIN indexes on metadata columns (if needed)
- **Connection pooling**: Managed by Supabase
- **Query optimization**: Use `explain analyze` for slow queries

### Network

- **CDN**: Cloudflare Pages includes CDN
- **API calls**: Minimize unnecessary requests
- **Debouncing**: Search inputs debounced to reduce API calls

---

## Monitoring & Observability

### Frontend

- Error Boundary for React errors
- Console logging in development
- Toast notifications for user feedback

### Backend

- Supabase Dashboard logs
- Edge Function logs via `mcp__supabase__get_logs`
- Database query performance via Supabase Dashboard

### Security

- Advisory checks via `mcp__supabase__get_advisors`
- RLS policy testing after changes
- npm audit for dependency vulnerabilities

---

## Future Enhancements

See `docs/ROADMAP.md` for detailed future plans.

**Key upcoming features:**
- AI-powered item enrichment (MVP 2)
- Recommendation engine (MVP 3)
- Social features (MVP 4)

---

**Last updated:** 2025-01-03

**References:**
- Original architecture plan: `docs/ARCHITECTURE_PLAN.md`
- Development guidelines: `docs/DEVELOPMENT_GUIDELINES.md`
- Roadmap: `docs/ROADMAP.md`
