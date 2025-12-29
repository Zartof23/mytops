# mytops

**mytops** is a platform that lets people keep track of their favorite things and share them with the world — powered by AI-driven database generation.

## What makes mytops different?

Instead of relying on a pre-populated database, **mytops builds itself on demand**. When you search for something that doesn't exist, AI automatically generates the entry and adds it to the database.

## How It Works

1. **Browse Topics** — Movies, Series, Books, Anime, Games, Restaurants
2. **Search for Items** — Find what you're looking for
3. **AI Creates Missing Items** — If it doesn't exist, Claude AI generates it
4. **Rate & Save** — Give it 1-5 stars to add it to your collection
5. **View Your Preferables** — Your profile shows everything you've rated, organized by topic

## Tech Stack

| Layer | Technology |
|-------|------------|
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Email + Google + GitHub) |
| Backend | Supabase Edge Functions |
| AI | Claude API (Anthropic) |
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |

## Quick Start

```bash
# Clone the repo
git clone <your-repo-url>
cd mytops

# Setup environment
cp .env.example .env
# Edit .env with your Supabase anon key

# Install and run frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Project Structure

```
mytops/
├── docs/
│   ├── ARCHITECTURE_PLAN.md  # Full architecture
│   └── CHANGELOG.md          # Decision log
├── frontend/                 # React app
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/            # Route pages
│   │   ├── lib/              # Supabase client
│   │   └── store/            # Zustand stores
│   └── ...
├── .env.example              # Environment template
├── CLAUDE.md                 # AI assistant guidance
└── README.md
```

> **Note:** Database migrations and Edge Functions are managed directly in the Supabase Dashboard. No local `supabase/` folder needed.

## The Vibe

> *"I'm a backend dev... I don't usually do frontend."*

This app embraces a minimal, honest design with a touch of self-deprecating humor. No dark patterns, no data harvesting, no BS.

## Documentation

- [Architecture Plan](docs/ARCHITECTURE_PLAN.md)
- [Changelog](docs/CHANGELOG.md)

## License

MIT License
