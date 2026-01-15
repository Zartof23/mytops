# Testing Context

> **Load this file when working on:** Writing tests, fixing test failures, test infrastructure, coverage improvements.

---

## Test Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner (Jest-compatible) |
| **React Testing Library** | Component testing |
| **@testing-library/user-event** | User interaction simulation |
| **jsdom** | DOM environment |

---

## Running Tests

```bash
cd frontend

# Watch mode (development)
npm test

# Run once (CI)
npm test -- --run

# With coverage
npm run test:coverage
```

---

## Test Structure

```
frontend/src/
├── components/
│   ├── StarRating.tsx
│   └── StarRating.test.tsx      # Co-located test
├── services/
│   ├── ratingService.ts
│   └── ratingService.test.ts    # Co-located test
├── pages/
│   ├── AuthCallback.tsx
│   └── AuthCallback.test.tsx
└── test/
    ├── setup.ts                 # Global setup, mocks
    └── utils.tsx                # Custom render, providers
```

---

## Test Setup

### Global Setup (`test/setup.ts`)

```typescript
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn()
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis()
    }),
    rpc: vi.fn()
  }
}))

// Mock IntersectionObserver for LazyImage
beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn((element) => {
      callback([{ isIntersecting: true, target: element }])
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))
})
```

### Custom Render (`test/utils.tsx`)

```typescript
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ReactElement } from 'react'

interface WrapperProps {
  children: React.ReactNode
}

function Wrapper({ children }: WrapperProps) {
  return <BrowserRouter>{children}</BrowserRouter>
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: Wrapper, ...options })
}

export * from '@testing-library/react'
export { customRender as render }
```

---

## Testing Patterns

### Component Tests

```typescript
import { render, screen } from '@/test/utils'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { StarRating } from './StarRating'

describe('StarRating', () => {
  it('renders correct number of stars', () => {
    render(<StarRating rating={3} onRate={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('calls onRate with correct value', async () => {
    const user = userEvent.setup()
    const onRate = vi.fn()

    render(<StarRating rating={0} onRate={onRate} />)
    await user.click(screen.getAllByRole('button')[2])

    expect(onRate).toHaveBeenCalledWith(3)
  })

  it('shows hover preview on mouse enter', async () => {
    const user = userEvent.setup()
    render(<StarRating rating={0} onRate={vi.fn()} />)

    await user.hover(screen.getAllByRole('button')[3])

    // Check for visual change (filled stars)
    expect(screen.getByLabelText(/rate 4/i)).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    render(<StarRating rating={3} onRate={vi.fn()} disabled />)

    screen.getAllByRole('button').forEach(button => {
      expect(button).toBeDisabled()
    })
  })
})
```

### Service Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ratingService } from './ratingService'
import { supabase } from '@/lib/supabase'

// Mock the supabase module
vi.mock('@/lib/supabase')

describe('ratingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('upsertRating', () => {
    it('creates rating successfully', async () => {
      const mockRating = { id: '1', item_id: 'item-1', rating: 4 }

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null
      })

      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockRating, error: null })
          })
        })
      } as any)

      const result = await ratingService.upsertRating({
        itemId: 'item-1',
        rating: 4
      })

      expect(result).toEqual(mockRating)
    })

    it('throws error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      })

      await expect(
        ratingService.upsertRating({ itemId: 'item-1', rating: 4 })
      ).rejects.toThrow('Not authenticated')
    })
  })
})
```

### Page Tests

```typescript
import { render, screen, waitFor } from '@/test/utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthCallback } from './AuthCallback'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

describe('AuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/auth/callback')
  })

  it('shows loading state initially', () => {
    render(<AuthCallback />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('redirects on existing session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: '1' } } },
      error: null
    })

    render(<AuthCallback />)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })
  })

  it('shows error for URL error params', () => {
    window.history.pushState({}, '', '/auth/callback?error=access_denied')

    render(<AuthCallback />)

    expect(screen.getByText(/access_denied/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument()
  })
})
```

### Animation Component Tests

```typescript
import { render, screen } from '@/test/utils'
import { describe, it, expect, vi } from 'vitest'
import { PageTransition, StaggerContainer } from './PageTransition'

// Mock framer-motion to avoid animation timing issues
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}))

describe('PageTransition', () => {
  it('renders children', () => {
    render(
      <PageTransition>
        <div data-testid="child">Content</div>
      </PageTransition>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})
```

---

## Testing Edge Cases

### Empty States

```typescript
it('shows empty state when no items', () => {
  render(<ItemList items={[]} />)
  expect(screen.getByText(/no items found/i)).toBeInTheDocument()
})
```

### Loading States

```typescript
it('shows skeleton while loading', () => {
  render(<ItemCard isUserDataLoading={true} />)
  expect(screen.getByTestId('skeleton')).toBeInTheDocument()
})
```

### Error States

```typescript
it('shows error message on fetch failure', async () => {
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockResolvedValue({ data: null, error: new Error('Failed') })
  } as any)

  render(<TopicDetailPage />)

  await waitFor(() => {
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })
})
```

### Authentication States

```typescript
it('shows sign-in prompt when not authenticated', () => {
  useAuthStore.setState({ user: null })
  render(<ItemCard item={mockItem} />)
  expect(screen.getByText(/sign in to rate/i)).toBeInTheDocument()
})

it('shows rating controls when authenticated', () => {
  useAuthStore.setState({ user: mockUser })
  render(<ItemCard item={mockItem} />)
  expect(screen.getByRole('group', { name: /rating/i })).toBeInTheDocument()
})
```

---

## Mocking Patterns

### Supabase Client

```typescript
// Mock successful query
vi.mocked(supabase.from).mockReturnValue({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: [mockItem], error: null })
  })
} as any)

// Mock error
vi.mocked(supabase.from).mockReturnValue({
  select: vi.fn().mockResolvedValue({
    data: null,
    error: { message: 'Database error' }
  })
} as any)
```

### Router Navigation

```typescript
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ slug: 'movies' })
}))
```

### Toast Notifications

```typescript
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

// Assert toast was called
expect(toast.success).toHaveBeenCalledWith("Noted. Your taste is... interesting.")
```

---

## Test Pyramid

```
        /\
       /  \        Few E2E tests (critical user flows)
      /────\
     /      \      Some integration tests (API, database)
    /────────\
   /          \    Many unit tests (functions, components)
  /────────────\
```

### Current Coverage

| Category | Test Count | Focus |
|----------|-----------|-------|
| Components | ~50 | StarRating, ItemCard, SEO, PageTransition |
| Services | ~30 | ratingService, statsService, profileService, todoService |
| Pages | ~20 | AuthCallback, key page behaviors |
| **Total** | **119** | |

---

## Required Before Merge

- [ ] All existing tests pass (`npm test -- --run`)
- [ ] New code has corresponding tests
- [ ] Edge cases covered:
  - Empty states
  - Loading states
  - Error states
  - Auth states
- [ ] No console errors in tests
- [ ] Build succeeds (`npm run build`)

---

## Debugging Tests

### Run single test file

```bash
npm test -- StarRating.test.tsx
```

### Run with verbose output

```bash
npm test -- --reporter=verbose
```

### Debug in browser

```bash
npm test -- --ui
```

### Check coverage

```bash
npm run test:coverage
```

---

**See also:**
- Testing standards: `docs/DEVELOPMENT_GUIDELINES.md`
- Component patterns: `docs/context/FRONTEND_CONTEXT.md`
