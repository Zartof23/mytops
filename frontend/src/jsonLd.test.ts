import { describe, it, expect } from 'vitest'
// `?raw` rather than fs: the app tsconfig has no Node types, and Vite resolves
// this the same way in the test run as it would in a build.
import indexHtml from '../index.html?raw'
import { FAQ_BANDS } from './components/FaqSection'

/**
 * The site renders client-side, so the JSON-LD in `index.html` is most of what a
 * crawler or AI assistant can learn about mytops without executing JavaScript.
 * These tests guard the two ways it silently rots: invalid JSON (search engines
 * drop the whole block without complaining) and FAQ text drifting away from the
 * FAQ people actually see.
 */

function parseJsonLdBlocks(): unknown[] {
  const blocks = [
    ...indexHtml.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
    )
  ]
  return blocks.map((match) => JSON.parse(match[1]))
}

interface Question {
  '@type': string
  name: string
  acceptedAnswer: { '@type': string; text: string }
}

function getFaqPage() {
  const graph = (parseJsonLdBlocks()[0] as { '@graph': Array<{ '@type': string }> })[
    '@graph'
  ]
  return graph.find((node) => node['@type'] === 'FAQPage') as unknown as {
    mainEntity: Question[]
  }
}

describe('index.html JSON-LD', () => {
  it('contains exactly one parseable ld+json block', () => {
    const blocks = parseJsonLdBlocks()
    expect(blocks).toHaveLength(1)
  })

  it('describes the site as a WebSite and a WebApplication', () => {
    const graph = (parseJsonLdBlocks()[0] as { '@graph': Array<{ '@type': string }> })[
      '@graph'
    ]
    const types = graph.map((node) => node['@type'])
    expect(types).toContain('WebSite')
    expect(types).toContain('WebApplication')
  })

  it('lists the same questions, in the same order, as the rendered FAQ', () => {
    const structuredQuestions = getFaqPage().mainEntity.map((entry) => entry.name)
    expect(structuredQuestions).toEqual(FAQ_BANDS.map((band) => band.question))
  })

  it('gives every question a non-empty answer', () => {
    for (const entry of getFaqPage().mainEntity) {
      expect(entry['@type']).toBe('Question')
      expect(entry.acceptedAnswer['@type']).toBe('Answer')
      expect(entry.acceptedAnswer.text.length).toBeGreaterThan(20)
    }
  })
})
