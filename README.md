# mytops

**mytops** is a platform for tracking and sharing your favorite things across movies, series, books, anime, games, and restaurants.

**Live site:** https://mytops.io

## What You Can Do Now (MVP 1)

### Working Features

1. **Authentication**
   - Sign up/login with email/password
   - OAuth login via Google or GitHub

2. **Browse & Discover**
   - Browse 6 topics: Movies, Series, Books, Anime, Games, Restaurants
   - View items with rich metadata (title, description, images, topic-specific details)
   - Search within topics (real-time filtering)

3. **Rate & Curate**
   - Rate items 1-5 stars
   - Build your personal "preferables" collection
   - Update or remove ratings
   - Optimistic UI updates with rollback on error

4. **Profile**
   - View your rated items organized by topic
   - Responsive design (mobile-first)
   - Dark/light mode

### Current Limitations

- **No AI enrichment yet**: You can only browse pre-seeded items (~20 items across topics)
- **No dynamic item creation**: AI-powered database growth coming in MVP 2
- **No recommendations**: Personalized suggestions coming in MVP 3
- **No social features**: Sharing and following coming in MVP 4

See [docs/ROADMAP.md](docs/ROADMAP.md) for upcoming features.

## The Vision

**mytops** will eventually build its database on demand. When you search for something that doesn't exist, AI will automatically generate the entry and add it to the database. This feature is planned for MVP 2.

## The Vibe

> *"I'm a backend dev... I don't usually do frontend."*

This app embraces a minimal, honest design with self-deprecating humor. No dark patterns, no data harvesting, no BS.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (Email + Google + GitHub) |
| **Backend** | Supabase Edge Functions (Deno) |
| **Background Jobs** | pg_cron + pg_net |
| **AI** | Claude API (Anthropic) - coming in MVP 2 |
| **Frontend** | React 19 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui (new-york, neutral) |
| **State** | Zustand |
| **Testing** | Vitest + React Testing Library |
| **Deployment** | Cloudflare Pages (frontend) + Supabase (backend) |

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account (for database/auth)

### Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd mytops

# Copy environment template
cp .env.example .env

# Edit .env and add your Supabase credentials:
# - VITE_SUPABASE_URL (from Supabase Dashboard)
# - VITE_SUPABASE_ANON_KEY (from Supabase Dashboard)

# Install dependencies
cd frontend
npm install

# Run development server
npm run dev
```

Open http://localhost:5173

### Running Tests

```bash
cd frontend
npm test              # Watch mode
npm test -- --run     # Run once
npm run test:coverage # With coverage report
```

### Building for Production

```bash
cd frontend
npm run build
```

## Project Structure

```
mytops/
├── docs/
│   ├── ARCHITECTURE.md          # Technical architecture details
│   ├── DEVELOPMENT_GUIDELINES.md # Mandatory development standards
│   ├── ROADMAP.md               # Future MVPs and features
│   └── CHANGELOG.md             # Decision log
├── supabase/
│   ├── config.toml              # Supabase CLI configuration
│   └── migrations/              # Database migrations (version controlled)
├── frontend/
│   ├── src/
│   │   ├── components/          # UI components
│   │   │   └── ui/              # shadcn/ui primitives
│   │   ├── pages/               # Route pages
│   │   ├── services/            # API service layer
│   │   ├── lib/                 # Supabase client, utilities
│   │   ├── store/               # Zustand stores
│   │   ├── types/               # TypeScript types
│   │   └── test/                # Test utilities
│   ├── components.json          # shadcn/ui configuration
│   ├── vitest.config.ts         # Test configuration
│   └── tailwind.config.js       # Tailwind configuration
├── .env.example                 # Environment template
├── CLAUDE.md                    # AI assistant guidance
└── README.md                    # This file
```

## Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Technical architecture, database schema, RLS policies, deployment
- **[DEVELOPMENT_GUIDELINES.md](docs/DEVELOPMENT_GUIDELINES.md)** - Security standards, testing, code patterns (MANDATORY for contributors)
- **[ROADMAP.md](docs/ROADMAP.md)** - Current capabilities, future MVPs, feature plans
- **[CHANGELOG.md](docs/CHANGELOG.md)** - Decision log and change history
- **[CLAUDE.md](CLAUDE.md)** - Project context for AI assistants

## Development Guidelines

> **IMPORTANT**: All contributors MUST read [docs/DEVELOPMENT_GUIDELINES.md](docs/DEVELOPMENT_GUIDELINES.md) before making changes.

## Environment Variables

### Required (Frontend)

- `VITE_SUPABASE_URL` - Your Supabase project URL (safe for public)
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key (safe for public, protected by RLS)

### Never Commit

- `.env` files with real values
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- Any API keys or credentials

### Edge Function Secrets

Set in Supabase Dashboard (not in code):
- `ANTHROPIC_API_KEY` (for AI enrichment in MVP 2)

## Contributing

1. Read [DEVELOPMENT_GUIDELINES.md](docs/DEVELOPMENT_GUIDELINES.md) (mandatory)
2. Check [ROADMAP.md](docs/ROADMAP.md) for planned features
3. Follow security standards and testing requirements
4. Update documentation and CHANGELOG.md
5. Ensure all tests pass before submitting PR

## Testing

- **50+ tests** across components, services, and pages
- Unit tests for all components and utilities
- Integration tests for Supabase queries
- E2E tests for critical user flows

Run with:
```bash
npm test              # Watch mode
npm test -- --run     # Run once
npm run test:coverage # With coverage
```

## License

MIT License
