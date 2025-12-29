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

## Future Considerations

Items discussed but deferred for post-MVP:

- Additional OAuth providers (Apple, Discord, Twitter)
- Public shareable "Top X" lists
- Follow/social features
- Topic creation by users
- Firecrawl/Brave Search MCP for enhanced AI enrichment
- Recommendation engine
