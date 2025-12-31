# Changelog

All notable decisions and changes to this project will be documented in this file.

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

## Future Considerations

Items discussed but deferred for post-MVP:

- Additional OAuth providers (Apple, Discord, Twitter)
- Public shareable "Top X" lists
- Follow/social features
- Topic creation by users
- Firecrawl/Brave Search MCP for enhanced AI enrichment
- Recommendation engine
