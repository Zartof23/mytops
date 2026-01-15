# Deployment Context

> **Load this file when working on:** CI/CD, production deployment, monitoring, performance optimization, build configuration.

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRODUCTION                                  │
│                                                                 │
│  ┌─────────────────────┐        ┌─────────────────────┐         │
│  │   Cloudflare Pages  │        │      Supabase       │         │
│  │   (Frontend Host)   │        │   (Backend Host)    │         │
│  │                     │        │                     │         │
│  │   mytops.io         │◄──────►│   PostgreSQL        │         │
│  │                     │        │   Auth              │         │
│  │   - React SPA       │        │   Edge Functions    │         │
│  │   - Static Assets   │        │   Storage           │         │
│  │   - CDN             │        │                     │         │
│  └─────────────────────┘        └─────────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Deployment (Cloudflare Pages)

### Production URL

https://mytops.io

### Build Configuration

```bash
# Build command
cd frontend && npm run build

# Output directory
frontend/dist
```

### Environment Variables

Set in Cloudflare Pages Dashboard:

| Variable | Value | Public |
|----------|-------|--------|
| `VITE_SUPABASE_URL` | `https://ocasihbuejfjirsrnxzq.supabase.co` | Yes |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Yes (RLS protected) |

### Deployment Workflow

- **Automatic deployment** on push to `main` branch
- **Preview deployments** for pull requests
- **Rollback** available via Cloudflare dashboard

### Build Output Analysis

```bash
cd frontend
npm run build

# Current sizes (approximate):
# - Main bundle: ~770KB
# - Lazy-loaded chunks: LoginPage, RegisterPage, ProfilePage, TopicDetailPage
```

### Code Splitting

```typescript
// App.tsx - Lazy loaded routes
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const TopicDetailPage = lazy(() => import('./pages/TopicDetailPage'))
```

---

## Backend Deployment (Supabase)

### Project Details

- **Project ID**: `ocasihbuejfjirsrnxzq`
- **Region**: (check Supabase Dashboard)
- **Dashboard**: https://supabase.com/dashboard/project/ocasihbuejfjirsrnxzq

### Database Migrations

```bash
# Apply migrations via CLI
supabase db push

# Or via MCP
mcp__supabase__apply_migration({
  name: 'migration_name',
  query: 'SQL here'
})

# Verify applied migrations
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

### Edge Functions

```bash
# List deployed functions
mcp__supabase__list_edge_functions()

# Deploy function
mcp__supabase__deploy_edge_function({
  name: 'function-name',
  files: [{ name: 'index.ts', content: '...' }],
  verify_jwt: false
})

# Check function logs
mcp__supabase__get_logs({ service: 'edge-function' })
```

### Secrets Management

Set via Supabase Dashboard > Edge Functions > Secrets:

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Claude API for AI enrichment |
| `TAVILY_API_KEY` | Web search for AI enrichment |

**Never commit secrets to git!**

---

## Performance Optimization

### Build-Time Optimizations

```typescript
// vite.config.ts
import compression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: 'gzip' }),
    compression({ algorithm: 'brotliCompress', ext: '.br' })
  ]
})
```

### Cache Headers (`_headers`)

```
# HTML - no cache
/*.html
  Cache-Control: no-cache

# Static assets - long cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# Images - long cache
/*.png
/*.jpg
/*.webp
  Cache-Control: public, max-age=31536000

# Manifest/robots - 24h cache
/site.webmanifest
/robots.txt
/sitemap.xml
  Cache-Control: public, max-age=86400
```

### Image Optimization

- **Format**: WebP preferred
- **Lazy loading**: Via `LazyImage` component
- **Responsive**: Use `sizes` attribute
- **LCP optimization**: `fetchPriority="high"` for above-fold images

---

## Monitoring

### Frontend Monitoring

- **Error Boundary**: Catches React errors
- **Console logging**: Development only
- **Toast notifications**: User feedback

### Backend Monitoring

```bash
# Check API logs
mcp__supabase__get_logs({ service: 'api' })

# Check Edge Function logs
mcp__supabase__get_logs({ service: 'edge-function' })

# Check database logs
mcp__supabase__get_logs({ service: 'postgres' })

# Check auth logs
mcp__supabase__get_logs({ service: 'auth' })
```

### Security Advisors

```bash
# Check for security issues
mcp__supabase__get_advisors({ type: 'security' })

# Check for performance issues
mcp__supabase__get_advisors({ type: 'performance' })
```

---

## SEO Infrastructure

### Static Files

| File | Purpose |
|------|---------|
| `robots.txt` | Crawler directives |
| `sitemap.xml` | Page index for search engines |
| `site.webmanifest` | PWA configuration |

### Meta Tags

```html
<!-- index.html -->
<title>mytops - Track Your Favorite Movies, Books, Games & More</title>
<meta name="description" content="..." />
<meta property="og:title" content="..." />
<meta property="og:image" content="..." />
<meta name="twitter:card" content="summary_large_image" />
```

### Structured Data

```typescript
// Dynamic structured data via SEO.tsx
<WebsiteSchema />
<BreadcrumbListSchema items={[...]} />
<CollectionPageSchema items={[...]} />
```

---

## Pre-Deployment Checklist

### Before Pushing to Main

- [ ] All tests pass: `npm test -- --run`
- [ ] Build succeeds: `npm run build`
- [ ] No console errors in development
- [ ] TypeScript has no errors
- [ ] CHANGELOG.md updated

### After Deployment

- [ ] Site loads at https://mytops.io
- [ ] Auth flow works (login, register, OAuth)
- [ ] Core features functional (browse, rate, profile)
- [ ] No console errors in production
- [ ] Check Supabase logs for errors

---

## Troubleshooting

### Build Failures

```bash
# Clear cache and reinstall
rm -rf node_modules
rm package-lock.json
npm install
npm run build
```

### Edge Function Errors

```bash
# Check function logs
mcp__supabase__get_logs({ service: 'edge-function' })

# Common issues:
# - Missing secrets (check Dashboard)
# - JWT validation (use verify_jwt: false for manual auth)
# - CORS headers
```

### Database Connection Issues

```bash
# Check database status
mcp__supabase__get_logs({ service: 'postgres' })

# Verify RLS policies
mcp__supabase__get_advisors({ type: 'security' })
```

### Auth Issues

```bash
# Check auth logs
mcp__supabase__get_logs({ service: 'auth' })

# Common issues:
# - Redirect URI mismatch (check OAuth provider config)
# - Session expired (client should auto-refresh)
```

---

## Rollback Procedures

### Frontend Rollback

1. Go to Cloudflare Pages Dashboard
2. Find previous successful deployment
3. Click "Rollback to this deployment"

### Database Rollback

1. Identify migration to rollback
2. Write and apply reverse migration
3. Test thoroughly

```sql
-- Example rollback migration
ALTER TABLE items DROP COLUMN IF EXISTS new_field;
```

### Edge Function Rollback

1. Get previous function code from git history
2. Redeploy with `mcp__supabase__deploy_edge_function`

---

**See also:**
- Architecture details: `docs/ARCHITECTURE.md`
- Development standards: `docs/DEVELOPMENT_GUIDELINES.md`
