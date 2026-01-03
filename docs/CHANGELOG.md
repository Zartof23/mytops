# Changelog

All notable decisions and changes to this project will be documented in this file.

---

## [2026-01-03] Documentation Restructure

### Context
CLAUDE.md had grown to ~4.6k tokens with mixed concerns (core reference, development guidelines, architecture, roadmap). This caused:
- High token usage on every conversation
- Difficulty finding relevant information
- Outdated/incorrect information (e.g., claiming migrations aren't stored locally when they are)
- Unclear "what can users do NOW" vs. future plans

### Decision: Split Documentation into Focused Files

**What Changed**:
- **CLAUDE.md** (new, ~2.5k tokens): Core reference with current E2E flows, quick start, key patterns
- **docs/DEVELOPMENT_GUIDELINES.md** (new): Mandatory standards, security, testing, code patterns
- **docs/ROADMAP.md** (new): Current capabilities and future MVPs with clear user flows
- **docs/ARCHITECTURE.md** (new): Technical details, database schema, RLS policies, deployment

**Rationale**:
- **Performance**: Load only relevant documentation per task (e.g., only load DEVELOPMENT_GUIDELINES.md when implementing features)
- **Clarity**: Each file has single responsibility
- **Accuracy**: Fixed inaccuracies about local migrations and edge functions
- **Maintainability**: Easier to update specific sections without affecting entire doc

**Specific Fixes in CLAUDE.md**:
1. **Line 82** (old): "Database migrations and Edge Functions are managed via Supabase Dashboard/MCP, not stored locally."
   - **Fixed**: "Migrations are version-controlled locally in `supabase/migrations/`. Edge Functions are deployed via Supabase MCP tools and not stored locally."

2. **Line 118** (old): "Database is managed via Supabase Dashboard or MCP tools. No local migration files."
   - **Fixed**: Clarified local migrations workflow with proper commands

3. **Lines 466-522** (old): Granular checklist of completed tasks mixed with "in progress"
   - **Fixed**: Replaced with "What Users Can Do Now" section showing 4 working E2E flows and known limitations

**New Structure Benefits**:
- CLAUDE.md: Always loaded, provides core context and quick reference
- DEVELOPMENT_GUIDELINES.md: Load when implementing features (security, testing, patterns)
- ROADMAP.md: Load when planning features or discussing future work
- ARCHITECTURE.md: Load when making architectural changes or debugging infrastructure

**Migration for AI Agent**:
- References updated throughout to point to new file locations
- All content preserved, just reorganized
- Original ARCHITECTURE_PLAN.md kept as reference (linked from new ARCHITECTURE.md)

**Impact**:
- Token usage: Reduced from ~4.6k to ~2.5k in default context
- Improved clarity: Clear E2E flow descriptions for current capabilities
- Accurate documentation: Fixed migration storage claims
- Future-proof: Easier to maintain as project grows

---

## [2025-12-28] Project Re-Architecture

### Context
Initial project concept used n8n as orchestrator and DynamoDB as database. Decision made to start fresh with a simpler, more integrated stack.

### Decisions Made

#### Backend Platform: Supabase
**Decision**: Use Supabase as unified backend (PostgreSQL + Auth + Edge Functions)

**Rationale**:
- All-in-one platform reduces complexity
- Built-in Row Level Security for data protection
- Native PostgreSQL with real-time subscriptions
- Edge Functions for serverless backend logic
- Integrated authentication with OAuth support
- MCP integration available for development

**Alternatives Considered**:
- n8n + DynamoDB (original) - Too complex for MVP, DynamoDB single-table design adds cognitive overhead
- Firebase - Less SQL-friendly, vendor lock-in concerns
- Self-hosted PostgreSQL + separate auth - More infrastructure to manage

---

#### Frontend Styling: Tailwind CSS + shadcn/ui
**Decision**: Use Tailwind CSS with shadcn/ui components

**Rationale**:
- Tailwind provides utility-first styling, fast iteration
- shadcn/ui is not a dependency - components are copied into project
- Built on Radix UI for accessibility
- Minimal aesthetic fits project personality
- Built-in dark/light mode support

**Alternatives Considered**:
- Material UI - Too opinionated, heavier bundle
- Chakra UI - Good but adds dependency
- Plain CSS - Too slow for rapid development

---

#### Authentication: Email + Google + GitHub
**Decision**: Support email/password registration plus Google and GitHub OAuth

**Rationale**:
- Email/password for users who prefer direct accounts
- Google covers majority of casual users
- GitHub appeals to developer audience (fits brand)
- Easy to add more providers later via Supabase

---

#### AI Provider: Claude (Anthropic)
**Decision**: Use Claude API for item enrichment

**Rationale**:
- Excellent at structured data extraction
- Consistent JSON output for database insertion
- Good context understanding for varied topics

---

#### Rating System: 5 Stars
**Decision**: Standard 1-5 star rating

**Rationale**:
- Universally understood
- Simple to implement
- Good granularity without being overwhelming

---

#### Profile Organization: By Topic
**Decision**: User preferables displayed organized by topic

**Rationale**:
- Clear structure for MVP
- Easy to navigate
- Can add unified view later

---

#### UI Personality: Self-Deprecating Developer Humor
**Decision**: Brand voice as "backend developer who reluctantly built a frontend"

**Rationale**:
- Unique and memorable
- Sets honest, no-BS expectations
- Appeals to developer audience
- Makes minimal design a feature, not a bug

**Example Copy**:
- "I'm a backend dev... I don't usually do frontend."
- "Yes, the registration form is just those fields. I don't need your data."
- "Something broke. Honestly, I'm surprised it worked this long."

---

#### Initial Topics
**Decision**: Seed with 6 topics for MVP

| Topic | Slug | Icon |
|-------|------|------|
| Movies | movies | 🎬 |
| Series | series | 📺 |
| Books | books | 📚 |
| Anime | anime | 🎌 |
| Games | games | 🎮 |
| Restaurants | restaurants | 🍽️ |

**Rationale**:
- Covers common "favorites" categories
- Mix of entertainment and real-world
- Easy to add more later

---

## [2025-12-29] Item Search Feature

### Feature: TopicDetailPage with Item Search

**What**: New page at `/topics/:slug` displaying topic details and allowing users to search for items within that topic.

**Files Created**:
- `frontend/src/pages/TopicDetailPage.tsx` - Main page component
- `frontend/src/components/ItemCard.tsx` - Reusable item card component

**Files Modified**:
- `frontend/src/App.tsx` - Added route for `/topics/:slug`

**Implementation Details**:
- Topic header shows icon, name, and description
- Search input filters items by name (case-insensitive via Supabase `.ilike()`)
- Items displayed in responsive grid (2 cols mobile, 3 cols desktop)
- ItemCard shows name, truncated description, optional image, and source badge
- Source badges: Curated (blue), AI (purple), User (green)
- Empty states with personality copy
- Accessible: keyboard navigation on cards, screen reader labels

**Security**:
- RLS policies handle access control (public read for items/topics)
- Search queries use Supabase parameterized queries (no SQL injection risk)

**Next Steps**:
- Rating component to add items to user's preferables
- AI enrichment when search returns no results

---

## [2025-12-29] Search Debouncing Optimization

### Optimization: Debounced Search Input

**Problem**: Every keystroke triggered a Supabase API call, causing unnecessary load and potential rate limiting.

**Solution**: Implemented debouncing - delays API call until 300ms after user stops typing.

**Files Created**:
- `frontend/src/lib/hooks.ts` - `useDebouncedValue` custom hook

**Files Modified**:
- `frontend/src/pages/TopicDetailPage.tsx` - Uses debounced search query

**Implementation Details**:
- `useDebouncedValue<T>(value, delay)` hook using `useEffect` + `setTimeout`
- Cleanup function cancels pending timers on each keystroke
- 300ms delay (standard for search inputs)
- Visual "Searching..." indicator while query is pending
- Input remains responsive (controlled), only API call is debounced

**References**:
- [React Debounce Best Practices](https://www.developerway.com/posts/debouncing-in-react)
- [OpenReplay Debounce Strategies](https://blog.openreplay.com/optimizing-api-calls-react-debounce-strategies/)

---

## [2025-12-31] AuthCallback Session Fix

### Fix: OAuth Callback Infinite Loading

**Problem**: After successful OAuth login, the `/auth/callback` page would show infinite loading until timeout, even though the user was actually logged in.

**Root Cause**: The `onAuthStateChange` listener was set up after the auth state had already changed. By the time the component mounted, Supabase had already processed the OAuth callback.

**Solution**: Check for existing session immediately on component mount, in addition to listening for auth state changes.

**Files Modified**:
- `frontend/src/pages/AuthCallback.tsx` - Added immediate session check on mount

**Tests Added**:
- `frontend/src/pages/AuthCallback.test.tsx` - 8 tests covering:
  - Loading state display
  - Error param handling from URL
  - Existing session detection
  - Auth state change handling
  - Cleanup on unmount
  - Back to login navigation

**Test Count**: 50 total (was 42)

---

## [2025-12-29] OAuth UI Improvements

### Feature: Enhanced OAuth Buttons & Error Handling

**What**: Improved OAuth login experience with provider icons, loading states, and error handling.

**Files Modified**:
- `frontend/src/store/authStore.ts` - Added `oauthLoading` state to track which provider is loading
- `frontend/src/pages/LoginPage.tsx` - Added Google/GitHub SVG icons, loading spinners, disabled states
- `frontend/src/pages/RegisterPage.tsx` - Same OAuth button improvements
- `frontend/src/pages/AuthCallback.tsx` - Added error handling, loading spinner, timeout fallback

**Implementation Details**:

**OAuth Button Improvements**:
- Inline SVG icons for Google (colored) and GitHub (monochrome)
- Loading spinner (Loader2) when OAuth redirect is in progress
- Buttons disabled during any auth operation
- Visual feedback for disabled state

**AuthCallback Enhancements**:
- Parses `error` and `error_description` from URL params
- Shows error state with "Back to login" button
- Loading spinner animation during callback processing
- 10-second timeout fallback if auth hangs
- Proper cleanup of auth listener subscription

**OAuth Provider Setup (User Action)**:
To complete OAuth setup:
1. Create OAuth apps in Google Cloud Console and GitHub Developer Settings
2. Set redirect URI: `https://ocasihbuejfjirsrnxzq.supabase.co/auth/v1/callback`
3. Enable providers in Supabase Dashboard > Authentication > Providers

---

## [2025-12-29] Rating Component & Testing Infrastructure

### Feature: StarRating Component with Testing

**What**: Interactive 5-star rating component with full testing infrastructure.

**Files Created**:
- `frontend/vitest.config.ts` - Vitest configuration
- `frontend/src/test/setup.ts` - Test setup with global mocks
- `frontend/src/test/utils.tsx` - Custom render with providers
- `frontend/src/services/ratingService.ts` - Rating CRUD operations
- `frontend/src/services/ratingService.test.ts` - Service unit tests
- `frontend/src/components/StarRating.tsx` - Star rating component
- `frontend/src/components/StarRating.test.tsx` - Component tests
- `frontend/src/components/ItemCard.test.tsx` - ItemCard integration tests

**Files Modified**:
- `frontend/package.json` - Added test scripts and dependencies
- `frontend/tsconfig.app.json` - Added vitest/globals types
- `frontend/src/components/ItemCard.tsx` - Integrated rating functionality
- `frontend/src/pages/ProfilePage.tsx` - Uses StarRating component

**Database Migration**:
- `seed_test_items` - Seeded 20 items across 5 topics (Movies, Series, Books, Anime, Games)

**Implementation Details**:

**StarRating Component**:
- 5 clickable star buttons using lucide-react Star icon
- Hover preview effect (shows what rating would be)
- Yellow fill for rated stars, muted for unrated
- Size variants: sm, md, lg
- Disabled/readOnly states
- Full keyboard accessibility (Enter/Space to select)
- ARIA labels for screen readers

**ItemCard Rating Integration**:
- Fetches user's existing rating on mount
- Optimistic update on rating change (immediate UI feedback)
- Rollback on error
- stopPropagation to prevent card click when rating
- "Sign in to rate" prompt for unauthenticated users

**ratingService**:
- `upsertRating(input)` - Create/update rating (handles UNIQUE constraint)
- `getUserRating(itemId)` - Get user's rating for an item
- `deleteRating(itemId)` - Remove rating

**Testing Infrastructure**:
- Vitest with jsdom environment
- React Testing Library for component tests
- @testing-library/user-event for interaction simulation
- Custom render wrapper with BrowserRouter
- Global test setup with Supabase mocks
- 42 tests total (8 service + 18 StarRating + 16 ItemCard)

**Security**:
- RLS policies ensure users can only read/write their own ratings
- Auth check before rating operations
- Input validated via TypeScript types

---

## [2025-12-31] UI/UX Rework with shadcn/ui

### Feature: Complete Frontend Design Refresh

**What**: Comprehensive UI/UX overhaul using shadcn/ui components with a monochrome color scheme, maintaining the "backend dev who doesn't do frontend" personality.

**Design Principles**:
- Sharp & Minimal: Clean lines, no unnecessary decoration
- Monochrome: Black, white, and grays only (neutral palette)
- Dev Vibe: Self-deprecating humor in toast messages and copy
- Functional: Every element serves a purpose

**Files Created** (shadcn/ui components):
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/card.tsx`
- `frontend/src/components/ui/input.tsx`
- `frontend/src/components/ui/badge.tsx`
- `frontend/src/components/ui/skeleton.tsx`
- `frontend/src/components/ui/sonner.tsx` (toast notifications)
- `frontend/src/components/ui/separator.tsx`
- `frontend/src/components/ui/tooltip.tsx`
- `frontend/src/components/ui/label.tsx`
- `frontend/src/lib/utils.ts` (cn utility for class merging)
- `frontend/components.json` (shadcn configuration)

**Files Modified**:
- `frontend/src/index.css` - Monochrome CSS variables (HSL-based)
- `frontend/src/components/Layout.tsx` - shadcn Button, Separator, added Toaster
- `frontend/src/components/ItemCard.tsx` - Card, Badge, toast notifications
- `frontend/src/components/StarRating.tsx` - Monochrome stars (fill-foreground instead of yellow)
- `frontend/src/components/ThemeToggle.tsx` - shadcn Button ghost/icon variant
- `frontend/src/components/OAuthButtons.tsx` - shadcn Button outline variant
- `frontend/src/pages/HomePage.tsx` - Card, Button, Separator components
- `frontend/src/pages/TopicsPage.tsx` - Card, Skeleton loading states
- `frontend/src/pages/TopicDetailPage.tsx` - Input, Skeleton, Card, Loader2
- `frontend/src/pages/LoginPage.tsx` - Card wrapper, Input, Label, Button, toast
- `frontend/src/pages/RegisterPage.tsx` - Card wrapper, Input, Label, Button, toast
- `frontend/src/pages/ProfilePage.tsx` - Card, Skeleton, Separator
- `frontend/tsconfig.json` - Path alias for @/ imports
- `frontend/tsconfig.app.json` - Path alias for @/ imports
- `frontend/vite.config.ts` - Path alias resolution
- `frontend/vitest.config.ts` - Path alias for tests

**Configuration Changes**:
- shadcn style: `new-york` (sharper, more minimal)
- Base color: `neutral` (monochrome grays)
- Path alias: `@/` maps to `src/`

**Toast Messages** (with dev humor):
| Event | Message |
|-------|---------|
| Rating saved | "Noted. Your taste is... interesting." |
| Rating failed | "Couldn't save that. The database is judging you." |
| Login success | "Welcome back. The database missed you." |
| Login failed | "Wrong credentials. Or maybe I broke something." |
| Network error | "Can't reach the server. It's probably my fault." |

**Skeleton Loading States Added**:
- Topics grid: Placeholder cards during fetch
- Items grid: Placeholder cards with image areas
- Profile page: Topic sections with rating placeholders

**Bug Fixes During Implementation**:
- Removed Next.js-specific `next-themes` dependency from sonner.tsx
- Replaced with MutationObserver-based theme detection
- Removed unnecessary `"use client"` directives (Vite doesn't need them)
- Fixed vitest path alias configuration

**Dependencies Added**:
- `class-variance-authority` - For component variants
- `clsx` - Class name utility
- `tailwind-merge` - Intelligent Tailwind class merging
- `sonner` - Toast notification library
- `@radix-ui/*` - Accessible UI primitives (via shadcn)

**Dependencies Removed**:
- `next-themes` - Not needed for Vite projects

**Test Impact**: All 50 tests pass. One test updated to work with new Separator component structure.

**Build Size**: 496KB (acceptable for full shadcn integration)

---

## [2025-12-31] Code Quality & Route Guards

### Refactor: Route Protection & Code Quality Improvements

**What**: Comprehensive code quality audit and fixes including proper route guards, shared components, and memory leak fixes.

**Files Created**:
- `frontend/src/components/RouteGuards.tsx` - ProtectedRoute and PublicOnlyRoute components
- `frontend/src/components/OAuthButtons.tsx` - Shared OAuth buttons and icons
- `frontend/src/components/ErrorBoundary.tsx` - Global error boundary with brand voice

**Files Modified**:
- `frontend/src/App.tsx` - Integrated route guards and auth cleanup
- `frontend/src/pages/ProfilePage.tsx` - Removed band-aid redirect, fixed `any` types
- `frontend/src/pages/LoginPage.tsx` - Uses shared OAuth components
- `frontend/src/pages/RegisterPage.tsx` - Uses shared OAuth components
- `frontend/src/store/authStore.ts` - Fixed memory leak with subscription cleanup
- `frontend/src/main.tsx` - Wrapped app with ErrorBoundary

**Implementation Details**:

**Route Guards**:
- `ProtectedRoute`: Redirects to `/login` if not authenticated
- `PublicOnlyRoute`: Redirects to `/` if already authenticated (prevents accessing /login when logged in)
- Uses React Router's `<Outlet />` pattern for nested routing
- Checks `initialized` state to avoid flash of wrong content

**Shared Components**:
- Extracted `GoogleIcon` and `GitHubIcon` SVG components
- Created `OAuthButtons` component with loading states
- Created `OAuthDivider` component
- Reduced code duplication between LoginPage and RegisterPage

**Memory Leak Fix**:
- Auth subscription stored externally to Zustand store
- `cleanup()` method added to unsubscribe on unmount
- Prevents duplicate subscriptions on hot reload

**Error Boundary**:
- Class component catching React errors
- Brand-appropriate error message: "Something broke. Honestly, I'm surprised it worked this long."
- Shows error message in monospace font
- "Try again" button to reset error state

**Test Count**: 50 (unchanged)

---

## [2026-01-01] Complete UX Overhaul

### Feature: Intentional Minimalism with Micro-Interactions

**What**: Comprehensive UX redesign transforming the app from "functional minimal" to "intentional minimal" with purposeful animations, better discovery, and SEO optimization.

**Design Philosophy**: "Notion's clarity meets Letterboxd's soul, built by someone who'd rather be writing SQL."

**Key Improvements**:
- Micro-interactions using Framer Motion
- Page transitions with fade + slide effects
- SEO optimization with React 19 native meta tags
- Public shareable profiles at `/@username`
- Community stats (avg rating, count) on items
- Live preview carousel on homepage
- Filter pills for topic browsing

**Files Created**:
- `frontend/src/lib/animations.ts` - Animation presets (page transitions, stagger, star pulse)
- `frontend/src/components/SEO.tsx` - SEO meta tags + structured data (JSON-LD)
- `frontend/src/components/PageTransition.tsx` - Page transition wrapper components
- `frontend/src/services/statsService.ts` - Community stats queries (batch, user, popular items)
- `frontend/src/services/profileService.ts` - Profile queries (by username, update, top rated)
- `frontend/src/pages/PublicProfilePage.tsx` - SEO-optimized public profile view

**Files Modified**:
- `frontend/src/App.tsx` - Added /@username route with lazy loading
- `frontend/src/components/StarRating.tsx` - Framer Motion pulse + glow animations
- `frontend/src/components/ItemCard.tsx` - Hover lift effect, community stats display, Progress bar
- `frontend/src/pages/HomePage.tsx` - Live preview carousel, accordion FAQ, new tagline
- `frontend/src/pages/TopicsPage.tsx` - Stagger animation, hover effects, SEO
- `frontend/src/pages/TopicDetailPage.tsx` - Filter pills, search feedback, witty taglines, SEO
- `frontend/src/pages/ProfilePage.tsx` - Stats grid, top rated carousel, tabbed navigation

**New shadcn/ui Components Added**:
- `tabs.tsx` - Tabbed navigation for profile
- `dialog.tsx` - Modal dialogs
- `avatar.tsx` - User avatar with fallback
- `progress.tsx` - Rating progress bar
- `scroll-area.tsx` - Horizontal scroll for top rated
- `accordion.tsx` - FAQ on homepage
- `dropdown-menu.tsx` - Future use

**Animation Details**:
- StarRating: Subtle pulse (1.15x scale, 150ms) + glow effect on click
- ItemCard: Hover lift (-2px translateY) + shadow increase
- Pages: Fade + slide up (200ms ease-out)
- Grids: Stagger children (50ms delay each)
- Stats: Count up animation (1s duration)
- All animations respect `prefers-reduced-motion`

**SEO Implementation**:
- React 19 native Document Metadata (no external library needed)
- Open Graph tags for social sharing
- Twitter Card support
- Structured data: WebSite, Person, ItemList schemas
- Dynamic meta titles per page type
- Canonical URLs

**Topic Taglines**:
| Topic | Tagline |
|-------|---------|
| Movies | "Every masterpiece. Every guilty pleasure." |
| Series | "The ones you binged. The ones you pretend you didn't." |
| Books | "The ones you finished. The ones collecting dust." |
| Anime | "Your gateway into degeneracy. Own it." |
| Games | "Hundreds of hours well spent. Arguably." |
| Restaurants | "The spots you'd actually recommend." |

**Dependencies Added**:
- `framer-motion` (v12.x) - Animation library
- `@radix-ui/react-tabs` - Tabs primitive
- `@radix-ui/react-dialog` - Dialog primitive
- `@radix-ui/react-avatar` - Avatar primitive
- `@radix-ui/react-progress` - Progress primitive
- `@radix-ui/react-scroll-area` - Scroll area primitive
- `@radix-ui/react-accordion` - Accordion primitive
- `@radix-ui/react-dropdown-menu` - Dropdown primitive

**Test Count**: 50 (all passing)

**Build Size**: 680KB (increased due to Framer Motion, but code-split for lazy loading)

---

## [2026-01-01] Bug Fixes and Testing Expansion

### Bug Fixes

**What**: Fixed several issues identified during UX overhaul review.

**Files Modified**:
- `frontend/src/components/StarRating.tsx` - Fixed fractional rating display
- `frontend/src/pages/TopicDetailPage.tsx` - Fixed duplicate API calls and filter logic
- `frontend/src/pages/ProfilePage.tsx` - Fixed duplicate API call on activeTab change
- `frontend/src/components/ItemCard.tsx` - Fixed duplicate rating fetch
- Multiple `frontend/src/components/ui/*.tsx` files - Fixed deprecated React.ElementRef

**Files Created**:
- `frontend/src/services/statsService.test.ts` - 10 tests for stats service
- `frontend/src/services/profileService.test.ts` - 11 tests for profile service
- `frontend/src/components/SEO.test.tsx` - 13 tests for SEO components
- `frontend/src/components/PageTransition.test.tsx` - 12 tests for animation wrappers

**Bug Details**:

**1. StarRating Half-Star Display** (`StarRating.tsx:39-48, 179-191`)
- **Issue**: Fractional ratings (e.g., 4.3) didn't visually show partial star fill
- **Fix**: Added `getStarFillPercent()` function and CSS clip-path overlay
- **How**: Uses `clipPath: inset(0 ${100 - fillPercent}% 0 0)` for partial star display

**2. TopicDetailPage Duplicate API Calls** (`TopicDetailPage.tsx:58-59, 68-73`)
- **Issue**: Search API called multiple times unnecessarily
- **Fix**: Added `lastFetchedQuery` ref to track and skip duplicate fetches
- **How**: `if (lastFetchedQuery.current === query) return`

**3. TopicDetailPage Filter Logic** (`TopicDetailPage.tsx:177-182`)
- **Issue**: Filters showed items without ratings as matching "5★" or "4★+"
- **Fix**: Added `stats.ratingCount > 0` check to all rating-based filters
- **How**: `return stats && stats.ratingCount > 0 && stats.avgRating >= 4.8`

**4. ProfilePage Double Fetch** (`ProfilePage.tsx:181`)
- **Issue**: `activeTab` in dependencies caused refetch when tab was set
- **Fix**: Removed `activeTab` from useEffect dependencies
- **How**: Use functional setState: `setActiveTab((prev) => prev || ...)`

**5. ItemCard Duplicate Rating Fetch** (`ItemCard.tsx:46-59`)
- **Issue**: Each ItemCard fetched user rating on every parent re-render
- **Fix**: Added `lastFetchedItemId` ref to prevent duplicate fetches
- **How**: `if (lastFetchedItemId.current === item.id) return`

**6. Deprecated React.ElementRef** (all shadcn ui components)
- **Issue**: `React.ElementRef` deprecated in favor of `React.ComponentRef`
- **Fix**: Global replace in all UI components
- **Files affected**: accordion, avatar, dialog, dropdown-menu, label, progress, scroll-area, separator, tabs, tooltip

**Tests Added**:

| Service/Component | Tests Added | Coverage Focus |
|-------------------|-------------|----------------|
| statsService | 10 | getItemStats, getItemStatsBatch, getUserStats, getPopularItems, getRecentlyRatedItems |
| profileService | 11 | getCurrentProfile, getProfileByUsername, updateProfile, isUsernameAvailable, getTopRatedItems |
| SEO | 13 | Meta rendering, JSON-LD schemas (WebSite, Profile, ItemList), edge cases |
| PageTransition | 12 | PageTransition, StaggerContainer, StaggerItem, FadeIn, reduced motion handling |

**Existing Test Fixes**:
- Updated StarRating tests for new aria-label format (`.toFixed(1)` = "4.0" not "4")
- Updated ItemCard test for new aria-label format

**Test Count**: 96 (was 50, +46 new tests)

**All tests passing, build succeeds**

---

## [2026-01-01] Major Feature Update: Server-Side Filtering, Pagination, TODO Lists, and Local Migrations

### Infrastructure: Supabase Local Migrations

**What**: Set up local migration folder for version control of database changes.

**Files Created**:
- `supabase/config.toml` - Supabase project configuration
- `supabase/migrations/20260101000001_create_user_todo_lists.sql` - TODO list table + RLS
- `supabase/migrations/20260101000002_add_topic_image_url.sql` - Topic images support
- `supabase/migrations/20260101000003_create_item_stats_function.sql` - Server-side filtering function
- `supabase/migrations/20260101000004_create_user_ratings_batch_function.sql` - Batch user ratings

**Database Changes**:
- New `user_todo_lists` table for per-topic watchlists
- New `image_url` column on `topics` table
- New `get_items_with_stats()` PostgreSQL function for server-side filtering
- New `get_items_with_stats_count()` function for pagination counts
- New `get_user_ratings_for_items()` function for batch rating fetches

---

### Feature: Server-Side Filtering & Pagination

**Problem**: Filtering by rating and "new" was done client-side, causing:
- All items fetched even when filtering for specific ratings
- "New" filter used 7-day threshold (should be 30 days based on metadata)
- No pagination support

**Solution**: Move all filtering to database via PostgreSQL functions.

**Files Modified**:
- `frontend/src/services/statsService.ts` - Added `getFilteredItems()` and `getUserRatingsBatch()` methods
- `frontend/src/pages/TopicDetailPage.tsx` - Complete rewrite for server-side filtering + pagination
- `frontend/src/types/index.ts` - Added `ItemWithStats`, `UserTodoItem` types, `image_url` to Topic

**Files Created**:
- `frontend/src/components/Pagination.tsx` - Previous/Next pagination component

**Filter Parameters**:
| Filter | Server Parameter | Value |
|--------|------------------|-------|
| All | None | - |
| 5★ | `p_min_avg_rating` | 4.8 |
| 4★+ | `p_min_avg_rating` | 4.0 |
| New | `p_released_after` | 30 days ago (from metadata.release_date or metadata.year) |

**Pagination**: 24 items per page with Previous/Next controls.

---

### Feature: TODO Lists (Per-Topic Watchlists)

**What**: Users can add items to a "watch later" list without rating them.

**Files Created**:
- `frontend/src/services/todoService.ts` - CRUD operations for TODO items

**Service Methods**:
- `getTodosByTopic(topicId)` - Get user's TODO items for a specific topic
- `getAllTodos()` - Get all TODO items grouped by topic
- `addToTodo(itemId, topicId)` - Add item to TODO list
- `removeFromTodo(itemId)` - Remove item from TODO list
- `getTodoStatusBatch(itemIds)` - Batch check which items are in TODO list

**Database Table**: `user_todo_lists`
- `id`, `user_id`, `item_id`, `topic_id`, `priority`, `notes`, `created_at`, `updated_at`
- Unique constraint on (user_id, item_id)
- RLS policies: Users manage own lists, public profiles' lists visible

---

### Feature: Enhanced ItemCard Component

**What**: Comprehensive ItemCard improvements.

**Files Modified**:
- `frontend/src/components/ItemCard.tsx`
- `frontend/src/components/StarRating.tsx` - Added 'xs' size

**Improvements**:
1. **StarRating for Community Stats**: Replaced Progress bar with fractional StarRating display
2. **"New" Badge**: Items released in last 30 days (based on metadata.release_date or year) show "New" badge
3. **Image Fallback Chain**: `item.image_url → metadata.poster_url → metadata.image`
4. **TODO Button**: Plus button to add unrated items to TODO list
5. **Enhanced Hover Effects**: `y: -4, scale: 1.02` with subtle shadow
6. **Pre-fetched User Ratings**: `initialUserRating` prop skips individual API calls
7. **Optimized API Calls**: Uses `lastFetchedItemId` ref to prevent duplicate fetches

**New Props**:
- `initialUserRating?: number | null` - Pre-fetched user rating
- `isInTodo?: boolean` - Whether item is in TODO list
- `onAddToTodo?: () => void` - Add to TODO callback
- `onRemoveFromTodo?: () => void` - Remove from TODO callback

---

### Feature: Topic Card Images

**What**: Topic cards support background images with gradient overlay.

**Files Modified**:
- `frontend/src/pages/TopicsPage.tsx` - Image support with fallback
- `frontend/src/types/index.ts` - Added `image_url` to Topic interface

**Implementation**:
- If `topic.image_url` exists: Show image with gradient overlay, icon on bottom-left
- If no image: Show muted background with centered large icon

---

### Feature: Item Detail Modal

**What**: Clickable items open a detail modal with topic-specific metadata display.

**Files Created**:
- `frontend/src/components/ItemDetailModal.tsx`

**Features**:
- Topic-specific metadata fields (movies: director, year, genre, etc.)
- Full image display
- User rating input
- Community rating display
- TODO list toggle button
- Source badge (Curated/AI/User)

**Topic Metadata Configurations**:
| Topic | Fields Displayed |
|-------|-----------------|
| Movies | Year, Director, Genre, Runtime, Cast |
| Series | Year, Seasons, Network, Creator, Genre |
| Books | Author, Year, Pages, Publisher, Genre |
| Anime | Year, Episodes, Studio, Genre, Status |
| Games | Year, Platform, Developer, Publisher, Genre |
| Restaurants | Location, Cuisine, Price Range, Address |

---

### Bug Fix: API Call Deduplication

**Problem**: React StrictMode caused duplicate API calls in HomePage and TopicsPage.

**Solution**: Added `useRef` guards to prevent duplicate fetches.

**Files Modified**:
- `frontend/src/pages/HomePage.tsx` - Added `hasFetched` ref
- `frontend/src/pages/TopicsPage.tsx` - Added `hasFetched` ref
- `frontend/src/services/profileService.ts` - Added `getCurrentProfileWithRatings()` for consolidated calls

---

### Code Quality

**Test Count**: 96 (all passing)

**Build**: Successful (731KB main bundle, acceptable for full feature set)

**Files Summary**:
- **New files**: 9 (4 migrations, 4 components/services, 1 config)
- **Modified files**: 10 (pages, services, types)
- **Database functions**: 3 new PostgreSQL functions

---

## [2026-01-02] Modal Integration & Final Wiring

### Feature: Item Detail Modal Integration

**What**: Connected the ItemDetailModal to TopicDetailPage, enabling clickable item cards that open a detail modal with full item information, rating controls, and TODO list management.

**Files Modified**:
- `frontend/src/pages/TopicDetailPage.tsx` - Complete integration with modal and TODO status tracking

**Implementation Details**:

**Modal State Management**:
- `selectedItem` state tracks which item's modal is open
- `isModalOpen` state controls modal visibility
- `todoStatus` Set tracks which items are in user's TODO list

**New Event Handlers**:
- `handleItemClick(item)` - Opens modal with item details and topic context
- `handleRatingChange(rating)` - Saves rating with optimistic update, removes from TODO if rated
- `handleAddToTodo(itemId)` - Adds item to TODO list with optimistic update
- `handleRemoveFromTodo(itemId)` - Removes item from TODO list

**Data Flow**:
1. Items fetched with server-side filtering
2. User ratings + TODO status fetched in parallel for visible items
3. Clicking item opens modal with pre-fetched data
4. Rating in modal updates local state + persists to database
5. TODO actions update local state + persist to database
6. Optimistic updates with rollback on error

**Toast Messages**:
| Action | Success | Error |
|--------|---------|-------|
| Rate item | "Noted. Your taste is... interesting." | "Couldn't save that. The database is judging you." |
| Add to TODO | "Added to your list. No pressure to actually watch it." | "Couldn't add to list. Try again?" |
| Remove from TODO | (silent) | "Couldn't remove from list." |

**Integration with ItemCard**:
- `onClick` prop triggers `handleItemClick`
- `isInTodo` prop reflects TODO status
- `onAddToTodo` / `onRemoveFromTodo` callbacks for TODO buttons
- Item passed with topic context for modal display

**Props passed to ItemDetailModal**:
- `item` - Selected item with topic attached
- `open` / `onOpenChange` - Modal visibility control
- `avgRating` / `ratingCount` - Community stats
- `userRating` - Current user's rating
- `onRatingChange` - Rating callback
- `isInTodo` - TODO status
- `onAddToTodo` / `onRemoveFromTodo` - TODO callbacks
- `isAuthenticated` - Controls what actions are shown

**Build**: Successful (766KB main bundle)
**Tests**: 96 passing

---

## [2026-01-03] TopicDetailPage Performance & UI Fixes

### Bug Fixes: API Call Deduplication and UI Issues

**What**: Fixed multiple performance and UI issues on the `/topics/:slug` page.

**Files Modified**:
- `frontend/src/pages/TopicDetailPage.tsx` - Fixed duplicate API calls and invisible items
- `frontend/src/services/statsService.ts` - Added userId parameter to avoid redundant getUser() calls
- `frontend/src/components/ItemCard.tsx` - Fixed user rating not syncing with prop changes

**Bug Details**:

**1. Duplicate /topics API Calls** (`TopicDetailPage.tsx:91-206`)
- **Issue**: Topic was fetched multiple times when `fetchItems` callback changed (due to `user` dependency in useCallback)
- **Root Cause**: `hasFetchedTopic.current` was reset every time the effect ran, including when only `fetchItems` changed
- **Fix**: Added `currentSlug` ref to track actual slug changes; only reset state when slug changes, not when fetchItems ref changes
- **How**: `if (hasFetchedTopic.current && currentSlug.current === slug) return`

**2. Duplicate /user API Calls** (`statsService.ts:340-368`)
- **Issue**: `getUserRatingsBatch()` called `supabase.auth.getUser()` internally, even though caller already had user from auth store
- **Root Cause**: Service method fetched user internally instead of accepting it as parameter
- **Fix**: Added optional `userId` parameter to `getUserRatingsBatch()`; falls back to fetching for backwards compatibility
- **How**: Pass `user.id` from TopicDetailPage: `statsService.getUserRatingsBatch(itemIds, user.id)`

**3. User Rating Not Displaying** (`ItemCard.tsx:110-115`)
- **Issue**: User ratings didn't appear after async batch load completed
- **Root Cause**: `useState` only uses initial value on mount; when `initialUserRating` prop updated asynchronously, component state didn't sync
- **Fix**: Added `useEffect` to sync state with prop when `initialUserRating` changes
- **How**: `useEffect(() => { if (initialUserRating !== undefined) setUserRating(initialUserRating) }, [initialUserRating])`

**4. Items Invisible (opacity=0) Between Searches** (`TopicDetailPage.tsx:436-439`)
- **Issue**: After search/filter changes, items were in DOM (clickable) but invisible with opacity=0
- **Root Cause**: `StaggerContainer` animation state was "animate" from previous render; new `StaggerItem` children with `initial: opacity 0` weren't triggering animation to `animate: opacity 1`
- **Fix**: Added `key` prop to `StaggerContainer` based on search parameters, forcing remount and fresh animation
- **How**: `<StaggerContainer key={\`${debouncedSearchQuery}-${activeFilter}-${currentPage}\`}>`

**Tests**: 96 passing (no changes)
**Build**: Successful (767KB main bundle)
