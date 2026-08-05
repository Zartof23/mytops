import { useEffect, useState } from 'react'
import { Github } from 'lucide-react'

const REPO = 'Zartof23/mytops'
const REPO_URL = `https://github.com/${REPO}`

/**
 * GitHub star count badge, fetched live from the GitHub API.
 *
 * Fails silently (renders a plain link with no count) if the API
 * is unreachable or rate-limited, so it never blocks the header.
 */
export function GitHubStarBadge() {
  const [stars, setStars] = useState<number | null>(null)

  useEffect(() => {
    const abortController = new AbortController()

    async function fetchStars() {
      try {
        const response = await fetch(`https://api.github.com/repos/${REPO}`, {
          signal: abortController.signal
        })
        if (!response.ok) return

        const data = await response.json()
        if (typeof data.stargazers_count === 'number') {
          setStars(data.stargazers_count)
        }
      } catch {
        // Silently ignore - badge just shows without a count
      }
    }

    fetchStars()

    return () => {
      abortController.abort()
    }
  }, [])

  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label={stars !== null ? `mytops on GitHub - ${stars} stars` : 'mytops on GitHub'}
    >
      <Github className="h-3.5 w-3.5" aria-hidden="true" />
      {stars !== null && (
        <span className="text-muted-foreground">{stars}</span>
      )}
    </a>
  )
}
