# SEO & Performance Optimization Plan for mytops.io

## Summary

This plan addresses SEO and performance issues identified through code analysis. The current application has a solid foundation but lacks critical SEO infrastructure and has several performance optimization opportunities.

**Scope:** All phases (SEO + Performance + Accessibility)
**Dependencies:** Will add `vite-plugin-compression` for gzip/brotli
**Images:** User will generate favicon/OG images using provided prompts
**Skill to use:** `/react-specialist` for implementation

---

## Pre-Implementation: Documentation to Read

Before starting, read these project files to understand patterns and requirements:

1. **`docs/DEVELOPMENT_GUIDELINES.md`** - MANDATORY development standards
2. **`docs/ARCHITECTURE.md`** - Technical architecture details
3. **`docs/CHANGELOG.md`** - Decision log (must update after implementation)
4. **`CLAUDE.md`** - Project overview and coding patterns

### Key Project Patterns to Follow:
- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui (new-york style, neutral palette)
- Error messages use brand voice: self-deprecating, honest
- All components should support reduced motion (`useReducedMotion`)
- Use existing patterns from `SEO.tsx` for structured data

---

## Phase 1: Critical SEO Infrastructure (Missing Files)

### 1.1 Fix `index.html` Meta Tags
**File:** `frontend/index.html`

Current state is barebones:
```html
<title>frontend</title>  <!-- Not descriptive -->
<link rel="icon" type="image/svg+xml" href="/vite.svg" />  <!-- Generic Vite icon -->
```

**Changes needed:**
- Add proper `<title>` with brand name
- Add `<meta name="description">`
- Add Open Graph meta tags for static crawlers (SSR bots)
- Add Twitter Card meta tags
- Add theme-color meta
- Add preconnect hints for Supabase
- Add proper favicon and apple-touch-icon
- Add `<html lang="en">` verification

### 1.2 Create `robots.txt`
**File:** `frontend/public/robots.txt` (NEW)

Currently missing. Create with:
- Allow all crawlers
- Point to sitemap
- Disallow private routes (/profile, /auth)

### 1.3 Create `sitemap.xml`
**File:** `frontend/public/sitemap.xml` (NEW)

Currently missing. Create static sitemap with:
- Homepage
- Topics page
- Individual topic pages (movies, series, books, anime, games, restaurants)

### 1.4 Create Proper Favicon Set
**Files:** `frontend/public/` (NEW files)

Current: Only `vite.svg` exists
Needed:
- `favicon.ico` (32x32)
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png` (180x180)
- `site.webmanifest`

#### Favicon Image Generation Prompt:
```
Create a minimal, modern favicon/app icon for "mytops" - a personal favorites tracking app.

Style: Monochrome, minimalist, works on both light and dark backgrounds
Concept: Abstract representation of "favorites" or "top picks" - could be:
- A stylized "m" lettermark
- Star/bookmark icon with clean geometric lines
- Layered cards or list icon suggesting curation
- Simple crown or podium suggesting "top"

Requirements:
- Must be legible at 16x16 pixels
- Clean edges, no fine details
- Single color (black or dark gray) on transparent background
- Modern, slightly playful but professional

Brand personality: "Built by a backend dev" - honest, minimal, no-nonsense
```

#### Favicon File Placement:
After generating, create these sizes and place in `frontend/public/`:
| File | Size | Format |
|------|------|--------|
| `favicon.ico` | 32x32 | ICO (or PNG renamed) |
| `favicon-16x16.png` | 16x16 | PNG |
| `favicon-32x32.png` | 32x32 | PNG |
| `apple-touch-icon.png` | 180x180 | PNG |
| `favicon.svg` | vector | SVG (optional, for modern browsers) |

### 1.5 Create OG Image
**File:** `frontend/public/og-image.png` (NEW)

SEO component references `/og-image.png` but it doesn't exist.

#### OG Image Generation Prompt:
```
Create an Open Graph social sharing image for "mytops" - a personal favorites tracking app.

Dimensions: 1200x630 pixels (Facebook/LinkedIn optimal)
Background: Clean gradient or solid color (dark gray #0a0a0a or light #fafafa)

Content:
- "mytops" wordmark prominently displayed (large, bold, modern sans-serif)
- Tagline below: "Your taste, organized."
- Optional: Small icons representing categories (film reel, book, game controller, star) arranged subtly
- Optional: App favicon/logo mark

Style:
- Minimal and clean
- High contrast for readability
- Monochrome palette (black, white, grays)
- Modern typography
- No clutter - let the brand name breathe

Brand voice: Confident but not flashy. "I know what I like."
```

#### OG Image File Placement:
Place the generated image at:
```
frontend/public/og-image.png
```

Dimensions: **1200x630px** (required for proper display on social platforms)

---

## Phase 2: Performance Optimizations (Core Web Vitals)

### 2.1 Improve LCP (Largest Contentful Paint)

#### 2.1.1 Add Resource Preloading
**File:** `frontend/index.html`

Add preconnect and dns-prefetch for external resources:
```html
<link rel="preconnect" href="https://[project].supabase.co">
<link rel="dns-prefetch" href="https://[project].supabase.co">
```

#### 2.1.2 Optimize LazyImage Component
**File:** `frontend/src/components/LazyImage.tsx`

Current issues:
- No `width`/`height` attributes causing layout shifts
- No `fetchpriority` for above-the-fold images
- No `sizes` attribute for responsive images

Changes:
- Add optional `width`/`height` props
- Add `fetchpriority="high"` option for hero images
- Add `sizes` prop for responsive optimization

### 2.2 Improve CLS (Cumulative Layout Shift)

#### 2.2.1 Reserve Image Space
**Files:** `ItemCard.tsx`, `TopicsPage.tsx`, `HomePage.tsx`

- Ensure all image containers have explicit aspect ratios
- Already partially done with `aspectRatio` prop, verify consistent usage

### 2.3 Reduce JavaScript Bundle Impact

#### 2.3.1 Add More Route-Level Code Splitting
**File:** `frontend/src/App.tsx`

Currently only `PublicProfilePage` is lazy loaded. Add lazy loading for:
- `LoginPage`
- `RegisterPage`
- `ProfilePage`
- `TopicDetailPage`

#### 2.3.2 Tree-shake Framer Motion
**File:** `frontend/vite.config.ts`

Consider importing only used motion components via direct imports.

### 2.4 Optimize Font Loading
**File:** `frontend/index.html`

If using custom fonts (verify in CSS):
- Add `font-display: swap` to @font-face
- Preload critical fonts

---

## Phase 3: Accessibility Improvements (WCAG 2.2)

### 3.1 Color Contrast Verification
**File:** `frontend/src/index.css`

Verify contrast ratios meet 4.5:1 for:
- `--muted-foreground` (45.1% lightness in light mode, 63.9% in dark)
- Star rating empty states
- Badge text on backgrounds

### 3.2 Focus Indicators
**Files:** Various component files

Ensure all interactive elements have visible focus states:
- Carousel dots in `HomePage.tsx` need focus ring
- Filter buttons need clear focus state
- Custom buttons need `focus-visible` styling

### 3.3 Screen Reader Improvements

#### 3.3.1 Add aria-live Regions for Dynamic Content
**File:** `frontend/src/pages/TopicDetailPage.tsx`

Add `aria-live="polite"` for:
- Search results count updates
- Filter changes

#### 3.3.2 Improve Link Text
**File:** `frontend/src/pages/HomePage.tsx`

"Start Curating" link could be more descriptive:
- Add `aria-label="Start curating your favorites by browsing topics"`

### 3.4 Form Labels
**File:** `frontend/src/pages/TopicDetailPage.tsx`

Search input is missing an associated `<label>`:
```tsx
<Input id="search" ... />  // Has id but no <label>
```

Add visually-hidden label or `aria-label`.

---

## Phase 4: Technical SEO Enhancements

### 4.1 Extend Structured Data
**File:** `frontend/src/components/SEO.tsx`

Add more JSON-LD schema types:
- `BreadcrumbList` for navigation
- `CollectionPage` for topic pages

### 4.2 Add Missing Canonical URLs
Verify all pages include canonical URL via SEO component.

### 4.3 Improve Cache Headers
**File:** `frontend/public/_headers`

Current headers are good. Consider adding:
```
/index.html
  Cache-Control: no-cache
```

---

## Phase 5: Build Optimizations

### 5.1 Add Compression
**Files:** `frontend/package.json`, `frontend/vite.config.ts`

Install and configure vite-plugin-compression:
```bash
npm install -D vite-plugin-compression
```

Update vite.config.ts:
```ts
import compression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: 'gzip' }),
    compression({ algorithm: 'brotliCompress', ext: '.br' })
  ],
  // ... rest of config
})
```

This pre-compresses assets at build time, reducing transfer size by 50-70%.

---

## Implementation Order

### Step 1: Install Dependencies
```bash
cd frontend && npm install -D vite-plugin-compression
```

### Step 2: SEO Infrastructure
1. Update `frontend/index.html` - meta tags, preconnects, favicon refs
2. Create `frontend/public/robots.txt`
3. Create `frontend/public/sitemap.xml`
4. Create `frontend/public/site.webmanifest`

### Step 3: Performance Optimizations
5. Update `frontend/vite.config.ts` - add compression plugin
6. Update `frontend/src/App.tsx` - add lazy loading for more routes
7. Update `frontend/src/components/LazyImage.tsx` - add width/height/priority props

### Step 4: Accessibility Fixes
8. Update `frontend/src/pages/TopicDetailPage.tsx` - add label, aria-live
9. Update `frontend/src/pages/HomePage.tsx` - improve link text
10. Verify color contrast in `frontend/src/index.css`

### Step 5: User Action Required
- Generate favicon images using provided prompt
- Generate OG image using provided prompt
- Place files in `frontend/public/`

### Step 6: Verification
- Run `npm run build` to verify no errors
- Run `npm test` to ensure tests pass
- Test with Lighthouse

---

## Files to Modify

### Files I Will Create/Modify:
| File | Action |
|------|--------|
| `frontend/index.html` | Major update - meta tags, preconnects, favicon refs |
| `frontend/public/robots.txt` | Create new |
| `frontend/public/sitemap.xml` | Create new |
| `frontend/public/site.webmanifest` | Create new |
| `frontend/vite.config.ts` | Add compression plugin |
| `frontend/src/App.tsx` | Add lazy imports for routes |
| `frontend/src/components/LazyImage.tsx` | Add width/height/priority props |
| `frontend/src/pages/TopicDetailPage.tsx` | Add label, aria-live regions |
| `frontend/src/pages/HomePage.tsx` | Improve link accessibility |
| `frontend/public/_headers` | Extend cache rules |

### Files User Must Create (after generating images):
| File | Size | Notes |
|------|------|-------|
| `frontend/public/favicon.ico` | 32x32 | Main favicon |
| `frontend/public/favicon-16x16.png` | 16x16 | Small favicon |
| `frontend/public/favicon-32x32.png` | 32x32 | Standard favicon |
| `frontend/public/apple-touch-icon.png` | 180x180 | iOS home screen |
| `frontend/public/og-image.png` | 1200x630 | Social sharing image |

---

## Testing After Implementation

1. Run `npm run build` - verify successful build
2. Run `npm test` - verify all tests pass
3. Run Lighthouse audit (target: 90+ Performance, 100 SEO)
4. Test with axe DevTools for accessibility
5. Verify robots.txt: `https://mytops.io/robots.txt`
6. Test OG tags: https://developers.facebook.com/tools/debug/
7. Test Twitter cards: https://cards-dev.twitter.com/validator

---

## Post-Implementation: Documentation Updates

After completing implementation, update these files:

### 1. Update `docs/CHANGELOG.md`
Add entry documenting:
```markdown
## [Date] - SEO & Performance Optimization

### Added
- robots.txt for search engine crawlers
- sitemap.xml with all public routes
- site.webmanifest for PWA support
- Proper favicon set (ico, png, apple-touch-icon)
- OG image for social sharing
- Build-time compression (gzip/brotli)
- Route-level code splitting for LoginPage, RegisterPage, ProfilePage, TopicDetailPage

### Changed
- index.html: Added meta tags, preconnects, favicon references
- LazyImage: Added width/height/priority props for CLS optimization
- App.tsx: Lazy loading for additional routes
- TopicDetailPage: Added aria-live regions, form labels
- HomePage: Improved link accessibility
- vite.config.ts: Added compression plugin

### Performance Impact
- Expected Lighthouse Performance: 90+
- Expected Lighthouse SEO: 100
- Bundle size reduction: ~50-70% with compression
```

### 2. Update `docs/ARCHITECTURE.md` (if needed)
Add section about:
- SEO infrastructure (robots.txt, sitemap, structured data)
- Build optimizations (compression, code splitting)

### 3. Update `CLAUDE.md` (if needed)
If any new patterns were established, document them.

---

## Supabase URL for Preconnect

Before implementing, get the Supabase project URL from:
- `.env` file: `VITE_SUPABASE_URL` value
- Or from `frontend/src/lib/supabase.ts`

Use this URL for the preconnect hints in index.html.

---

## Execution Checklist

- [ ] Read `docs/DEVELOPMENT_GUIDELINES.md`
- [ ] Read `docs/ARCHITECTURE.md`
- [ ] Install `vite-plugin-compression`
- [ ] Update `frontend/index.html`
- [ ] Create `frontend/public/robots.txt`
- [ ] Create `frontend/public/sitemap.xml`
- [ ] Create `frontend/public/site.webmanifest`
- [ ] Update `frontend/vite.config.ts`
- [ ] Update `frontend/src/App.tsx`
- [ ] Update `frontend/src/components/LazyImage.tsx`
- [ ] Update `frontend/src/pages/TopicDetailPage.tsx`
- [ ] Update `frontend/src/pages/HomePage.tsx`
- [ ] Update `frontend/public/_headers`
- [ ] Run `npm run build`
- [ ] Run `npm test`
- [ ] Update `docs/CHANGELOG.md`
- [ ] (User) Generate and add favicon images
- [ ] (User) Generate and add OG image
