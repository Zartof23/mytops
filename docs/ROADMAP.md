# Product Roadmap

This document outlines the current capabilities and future development plans for mytops.

---

## Current State (MVP 1 - COMPLETED)

### What Users Can Do Now

#### End-to-End User Flows

1. **Authentication Flow**
   - Register with email/password
   - Login with email/password
   - OAuth login via Google or GitHub
   - Automatic profile creation on signup
   - Persistent session management
   - Password reset flow

2. **Browse & Discover Items**
   - Browse 6 predefined topics (Movies, Series, Books, Anime, Games, Restaurants)
   - View items with rich metadata:
     - Title, description, image URL
     - Topic-specific fields (genre, release date, etc.)
   - Search within topics (debounced, real-time filtering)
   - View item statistics (total ratings, average rating)

3. **Rate & Curate**
   - Rate any item 1-5 stars
   - Add items to personal "preferables" collection via rating
   - Update ratings (change stars)
   - Remove items from collection (clear rating)
   - Optimistic UI updates with automatic rollback on error
   - Toast notifications for feedback

4. **Profile Management**
   - View personal profile page
   - See all rated items organized by topic
   - View rating history
   - Responsive design (mobile, tablet, desktop)

#### Technical Features Delivered

- **Authentication**: Full Supabase Auth integration (Email + Google + GitHub OAuth)
- **Database**: PostgreSQL via Supabase with RLS on all tables
- **UI/UX**:
  - shadcn/ui component library (new-york style, neutral monochrome palette)
  - Dark/light mode with system preference detection
  - Responsive, mobile-first design
  - Accessible (keyboard navigation, screen reader support)
- **Testing**: 50+ tests across components, services, and pages
- **Deployment**: Production site at https://mytops.io (Cloudflare Pages)
- **State Management**: Zustand for global state
- **Error Handling**: Toast notifications with brand voice

#### Current Limitations

- **No AI enrichment**: Database has only pre-seeded items (20+ items)
- **No dynamic item creation**: Users can't add items not in database
- **No recommendations**: No personalized suggestions
- **Static topics**: Users can't create custom topics
- **No social features**: No public sharing, follows, or lists
- **No profile customization**: Display name is email (no custom names)

---

## Future MVPs

### MVP 2: AI-Powered Database Growth (Next Priority)

**Vision:** Transform from a static database to a self-building, AI-powered database that grows organically as users search for new items.

#### What Users Will Be Able to Do

1. **Search for Any Item**
   - Search for movies, books, games, etc. that don't exist in database yet
   - If item not found, request AI enrichment
   - AI automatically generates rich metadata (title, description, genre, release date, image URL, etc.)
   - Item appears in database for all users

2. **Community-Driven Database Expansion**
   - Every search for a new item contributes to the database
   - Users benefit from others' searches
   - Database grows organically based on user interest

3. **AI Enrichment Feedback**
   - See when an item is being enriched ("AI is thinking...")
   - Get notified when enrichment completes
   - Automatic redirect to newly created item

#### Technical Requirements

**Edge Functions:**
- `ai-enrich-item`: Endpoint for triggering AI enrichment
  - Input: item name, topic
  - Output: enriched item data (title, description, metadata)
  - Uses Claude API for metadata generation
  - Validates and structures response
  - Inserts into database

**Database:**
- `ai_enrichment_queue` table (already exists)
  - Track pending enrichment requests
  - Prevent duplicate requests
  - Store enrichment status (pending, in_progress, completed, failed)

**Background Jobs:**
- pg_cron job to process enrichment queue
- Batch processing for efficiency
- Error handling and retry logic

**Frontend:**
- "Item not found" UI with "Request AI enrichment" button
- Loading states during enrichment
- Toast notifications on completion/failure

**AI Integration:**
- Claude API integration (Anthropic)
- Prompt engineering for metadata extraction
- Fallback for API failures
- Rate limiting and cost management

#### Implementation Steps

1. Create `ai-enrich-item` Edge Function
2. Update `ai_enrichment_queue` table schema
3. Create pg_cron job for queue processing
4. Build frontend UI for enrichment flow
5. Test end-to-end flow
6. Deploy and monitor

#### Success Metrics

- Number of items enriched per day
- AI enrichment success rate
- User satisfaction with AI-generated metadata
- Database growth rate

---

### MVP 3: Recommendations & Profile Monetization

**Vision:** Provide personalized recommendations based on user preferences and introduce monetization via profile customization.

#### What Users Will Be Able to Do

##### Personalized Recommendations

1. **AI-Powered Suggestions**
   - See "Because you liked X, you might enjoy Y" recommendations
   - Recommendations based on rated items
   - Horizontal carousel on topic pages or profile
   - Refresh for new suggestions

2. **Smart Discovery**
   - Discover items similar to favorites
   - Find items in related genres
   - Trending items in preferred topics

##### Profile Customization (Monetization)

1. **Custom Display Name** (paid feature)
   - Purchase custom display name via Stripe or BuyMeACoffee
   - One-time payment or subscription
   - Display name shown on public profile and ratings (future)
   - Fallback to email if not purchased

2. **Profile Badges** (paid feature)
   - Supporter badge for paying users
   - Early adopter badge
   - Power user badge (based on ratings count)

#### Technical Requirements

**Recommendation Engine:**
- Algorithm for item similarity (genre, tags, ratings)
- User preference analysis based on rating history
- AI-assisted recommendations (Claude API)
- Caching for performance

**Payment Integration:**
- Stripe or BuyMeACoffee integration
- Webhook handling for payment confirmation
- User entitlement tracking (who paid, when, for what)
- Subscription management (if recurring)

**Database:**
- `user_entitlements` table
  - user_id, entitlement_type, status, expires_at
- `user_preferences` table
  - custom_display_name, show_badges, etc.

**Frontend:**
- Recommendation carousel component
- Payment flow UI
- Profile customization settings
- Badge display

#### Implementation Steps

1. Build recommendation algorithm
2. Create recommendation API endpoint
3. Integrate payment provider
4. Build payment flow UI
5. Add profile customization settings
6. Test end-to-end payment flow
7. Deploy and monitor

#### Success Metrics

- Recommendation click-through rate
- Payment conversion rate
- Revenue generated
- User retention after purchase

---

### MVP 4: Social Features

**Vision:** Enable users to share their curated lists, follow other users, and discover trending items.

#### What Users Will Be Able to Do

1. **Public Sharing**
   - Share "Top 10" lists publicly
   - Generate shareable links
   - Embed lists on external sites
   - View others' public lists

2. **Follow System**
   - Follow other users
   - See followers/following counts
   - Activity feed of followed users
   - Notifications for new ratings from followed users

3. **Discovery & Trending**
   - Trending items (most rated this week)
   - Popular items (highest average rating)
   - Recently added items
   - Community recommendations

4. **Custom Topics** (user-created)
   - Create custom topics (e.g., "My favorite coffee shops")
   - Share custom topics publicly
   - Follow other users' custom topics
   - Moderation for public topics

#### Technical Requirements

**Database:**
- `user_lists` table (shareable lists)
- `user_follows` table (social graph)
- `user_topics` table (custom topics)
- `trending_items` materialized view
- `notifications` table

**Backend:**
- List sharing API
- Follow/unfollow endpoints
- Trending items calculation (scheduled job)
- Notification system

**Frontend:**
- List builder UI
- Follow button component
- Activity feed
- Trending page
- Custom topic creation UI

#### Implementation Steps

1. Design social graph schema
2. Build follow system
3. Create list sharing feature
4. Build trending calculation
5. Add notifications
6. Create custom topics feature
7. Test end-to-end social flows
8. Deploy and monitor

#### Success Metrics

- Number of public lists shared
- Follow/follower growth rate
- Engagement with trending items
- Custom topics created

---

### MVP 5: Advanced Features (Future)

**Long-term possibilities:**

1. **Mobile App**
   - React Native app
   - Or PWA with offline support
   - Push notifications

2. **Additional OAuth Providers**
   - Apple
   - Discord
   - Twitter/X

3. **Enhanced Search**
   - Firecrawl integration for web scraping
   - Brave Search MCP for real-time data
   - Image search (find items by poster/cover)

4. **Gamification**
   - Points for ratings
   - Achievements/badges
   - Leaderboards
   - Challenges (rate X items this week)

5. **Analytics Dashboard**
   - User rating patterns
   - Topic preferences over time
   - Comparison with community averages
   - Export data (CSV, JSON)

6. **AI Chat Assistant**
   - Ask questions about items ("What's a good sci-fi movie?")
   - Get personalized recommendations via chat
   - Natural language search

7. **Import from Other Platforms**
   - Import from IMDb, Goodreads, Steam, etc.
   - Bulk rating import
   - Automatic enrichment for imported items

---

## Prioritization Framework

Features are prioritized based on:

1. **User Value**: How much does this improve the core experience?
2. **Monetization**: Does this enable revenue generation?
3. **Differentiation**: Does this make mytops unique?
4. **Complexity**: Can we ship this quickly and safely?
5. **Dependencies**: What must be built first?

---

## Changelog

- **2025-01-03**: Created roadmap document with clear MVP breakdown
- **MVP 1**: Completed core authentication, rating, and profile features
- **Next**: MVP 2 (AI-powered database growth) is the priority

---

**Last updated:** 2025-01-03
