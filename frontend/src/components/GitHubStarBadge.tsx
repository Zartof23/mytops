import { useEffect, useState } from 'react'
import { Github } from 'lucide-react'
import { GITHUB_REPO, GITHUB_REPO_URL } from '@/lib/links'

/**
 * Star count, fetched at most once per page load however many badges render.
 * GitHub's anonymous API allows 60 requests an hour per IP, and the badge
 * appears both in the navbar and in the FAQ.
 */
let starsPromise: Promise<number | null> | null = null

function fetchStars(): Promise<number | null> {
  starsPromise ??= fetch(`https://api.github.com/repos/${GITHUB_REPO}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => (typeof data?.stargazers_count === 'number' ? data.stargazers_count : null))
    .catch(() => null)

  return starsPromise
}

interface GitHubStarBadgeProps {
  /** `default` gives the roomier navbar treatment. */
  size?: 'sm' | 'default'
}

/**
 * GitHub star count badge, fetched live from the GitHub API.
 *
 * Fails silently (renders a plain link with no count) if the API
 * is unreachable or rate-limited, so it never blocks the header.
 */
export function GitHubStarBadge({ size = 'sm' }: GitHubStarBadgeProps) {
  const [stars, setStars] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchStars().then((count) => {
      if (!cancelled) setStars(count)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
        size === 'default' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'
      }`}
      aria-label={stars !== null ? `mytops on GitHub - ${stars} stars` : 'mytops on GitHub'}
    >
      <Github className={size === 'default' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {stars !== null && (
        <span className="text-muted-foreground">{stars}</span>
      )}
    </a>
  )
}
