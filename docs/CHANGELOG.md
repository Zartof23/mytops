# Changelog

All notable decisions and changes to this project are documented in this file.

> **Archive Policy**: Entries older than 3 months move to `changelogs/YYYY-QX.md`
>
> **Format**: Each entry includes What, Why, Impact, and Files Changed

---

## Archives

- [2025 Q4](changelogs/2025-Q4.md) - Project foundation, architecture decisions, MVP 1

---

## 2026

### [2026-01-15] Skills Restructure with Context Integration

**What**: Updated and created skills to use the new context file structure.

**Changes**:
- **react-specialist**: Slimmed down from 629 to 267 lines, now references `FRONTEND_CONTEXT.md` and `TESTING_CONTEXT.md`
- **backend-specialist** (NEW): Supabase backend development including database design, RLS policies, Edge Functions, migrations. References `BACKEND_CONTEXT.md`
- **seo-optimization** (NEW): SEO and web performance optimization including meta tags, structured data, Core Web Vitals, accessibility. References `DEPLOYMENT_CONTEXT.md`

**Impact**: Documentation, Developer Experience
**Files**: `.claude/skills/*/SKILL.md`

---

### [2026-01-14] Documentation Restructure for Task-Specific Context

**What**: Restructured documentation into task-specific context files for efficient AI assistance.

**Why**:
- Original CLAUDE.md was a monolithic file (~2.6k tokens) loaded on every conversation
- No way to load only relevant context for specific task types
- Documentation updates required editing multiple sections

**Changes**:
- Created `docs/context/` directory with 4 task-specific files:
  - `BACKEND_CONTEXT.md` - Database, RLS, Edge Functions, migrations
  - `FRONTEND_CONTEXT.md` - React, components, state, styling
  - `TESTING_CONTEXT.md` - Test patterns, mocks, coverage
  - `DEPLOYMENT_CONTEXT.md` - CI/CD, production, monitoring
- Slimmed CLAUDE.md to router format (~800 tokens)
- Created `docs/changelogs/` for archived entries
- Archived 2025 entries to `changelogs/2025-Q4.md`

**Impact**: Backend, Frontend, Documentation
**Files**: CLAUDE.md, docs/context/*.md, docs/changelogs/2025-Q4.md

---

### [2026-01-13] Bug Fix: Edge Function 401 Authentication Error

**What**: Fixed authentication error preventing AI enrichment from working.

**Why**: Edge function was deployed with `verify_jwt: true`, causing Supabase to reject requests before function code could handle authentication.

**Solution**: Redeployed with `verify_jwt: false`. Function has comprehensive manual auth handling.

**Impact**: Backend (Edge Functions)
**Files**: ai-enrich-item edge function (version 4)

---

### [2026-01-11] MVP 2: AI-Powered Database Enrichment

**What**: Implemented the core "self-building database" feature. When users search for items that don't exist, the system offers to search the web, extract structured data using Claude AI, and automatically add enriched items to the database.

**Why**: Core innovation of mytops - database grows organically as users search.

**How It Works**:
1. User searches for non-existent item
2. System offers "Search the Web" button
3. Claude API with tool_use calls Tavily web search
4. AI extracts structured, topic-specific metadata
5. System downloads and stores poster/cover image
6. Enriched item inserted into database

**Security & Abuse Prevention**:
- Authentication: Valid JWT required
- Rate Limiting: 5 requests/user/day
- Input Validation: 200 char max, topic validation
- Confidence Scoring: ≥0.8 auto-approve, 0.6-0.8 flagged, <0.6 rejected

**Impact**: Backend, Frontend, Database
**Files Created**:
- Database migrations for app_config, user_enrichment_requests, rate limiting
- Edge function `ai-enrich-item`
- frontend/src/services/enrichmentService.ts
- frontend/src/hooks/useEnrichment.ts
- frontend/src/components/EnrichmentPrompt.tsx

**Test Count**: 119 (was 96, +23 new tests)

---

### [2026-01-05] SEO & Performance Optimization

**What**: Comprehensive SEO infrastructure and performance optimizations.

**Why**: Application lacked basic SEO infrastructure, no build-time compression, missing accessibility labels.

**Changes**:
- Added robots.txt, sitemap.xml, site.webmanifest
- Added Open Graph and Twitter Card meta tags
- Build-time gzip/brotli compression
- Route-level code splitting for auth and detail pages
- LazyImage enhancements for CLS optimization
- Accessibility improvements (aria-labels, live regions)
- Structured data schemas (BreadcrumbList, CollectionPage)

**Impact**: Frontend, SEO, Accessibility
**Test Count**: 101 (was 96, +5 new tests)

---

### [2026-01-05] Complete Image Storage Implementation

**What**: Topics and items now have visual imagery with lazy loading.

**Why**: Database had image_url fields but no storage infrastructure.

**Changes**:
- Created `topic-images` and `item-images` storage buckets
- Fixed critical LazyImage bug (IntersectionObserver watched wrong element)
- Updated TopicsPage, ItemCard, ItemDetailModal with images
- Background image design with gradient overlays

**Impact**: Backend (Storage), Frontend (Components)

---

### [2026-01-04] Add Skeleton Loading for User Data in ItemCard

**What**: Added loading skeletons when fetching user ratings and TODO status.

**Why**: ItemCards showed empty stars and TODO buttons before data loaded, creating misleading UI.

**Solution**: Added `isUserDataLoading` prop to ItemCard with skeleton placeholders.

**Impact**: Frontend (ItemCard)

---

### [2026-01-04] Fix Topic Filter Rendering Issues

**What**: Fixed items scattering and becoming invisible during filter changes.

**Why**: StaggerContainer with dynamic key prop caused full grid remount on filter changes.

**Solution**:
- Removed key prop from grid container
- Replaced StaggerContainer with AnimatePresence mode="popLayout"
- Simpler opacity-only transitions with layout animation

**Impact**: Frontend (TopicDetailPage)

---

### [2026-01-04] Rewrite README.md with Accurate Project State

**What**: Complete rewrite of README.md to align with documentation.

**Why**: README contained false claims (AI enrichment was working), incorrect project structure, missing critical info.

**Impact**: Documentation

---

### [2026-01-03] TopicDetailPage Performance & UI Fixes

**What**: Fixed duplicate API calls and invisible items on topic pages.

**Bugs Fixed**:
1. Duplicate /topics API calls due to hasFetchedTopic ref reset
2. Duplicate /user API calls (service fetched user internally)
3. User rating not displaying after async load
4. Items invisible (opacity=0) between searches

**Impact**: Frontend (TopicDetailPage, ItemCard, statsService)

---

### [2026-01-03] Documentation Restructure (Original)

**What**: Split CLAUDE.md into focused documents.

**Why**: CLAUDE.md had grown to ~4.6k tokens with mixed concerns.

**Changes**:
- CLAUDE.md: Core reference with current E2E flows
- docs/DEVELOPMENT_GUIDELINES.md: Mandatory standards
- docs/ROADMAP.md: Future MVPs
- docs/ARCHITECTURE.md: Technical details

**Impact**: Documentation

---

### [2026-01-02] Modal Integration & Final Wiring

**What**: Connected ItemDetailModal to TopicDetailPage.

**Features**:
- Clickable item cards open detail modal
- Rating in modal with optimistic updates
- TODO list management from modal
- Pre-fetched data for instant modal display

**Impact**: Frontend (TopicDetailPage)

---

### [2026-01-01] Major Feature Update: Server-Side Filtering, Pagination, TODO Lists

**What**: Server-side filtering with PostgreSQL functions, pagination, and TODO lists.

**Database Changes**:
- `user_todo_lists` table for per-topic watchlists
- `get_items_with_stats()` function for server-side filtering
- `get_user_ratings_for_items()` function for batch rating fetches

**Frontend Changes**:
- Server-side filtering (All, 5★, 4★+, New)
- Pagination (24 items/page)
- TODO service and UI integration
- Item detail modal with topic-specific metadata

**Impact**: Backend (Database), Frontend (TopicDetailPage, ItemCard)

---

### [2026-01-01] Bug Fixes and Testing Expansion

**What**: Fixed several issues from UX overhaul, added 46 new tests.

**Bugs Fixed**:
1. StarRating half-star display (fractional ratings)
2. TopicDetailPage duplicate API calls
3. TopicDetailPage filter logic (items without ratings)
4. ProfilePage double fetch
5. ItemCard duplicate rating fetch
6. Deprecated React.ElementRef

**Test Count**: 96 (was 50, +46 new tests)

---

### [2026-01-01] Complete UX Overhaul

**What**: Comprehensive UX redesign with Framer Motion animations, public profiles, and SEO.

**Design Philosophy**: "Notion's clarity meets Letterboxd's soul, built by someone who'd rather be writing SQL."

**Key Improvements**:
- Micro-interactions using Framer Motion
- Page transitions with fade + slide effects
- SEO optimization with React 19 native meta tags
- Public shareable profiles at `/@username`
- Community stats on items
- Filter pills for topic browsing

**Build Size**: 680KB (increased due to Framer Motion)

---

**Last updated**: 2026-01-15
