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

## Future Considerations

Items discussed but deferred for post-MVP:

- Additional OAuth providers (Apple, Discord, Twitter)
- Public shareable "Top X" lists
- Follow/social features
- Topic creation by users
- Firecrawl/Brave Search MCP for enhanced AI enrichment
- Recommendation engine
