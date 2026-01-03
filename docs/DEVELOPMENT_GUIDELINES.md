# Development Guidelines

> **CRITICAL**: These guidelines are **MANDATORY** for **EVERY** task. No exceptions. Claude MUST follow these before, during, and after any implementation.

---

## Table of Contents

1. [Pre-Task Checklist](#pre-task-checklist-always-do-first)
2. [Post-Task Checklist](#post-task-checklist-always-do-after)
3. [Core Principles](#core-principles)
4. [Security Standards (OWASP)](#security-standards-owasp)
5. [Testing Standards](#testing-standards)
6. [Code Patterns & Consistency](#code-patterns--consistency)
7. [Database Safety](#database-safety)
8. [Error Handling](#error-handling)
9. [Supabase-Specific Patterns](#supabase-specific-patterns)
10. [Accessibility Requirements](#accessibility-requirements)
11. [Dependencies](#dependencies)
12. [Commit & Change Management](#commit--change-management)

---

## Pre-Task Checklist (ALWAYS DO FIRST)

Before starting ANY task:
- [ ] Read and understand the relevant sections of this document
- [ ] Review Security Standards for potential hazards
- [ ] Check existing patterns in the codebase
- [ ] Plan the implementation approach

---

## Post-Task Checklist (ALWAYS DO AFTER)

After completing ANY task:
- [ ] Run tests: `npm run test:run`
- [ ] Run build: `npm run build`
- [ ] Update CHANGELOG.md with what changed and why
- [ ] Update documentation if architecture/patterns changed
- [ ] Review for security implications

---

## Core Principles

### 1. Security First

During analysis and implementation, always consider security hazards and edge cases. **No mistakes are allowed in this field.** Every change must be evaluated for security implications.

**Key areas:**
- Input validation and sanitization
- Authentication and authorization
- Data exposure (RLS policies)
- Secrets management
- Error messages (no info leakage)

### 2. Plan Before Build

After the basic implementation is complete, every new feature request or change must be validated through a plan and thoroughly tested. All decisions must be documented in the changelog.

**Planning process:**
1. Understand the requirement
2. Review existing patterns
3. Identify security implications
4. Create implementation plan
5. Get approval if significant
6. Implement with tests
7. Document decisions

### 3. Documentation is Law

Keeping all documentation up to date is mandatory. Documentation must always reflect the actual state of the project. **Outdated documentation is unacceptable.**

**Documentation to maintain:**
- CLAUDE.md (core reference)
- This file (guidelines)
- ARCHITECTURE.md (technical details)
- ROADMAP.md (future plans)
- CHANGELOG.md (decision log)
- Code comments (where logic isn't self-evident)

---

## Security Standards (OWASP)

Follow OWASP Top 10 guidelines. Key areas for this project:

### Vulnerability Matrix

| Vulnerability | Mitigation |
|---------------|------------|
| **Injection (SQL/NoSQL)** | Always use parameterized queries. Never concatenate user input into SQL. Supabase client handles this, but verify in Edge Functions. |
| **Broken Authentication** | Use Supabase Auth exclusively. Never implement custom auth. Validate sessions server-side. |
| **Sensitive Data Exposure** | RLS on all tables. Never expose service_role key. Audit what data is returned to clients. |
| **Broken Access Control** | RLS policies are mandatory. Test that users cannot access other users' data. Verify `auth.uid()` checks. |
| **Security Misconfiguration** | Review Supabase Dashboard settings. Disable unused auth providers. Audit RLS policies after changes. |
| **XSS** | React escapes by default. Never use `dangerouslySetInnerHTML`. Sanitize any user-generated content displayed. |
| **Insecure Deserialization** | Validate all JSON input structure. Use TypeScript types. Reject unexpected fields. |
| **Insufficient Logging** | Log security events (failed logins, permission denials). Never log sensitive data (passwords, tokens). |

### Pre-Commit Security Checklist

**Before every PR/commit, verify:**
- [ ] No secrets in code
- [ ] RLS policies cover new tables/columns
- [ ] User input is validated and sanitized
- [ ] Error messages don't leak sensitive info
- [ ] Auth checks are in place for protected routes

### Secrets Management

**NEVER commit to git:**
- `.env` files with real values
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- Any API keys, tokens, or credentials

**Safe for frontend (public):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (protected by RLS)

**Edge Function secrets:**
- Set via Supabase Dashboard (not in code)
- Access via `Deno.env.get('SECRET_NAME')`

---

## Testing Standards

Follow the **testing pyramid**:

```
        /\
       /  \        Few E2E tests (critical user flows)
      /────\
     /      \      Some integration tests (API, database)
    /────────\
   /          \    Many unit tests (functions, components)
  /────────────\
```

### Unit Tests (many)

- All utility functions
- Component rendering and interactions
- State management logic
- Input validation functions
- Edge cases and error handling

**Example:**
```typescript
describe('StarRating', () => {
  it('renders correct number of stars', () => {
    render(<StarRating rating={3} onRate={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('calls onRate with correct value', async () => {
    const onRate = vi.fn()
    render(<StarRating rating={0} onRate={onRate} />)
    await userEvent.click(screen.getAllByRole('button')[2])
    expect(onRate).toHaveBeenCalledWith(3)
  })
})
```

### Integration Tests (some)

- Supabase queries return expected data
- RLS policies work correctly
- Auth flows complete successfully
- Edge Functions respond correctly

**Example:**
```typescript
describe('ratingService', () => {
  it('creates rating and returns updated data', async () => {
    const result = await createRating('item-123', 4)
    expect(result.rating).toBe(4)
    expect(result.item_id).toBe('item-123')
  })
})
```

### E2E Tests (few)

- User registration → login → rate item → view profile
- Search → AI enrichment → item created
- OAuth flow completion

### Required Before Merge

- [ ] All existing tests pass
- [ ] New code has corresponding tests
- [ ] Manual testing of affected features
- [ ] Edge cases documented and tested:
  - Empty states
  - Long strings / special characters
  - Concurrent operations
  - Network failures
  - Invalid/malformed input

### Test Structure

```
frontend/src/
├── components/
│   └── StarRating.test.tsx
├── services/
│   └── ratingService.test.ts
├── pages/
│   └── AuthCallback.test.tsx
└── test/
    ├── setup.ts        # Global mocks, cleanup
    └── utils.tsx       # Custom render with providers
```

**Test file naming:**
- Unit tests: `*.test.ts` or `*.test.tsx`
- Co-located with the code they test

**Run tests:**
```bash
npm test              # Watch mode
npm test -- --run     # Run once
npm run test:coverage # With coverage
```

---

## Code Patterns & Consistency

### File Naming

- Components: `PascalCase.tsx` (e.g., `TopicCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Types: `types.ts` or `*.types.ts`
- Tests: `*.test.ts` or `*.test.tsx`

### Component Structure

```typescript
// 1. Imports (external, then internal, then types)
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Topic } from '../types'

// 2. Types/interfaces for this component
interface Props {
  topic: Topic
  onSelect: (id: string) => void
}

// 3. Component
export function TopicCard({ topic, onSelect }: Props) {
  // hooks first
  const [loading, setLoading] = useState(false)

  // handlers
  const handleClick = () => { ... }

  // render
  return ( ... )
}
```

### Where to Put New Code

- **Reusable UI** → `frontend/src/components/`
- **Page-specific UI** → inside the page file or `pages/[PageName]/`
- **Supabase queries** → `frontend/src/lib/` or co-located with component
- **Global state** → `frontend/src/store/`
- **Types** → `frontend/src/types/`
- **Test utilities** → `frontend/src/test/`

### Import Order

1. External dependencies (React, Supabase, etc.)
2. Internal modules (components, utilities)
3. Types (using `type` keyword)
4. CSS/styles

```typescript
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import type { Item } from '@/types'
```

---

## Database Safety

### RLS is Mandatory

- Every table must have RLS enabled
- Never use `service_role` key in frontend
- Test policies: "Can user A access user B's data?" (answer must be NO)

**Enable RLS:**
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

**Example policy:**
```sql
CREATE POLICY "Users can only view their own ratings"
  ON user_ratings FOR SELECT
  USING (auth.uid() = user_id);
```

### Migration Guidelines

1. **Test first**: Test queries in Supabase SQL editor before applying migration
2. **Descriptive names**: Use clear migration names
   - Good: `add_user_preferences_table`, `fix_rls_policy_items`
   - Bad: `update_schema`, `fix_bug`
3. **Rollback strategy**: Consider how to reverse the migration
4. **Document breaking changes**: Update CHANGELOG.md
5. **Version control**: Commit migration files to git

**Migration location:**
- `supabase/migrations/`

**Apply migrations:**
- Via Supabase MCP: `mcp__supabase__apply_migration`
- Via CLI: `supabase db push`

### Query Safety

- **Always use Supabase client methods** (not raw SQL in frontend)
- **Validate and sanitize** any dynamic values
- **Use TypeScript types** generated from schema when available

**Good:**
```typescript
const { data } = await supabase
  .from('items')
  .select('*')
  .eq('topic_id', topicId)
```

**Bad (in frontend):**
```typescript
// Never do this in frontend code
const { data } = await supabase.rpc('execute_raw_sql', {
  query: `SELECT * FROM items WHERE topic_id = '${topicId}'`
})
```

---

## Error Handling

### User-Facing Errors (Brand Voice)

Match the "backend dev who reluctantly built a frontend" personality:

- **Generic**: *"Something broke. Honestly, I'm surprised it worked this long."*
- **Not found**: *"Couldn't find that. Maybe it doesn't exist. Maybe I'm bad at searching."*
- **Auth required**: *"You need to log in for this. I know, I know, another login."*
- **Network**: *"Can't reach the server. It's probably my fault."*
- **Rate limit**: *"Slow down there, speed racer. Try again in a sec."*
- **Validation**: *"That doesn't look right. Check your input."*

### Technical Errors

**In development:**
- Log to console with context
- Include stack traces
- Show detailed error messages

**In production:**
- Generic user-facing messages
- Never expose stack traces to users
- Never log sensitive data (tokens, passwords, PII)
- Include context: what operation failed, what user action triggered it

**Example:**
```typescript
try {
  await createRating(itemId, rating)
} catch (error) {
  console.error('Failed to create rating:', { itemId, rating, error })
  toast.error("Something broke. Honestly, I'm surprised it worked this long.")
}
```

### Error Boundaries

- Wrap major sections in React Error Boundaries
- Provide recovery actions when possible
- Log errors for debugging

**Example:**
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <YourComponent />
</ErrorBoundary>
```

---

## Supabase-Specific Patterns

### When to Use Edge Functions vs Client Queries

| Use Case | Solution |
|----------|----------|
| Simple CRUD protected by RLS | Client query |
| Complex business logic | Edge Function |
| External API calls | Edge Function |
| Operations needing service_role | Edge Function |
| AI enrichment | Edge Function |
| Batch processing | Edge Function + pg_cron |

### Edge Function Structure

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req: Request) => {
  try {
    // 1. Validate request
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 2. Authenticate (verify JWT if needed)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 3. Parse and validate input
    const body = await req.json()
    // ... validation logic

    // 4. Business logic
    // ... your code here

    // 5. Return response
    return new Response(JSON.stringify({ data }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    // Log error (not to user)
    console.error('Function error:', error)

    return new Response(JSON.stringify({
      error: 'Something went wrong' // Generic message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

### RLS Policy Testing

After any RLS change, verify:

1. **Unauthenticated users see only public data**
   ```sql
   -- Test as anonymous user
   SET LOCAL ROLE anon;
   SELECT * FROM items; -- Should only see public items
   ```

2. **Authenticated users see only their own private data**
   ```sql
   -- Test as authenticated user
   SET LOCAL request.jwt.claims = '{"sub": "user-123"}';
   SELECT * FROM user_ratings; -- Should only see user-123's ratings
   ```

3. **Users cannot modify other users' data**
   ```sql
   -- Attempt to update another user's data
   UPDATE user_ratings SET rating = 5 WHERE user_id = 'other-user';
   -- Should fail or return 0 rows affected
   ```

4. **Admin operations (if any) are properly restricted**

---

## Accessibility Requirements

### Minimum Standards (WCAG 2.1 AA)

- [ ] All interactive elements keyboard accessible (Tab, Enter, Space, Arrow keys)
- [ ] Focus indicators visible (2px outline minimum)
- [ ] Color contrast: 4.5:1 for normal text, 3:1 for large text
- [ ] Images have alt text (or aria-hidden if decorative)
- [ ] Form inputs have associated labels
- [ ] Error messages announced to screen readers (aria-live)
- [ ] Landmarks for navigation (nav, main, footer)
- [ ] Heading hierarchy (h1 → h2 → h3, no skipping)

### Dark/Light Mode

- Both modes must meet contrast requirements
- Test both modes for readability
- Respect system preference by default
- Provide manual toggle for user preference

### Testing

1. **Keyboard navigation**: Tab through entire page
2. **Screen reader**: Test with NVDA (Windows) or VoiceOver (Mac)
3. **Contrast checker**: Use browser DevTools or online tool
4. **Focus indicators**: Ensure visible on all interactive elements

**Example:**
```tsx
<button
  className="focus:ring-2 focus:ring-primary focus:outline-none"
  aria-label="Rate 5 stars"
  onClick={() => onRate(5)}
>
  ★
</button>
```

---

## Dependencies

### When to Add a New Dependency

Ask these questions before adding any dependency:

1. **Does it solve a real problem we have now?** (not hypothetical)
2. **Is there a simpler solution without adding a dep?**
3. **Is it actively maintained?** (check last commit, issues, stars)
4. **What's the bundle size impact?** (use bundlephobia.com)
5. **Does it have security vulnerabilities?** (check npm audit)

### Preferences

- Smaller packages over feature-rich ones
- Well-maintained over popular
- TypeScript support preferred
- Check if Supabase/React already provides the functionality

### Before Adding, Document

In PR or commit message:
- Why this package
- What alternatives were considered
- Bundle size impact
- Security audit results

**Example PR description:**
```
Adding `date-fns` for date formatting

Why: Need to format dates in user profile (e.g., "2 days ago")
Alternatives considered:
  - Built-in Intl.DateTimeFormat (too limited)
  - moment.js (too heavy, 67kb)
Bundle size: 13kb gzipped (via date-fns/formatDistanceToNow)
Security: npm audit clean, actively maintained
```

---

## Commit & Change Management

### Commit Messages

- Clear and descriptive
- Reference what changed and why
- Use conventional commits format (will be standardized when Linear integration is added)

**Good:**
```
Add dark mode toggle to header

Users can now switch between light/dark themes via toggle in header.
Respects system preference on initial load.
```

**Bad:**
```
Update header
```

### Change Process (Post-MVP)

For significant changes:

1. **Document the proposed change**
   - What needs to change and why
   - Alternatives considered
   - Impact on existing functionality

2. **Create a plan with implementation steps**
   - Break down into smaller tasks
   - Identify dependencies
   - Estimate complexity (not time)

3. **Get approval if significant**
   - Discuss with team/stakeholders
   - Review security implications
   - Ensure alignment with roadmap

4. **Implement with tests**
   - Follow TDD when possible
   - Write tests for new functionality
   - Update existing tests if needed

5. **Update all affected documentation**
   - CLAUDE.md (if core patterns changed)
   - ARCHITECTURE.md (if technical details changed)
   - ROADMAP.md (if priorities shifted)
   - This file (if guidelines changed)

6. **Add entry to CHANGELOG.md**
   - Date
   - What changed
   - Why it changed
   - Any breaking changes
   - Migration steps if needed

7. **Review security implications**
   - Run security checklist
   - Verify RLS policies
   - Check for sensitive data exposure

### CHANGELOG Entries

**Required fields:**
- Date
- What changed
- Why it changed
- Any breaking changes
- Migration steps if needed

**Example:**
```markdown
## 2025-01-03

### Changed: Documentation Structure
**What:** Split CLAUDE.md into focused documents (ARCHITECTURE.md, ROADMAP.md, DEVELOPMENT_GUIDELINES.md)
**Why:** Reduce token usage and improve performance by loading only relevant sections
**Breaking:** None
**Migration:** Update any references to sections now in separate files
```

---

## Quick Reference Checklist

Before submitting any code:

- [ ] Pre-task checklist completed
- [ ] Code follows established patterns
- [ ] Tests written and passing
- [ ] Security implications reviewed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Build succeeds
- [ ] Accessibility verified
- [ ] Error handling in place
- [ ] Post-task checklist completed

---

**Last updated:** 2025-01-03
