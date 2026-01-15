# Frontend Context

> **Load this file when working on:** React components, UI/UX, state management, styling, routing, client-side logic.

---

## Project Structure

```
frontend/src/
├── components/
│   ├── ui/              # shadcn/ui primitives (Button, Card, Input, etc.)
│   ├── Layout.tsx       # Main layout (header, nav, footer)
│   ├── ItemCard.tsx     # Item display with rating
│   ├── StarRating.tsx   # 5-star rating component
│   ├── LazyImage.tsx    # Optimized lazy-loading images
│   ├── EnrichmentPrompt.tsx  # AI enrichment UI
│   ├── ErrorBoundary.tsx
│   ├── RouteGuards.tsx  # ProtectedRoute, PublicOnlyRoute
│   ├── SEO.tsx          # Meta tags and structured data
│   └── PageTransition.tsx  # Animation wrappers
├── pages/
│   ├── HomePage.tsx
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── TopicsPage.tsx
│   ├── TopicDetailPage.tsx
│   ├── ProfilePage.tsx
│   ├── PublicProfilePage.tsx
│   └── AuthCallback.tsx
├── services/
│   ├── ratingService.ts
│   ├── statsService.ts
│   ├── profileService.ts
│   ├── todoService.ts
│   └── enrichmentService.ts
├── hooks/
│   └── useEnrichment.ts
├── lib/
│   ├── supabase.ts      # Supabase client instance
│   ├── hooks.ts         # Custom React hooks
│   ├── utils.ts         # Utility functions (cn)
│   ├── storage.ts       # Storage URL helpers
│   └── animations.ts    # Framer Motion presets
├── store/
│   └── authStore.ts     # Zustand auth state
├── types/
│   └── index.ts         # TypeScript types
├── test/
│   ├── setup.ts         # Global test setup
│   └── utils.tsx        # Test utilities
├── App.tsx              # Route configuration
└── main.tsx             # Entry point
```

---

## Component Patterns

### Component Structure

```typescript
// 1. Imports (external, then internal, then types)
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import type { Topic } from '@/types'

// 2. Types/interfaces for this component
interface Props {
  topic: Topic
  onSelect: (id: string) => void
}

// 3. Component with named export
export function TopicCard({ topic, onSelect }: Props) {
  // hooks first
  const [loading, setLoading] = useState(false)

  // handlers
  const handleClick = () => { /* ... */ }

  // render
  return ( /* ... */ )
}
```

### File Naming

- Components: `PascalCase.tsx` (e.g., `TopicCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Types: `types.ts` or `*.types.ts`
- Tests: `*.test.ts` or `*.test.tsx` (co-located)

### Import Order

1. External dependencies (React, Supabase, etc.)
2. Internal modules (components, utilities)
3. Types (using `type` keyword)

```typescript
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import type { Item } from '@/types'
```

---

## shadcn/ui Components

### Configuration

- **Style:** `new-york` (sharper, minimal)
- **Color:** `neutral` (monochrome)
- **Path alias:** `@/` maps to `src/`
- **Config file:** `frontend/components.json`

### Available Components

```
ui/
├── accordion.tsx    ├── label.tsx
├── avatar.tsx       ├── progress.tsx
├── badge.tsx        ├── scroll-area.tsx
├── button.tsx       ├── separator.tsx
├── card.tsx         ├── skeleton.tsx
├── dialog.tsx       ├── sonner.tsx (toasts)
├── dropdown-menu.tsx├── tabs.tsx
├── input.tsx        └── tooltip.tsx
```

### Usage

```typescript
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

// Button variants: default, destructive, outline, secondary, ghost, link
<Button variant="outline" size="sm">Click</Button>

// Toast with brand voice
toast.success("Noted. Your taste is... interesting.")
toast.error("Couldn't save that. The database is judging you.")
```

---

## State Management

### Zustand Store (Global State)

```typescript
// store/authStore.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  session: Session | null
  initialized: boolean
  setAuth: (user: User | null, session: Session | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  initialized: false,
  setAuth: (user, session) => set({ user, session, initialized: true })
}))
```

### Local State (Component)

Use React hooks for component-specific state:

```typescript
const [loading, setLoading] = useState(false)
const [items, setItems] = useState<Item[]>([])
const [error, setError] = useState<string | null>(null)
```

### Data Fetching Pattern

```typescript
useEffect(() => {
  const hasFetched = useRef(false)

  async function fetchData() {
    if (hasFetched.current) return  // Prevent duplicate calls
    hasFetched.current = true

    try {
      setLoading(true)
      const { data, error } = await supabase.from('items').select('*')
      if (error) throw error
      setItems(data)
    } catch (error) {
      console.error('Fetch error:', error)
      toast.error("Something broke. Honestly, I'm surprised it worked this long.")
    } finally {
      setLoading(false)
    }
  }

  fetchData()
}, [])
```

---

## Routing & Auth

### Route Configuration

```typescript
// App.tsx
<Routes>
  {/* Public routes */}
  <Route path="/" element={<HomePage />} />
  <Route path="/topics" element={<TopicsPage />} />
  <Route path="/topics/:slug" element={<TopicDetailPage />} />

  {/* Auth routes (redirect if logged in) */}
  <Route element={<PublicOnlyRoute />}>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
  </Route>

  {/* Protected routes (require auth) */}
  <Route element={<ProtectedRoute />}>
    <Route path="/profile" element={<ProfilePage />} />
  </Route>
</Routes>
```

### Route Guards

```typescript
// ProtectedRoute: redirects to /login if not authenticated
// PublicOnlyRoute: redirects to / if already authenticated

// Usage
<Route element={<ProtectedRoute />}>
  <Route path="/profile" element={<ProfilePage />} />
</Route>
```

### Auth Flow

```typescript
// Check session
const { data: { session } } = await supabase.auth.getSession()

// Listen to auth changes
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.getState().setAuth(session?.user ?? null, session)
})

// Sign out
await supabase.auth.signOut()
```

---

## Styling Patterns

### Tailwind CSS

```typescript
// Use cn() for conditional classes
import { cn } from '@/lib/utils'

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === "large" && "text-lg"
)} />
```

### Dark/Light Mode

- Tailwind `dark:` prefix for dark mode styles
- Theme toggle uses `class` strategy on `<html>`
- System preference detection on load

```typescript
// Dark mode classes
<div className="bg-background text-foreground dark:bg-background dark:text-foreground" />
```

### Responsive Design

```typescript
// Mobile-first approach
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />

// Breakpoints: sm (640), md (768), lg (1024), xl (1280)
```

---

## Animations

### Framer Motion Presets

```typescript
import { pageTransition, staggerContainer, staggerItem } from '@/lib/animations'

// Page transitions
<motion.div {...pageTransition}>
  <PageContent />
</motion.div>

// Staggered children
<motion.div variants={staggerContainer} initial="hidden" animate="show">
  {items.map(item => (
    <motion.div key={item.id} variants={staggerItem}>
      <ItemCard />
    </motion.div>
  ))}
</motion.div>
```

### AnimatePresence for Lists

```typescript
import { AnimatePresence, motion } from 'framer-motion'

<AnimatePresence mode="popLayout">
  {items.map(item => (
    <motion.div
      key={item.id}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <ItemCard item={item} />
    </motion.div>
  ))}
</AnimatePresence>
```

---

## Service Layer

### Pattern

```typescript
// services/ratingService.ts
import { supabase } from '@/lib/supabase'
import type { UserRating } from '@/types'

export const ratingService = {
  async upsertRating(input: { itemId: string; rating: number }): Promise<UserRating> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('user_ratings')
      .upsert({
        user_id: user.id,
        item_id: input.itemId,
        rating: input.rating
      }, { onConflict: 'user_id,item_id' })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getUserRating(itemId: string): Promise<number | null> {
    // ...
  }
}
```

### Optimistic Updates

```typescript
const handleRate = async (newRating: number) => {
  const previousRating = userRating
  setUserRating(newRating)  // Optimistic update

  try {
    await ratingService.upsertRating({ itemId, rating: newRating })
    toast.success("Noted. Your taste is... interesting.")
  } catch (error) {
    setUserRating(previousRating)  // Rollback on error
    toast.error("Couldn't save that. The database is judging you.")
  }
}
```

---

## Error Handling

### Brand Voice Messages

| Context | Message |
|---------|---------|
| Generic | "Something broke. Honestly, I'm surprised it worked this long." |
| Not found | "Couldn't find that. Maybe it doesn't exist. Maybe I'm bad at searching." |
| Auth required | "You need to log in for this. I know, I know, another login." |
| Network | "Can't reach the server. It's probably my fault." |
| Rate limit | "Slow down there, speed racer. Try again in a sec." |

### Error Boundary

```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

---

## SEO & Meta Tags

```typescript
import { SEO, WebsiteSchema } from '@/components/SEO'

// In page component
<SEO
  title="Movies | mytops"
  description="Browse and rate your favorite movies"
  url="https://mytops.io/topics/movies"
/>
<WebsiteSchema />
```

---

## Key Components Reference

### StarRating

```typescript
<StarRating
  rating={4.5}
  onRate={(value) => handleRate(value)}
  size="md"  // xs, sm, md, lg
  disabled={!isAuthenticated}
/>
```

### ItemCard

```typescript
<ItemCard
  item={item}
  onClick={() => openModal(item)}
  initialUserRating={ratings[item.id]}
  isInTodo={todoStatus.has(item.id)}
  isUserDataLoading={loadingUserData}
  stats={{ avgRating: 4.2, ratingCount: 15 }}
/>
```

### LazyImage

```typescript
<LazyImage
  src={imageUrl}
  alt="Movie poster"
  className="w-full h-64 object-cover"
  width={300}
  height={400}
  fetchPriority="high"  // For LCP images
/>
```

---

## Accessibility Checklist

- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible (2px outline)
- [ ] Color contrast 4.5:1 for text
- [ ] Images have alt text
- [ ] Form inputs have labels
- [ ] aria-live for dynamic content
- [ ] Semantic HTML landmarks

---

**See also:**
- Full architecture: `docs/ARCHITECTURE.md`
- Testing patterns: `docs/context/TESTING_CONTEXT.md`
- shadcn/ui docs: https://ui.shadcn.com
