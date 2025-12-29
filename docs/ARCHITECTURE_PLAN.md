# mytops Architecture Plan v2.0

> **Document Version**: 2.0
> **Date**: 2025-12-28
> **Status**: APPROVED - Implementation in Progress

---

## Executive Summary

**mytops** is a platform for users to track and share their favorite things, powered by AI-driven database generation. Built on **Supabase** as the unified backend platform.

---

## Core Concept

### What is mytops?
A self-building database where users discover, rate, and curate their favorite items across topics. When something doesn't exist, AI creates it.

### Key Features
- **Self-building database**: Items generated on-demand via AI when users search for non-existent entries
- **User-defined topics**: movies, series, books, anime, games, restaurants (and more later)
- **Rating as curation**: Rating an item (1-5 stars) adds it to your personal collection ("preferables")
- **Community-shaped data**: Database grows through user searches and AI enrichment

### Core User Flow
```
1. User browses/searches for an item in a topic
2. If item doesn't exist → AI fetches and creates it
3. User rates the item (1-5 stars) → Item added to their preferables
4. User's profile shows their curated collection, organized by topic
```

---

## Brand & Personality

### The Vibe
**"A backend developer reluctantly built a frontend"**

The app embraces self-deprecating developer humor, breaking the fourth wall with the user:

- Registration page: *"Yes, the registration form is just those fields. I don't need and I don't want your data, you can keep them."*
- About section: *"I'm a backend dev... I don't usually do frontend."*
- Error pages: *"Something broke. Honestly, I'm surprised it worked this long."*
- Empty states: *"Nothing here yet. The database is as empty as my design skills."*

### Design Principles
- **Minimal**: Clean, simple, no unnecessary decoration
- **Functional**: Everything has a purpose
- **Honest**: No dark patterns, no data harvesting, no BS
- **Light/Dark mode**: Because even backend devs know about eye strain

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Database** | Supabase (PostgreSQL) | Relational model, RLS security, real-time |
| **Authentication** | Supabase Auth | Email/password + Google + GitHub OAuth |
| **Backend Logic** | Supabase Edge Functions | Serverless TypeScript, Deno runtime |
| **Background Jobs** | pg_cron + pg_net | Native Postgres scheduling |
| **AI Provider** | Claude API (Anthropic) | Excellent structured data extraction |
| **Frontend** | React 18 + TypeScript + Vite | Modern, fast |
| **Styling** | Tailwind CSS + shadcn/ui | Minimal, accessible, dark/light mode |
| **State Management** | Zustand | Lightweight |

### Why shadcn/ui?
- Not a dependency - you copy the components you need
- Built on Radix UI (accessibility baked in)
- Minimal aesthetic fits our "dev who doesn't do design" vibe
- Built-in dark mode support
- Pairs perfectly with Tailwind

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│              React + TypeScript + Vite + Tailwind               │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │  Auth    │  │  Topics  │  │  Items   │  │  User Profile    ││
│  │  Pages   │  │  Browse  │  │  Search  │  │  & Preferables   ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Supabase JS Client
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                 │
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────────────────────┐   │
│  │   Supabase      │     │      Edge Functions             │   │
│  │   Auth          │     │                                 │   │
│  │                 │     │  ┌───────────┐  ┌────────────┐  │   │
│  │  - Email/Pass   │     │  │ ai-enrich │  │ item-search│  │   │
│  │  - Google OAuth │     │  └───────────┘  └────────────┘  │   │
│  │  - GitHub OAuth │     │                                 │   │
│  └─────────────────┘     └─────────────────────────────────┘   │
│                                        │                        │
│                                        ▼                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   PostgreSQL Database                     │  │
│  │                                                           │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────────────┐  │  │
│  │  │profiles │ │ topics  │ │ items   │ │ user_ratings   │  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐    │  │
│  │  │  RLS Policies   │  │  pg_cron (background jobs)  │    │  │
│  │  └─────────────────┘  └─────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Claude API    │
                    │   (Anthropic)   │
                    └─────────────────┘
```

---

## Database Schema

### Tables

#### 1. `topics`
```sql
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,  -- emoji
    schema_template JSONB,  -- expected metadata fields for this topic
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Initial topics (seed data):**
| name | slug | icon |
|------|------|------|
| Movies | movies | 🎬 |
| Series | series | 📺 |
| Books | books | 📚 |
| Anime | anime | 🎌 |
| Games | games | 🎮 |
| Restaurants | restaurants | 🍽️ |

#### 2. `items`
```sql
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    metadata JSONB,  -- year, director, author, cuisine, etc.
    image_url TEXT,
    source TEXT DEFAULT 'ai_generated',  -- 'seed', 'ai_generated'
    ai_confidence DECIMAL(3,2),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(topic_id, slug)
);
```

#### 3. `user_ratings` (Preferables)
Rating = Adding to your collection
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

#### 4. `profiles`
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

#### 5. `ai_enrichment_queue`
```sql
CREATE TABLE ai_enrichment_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES topics(id),
    search_query TEXT NOT NULL,
    requested_by UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending',
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);
```

---

## Security Model (RLS)

All tables have Row Level Security enabled. Key policies:

```sql
-- Topics: public read
CREATE POLICY "Anyone can view topics" ON topics
FOR SELECT TO anon, authenticated USING (true);

-- Items: public read, authenticated create
CREATE POLICY "Anyone can view items" ON items
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Authenticated can create items" ON items
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Ratings: owner full access, public read if profile is public
CREATE POLICY "Users manage own ratings" ON user_ratings
FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Public profiles ratings visible" ON user_ratings
FOR SELECT TO anon, authenticated
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = user_ratings.user_id
    AND profiles.is_public = true
));

-- Profiles: owner manages, public profiles visible
CREATE POLICY "Users manage own profile" ON profiles
FOR ALL TO authenticated USING (auth.uid() = id);

CREATE POLICY "Public profiles visible" ON profiles
FOR SELECT TO anon, authenticated
USING (is_public = true);
```

---

## AI Enrichment Workflow

### On-Demand (User Search)
```
User searches "Inception" in movies
    ↓
Edge Function checks database
    ↓
Not found? → Call Claude API
    ↓
Claude returns structured data (title, year, director, plot)
    ↓
Insert into items table
    ↓
Return to user → User can rate it
```

### Background (Trending - Future)
pg_cron processes queued requests periodically for popular searches.

---

## Project Structure

```
mytops/
├── .env.example
├── .gitignore
├── README.md
├── CLAUDE.md
├── docs/
│   ├── ARCHITECTURE_PLAN.md
│   └── CHANGELOG.md
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 00001_initial_schema.sql
│   │   └── 00002_rls_policies.sql
│   ├── functions/
│   │   ├── item-search/index.ts
│   │   └── ai-enrich/index.ts
│   └── seed.sql
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── ui/          # shadcn/ui components
    │   ├── pages/
    │   ├── lib/
    │   │   └── supabase.ts
    │   ├── store/
    │   └── App.tsx
    ├── tailwind.config.js
    └── package.json
```

---

## Development Phases

### Phase 1: Foundation ✅
- [x] Set up Supabase project
- [x] Create database schema (migrations)
- [x] Implement RLS policies
- [ ] Configure auth providers (Google + GitHub) in Supabase Dashboard
- [x] Seed initial topics

### Phase 2: Frontend Setup ✅
- [x] Initialize React + Vite + TypeScript
- [x] Configure Tailwind CSS
- [x] Implement dark/light mode toggle
- [x] Create basic layout with "backend dev" personality

### Phase 3: Core Features (In Progress)
- [x] Auth pages (login, register)
- [x] Topic browsing page
- [x] Item search & display
- [ ] Rating component (5 stars)
- [x] User profile page structure

### Phase 4: AI Integration
- [ ] Edge Function for item search
- [ ] Claude API integration
- [ ] On-demand item enrichment
- [ ] Error handling & loading states

### Phase 5: Polish
- [ ] Responsive design refinements
- [x] Fun copy/microcopy throughout
- [ ] Error pages with personality
- [ ] Performance optimization

---

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend | Supabase | All-in-one: DB, Auth, Edge Functions |
| CSS | Tailwind + shadcn/ui | Minimal, dark mode, dev-friendly |
| Auth providers | Email + Google + GitHub | Common, simple setup |
| AI provider | Claude (Anthropic) | Best for structured extraction |
| Rating system | 5 stars | Standard, intuitive |
| Profile organization | By topic | Clear structure for MVP |
| UI personality | Self-deprecating dev humor | Unique, memorable, honest |

---

## Environment Variables

### .env.example (commit this)
```env
# Supabase - get from dashboard
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Supabase Dashboard secrets (never in code)
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

---

## Next Steps

Current priorities:

1. **Configure OAuth providers** in Supabase Dashboard (Google + GitHub)
2. **Build item search** within topics
3. **Create rating component** (5-star system)
4. **Implement AI enrichment** Edge Function with Claude API
5. **Connect search to AI** for missing items
