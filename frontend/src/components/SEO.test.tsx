import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SEO, WebSiteSchema, ProfileSchema, ItemListSchema } from './SEO'

/**
 * Note: React 19's native Document Metadata hoists <title>, <meta>, and <link>
 * tags from components to the document <head>. This means they won't appear
 * in the component's rendered container during testing.
 *
 * These tests verify:
 * 1. Components render without errors
 * 2. JSON-LD structured data (script tags are NOT hoisted and can be queried)
 */
describe('SEO', () => {
  describe('SEO component', () => {
    it('should render without errors', () => {
      expect(() =>
        render(
          <SEO
            title="Test Page"
            description="Test description"
          />
        )
      ).not.toThrow()
    })

    it('should render with all optional props', () => {
      expect(() =>
        render(
          <SEO
            title="Test Page"
            description="Test description"
            image="https://example.com/image.png"
            url="/test"
            type="profile"
            noindex={true}
          />
        )
      ).not.toThrow()
    })

    it('should handle title with mytops already in it', () => {
      expect(() =>
        render(
          <SEO
            title="mytops - Track Your Favorites"
            description="Test description"
          />
        )
      ).not.toThrow()
    })

    it('should handle default values correctly', () => {
      expect(() =>
        render(
          <SEO
            title="Test"
            description="Test"
          />
        )
      ).not.toThrow()
    })
  })

  describe('WebSiteSchema', () => {
    it('should render valid JSON-LD schema', () => {
      const { container } = render(<WebSiteSchema />)

      const script = container.querySelector('script[type="application/ld+json"]')
      expect(script).toBeDefined()

      const schema = JSON.parse(script?.textContent || '{}')
      expect(schema['@context']).toBe('https://schema.org')
      expect(schema['@type']).toBe('WebSite')
      expect(schema.name).toBe('mytops')
      expect(schema.url).toBe('https://mytops.io')
    })

    it('should use custom name and description', () => {
      const { container } = render(
        <WebSiteSchema
          name="Custom Site"
          description="Custom description"
        />
      )

      const script = container.querySelector('script[type="application/ld+json"]')
      const schema = JSON.parse(script?.textContent || '{}')

      expect(schema.name).toBe('Custom Site')
      expect(schema.description).toBe('Custom description')
    })

    it('should include search action', () => {
      const { container } = render(<WebSiteSchema />)

      const script = container.querySelector('script[type="application/ld+json"]')
      const schema = JSON.parse(script?.textContent || '{}')

      expect(schema.potentialAction['@type']).toBe('SearchAction')
      expect(schema.potentialAction.target['@type']).toBe('EntryPoint')
    })
  })

  describe('ProfileSchema', () => {
    it('should render person schema with username', () => {
      const { container } = render(
        <ProfileSchema
          username="testuser"
          url="/@testuser"
        />
      )

      const script = container.querySelector('script[type="application/ld+json"]')
      const schema = JSON.parse(script?.textContent || '{}')

      expect(schema['@context']).toBe('https://schema.org')
      expect(schema['@type']).toBe('Person')
      expect(schema.name).toBe('testuser')
      expect(schema.alternateName).toBe('testuser')
      expect(schema.url).toBe('https://mytops.io/@testuser')
    })

    it('should use displayName if provided', () => {
      const { container } = render(
        <ProfileSchema
          username="testuser"
          displayName="Test User"
          bio="Hello world"
          url="/@testuser"
        />
      )

      const script = container.querySelector('script[type="application/ld+json"]')
      const schema = JSON.parse(script?.textContent || '{}')

      expect(schema.name).toBe('Test User')
      expect(schema.alternateName).toBe('testuser')
      expect(schema.description).toBe('Hello world')
    })

    it('should handle missing optional props', () => {
      const { container } = render(
        <ProfileSchema
          username="testuser"
          url="/@testuser"
        />
      )

      const script = container.querySelector('script[type="application/ld+json"]')
      const schema = JSON.parse(script?.textContent || '{}')

      expect(schema.description).toBeUndefined()
    })
  })

  describe('ItemListSchema', () => {
    it('should render item list schema', () => {
      const items = [
        { name: 'Item 1', url: '/item/1', position: 1 },
        { name: 'Item 2', url: '/item/2', position: 2 }
      ]

      const { container } = render(
        <ItemListSchema
          name="Top Movies"
          description="Best movies ever"
          items={items}
        />
      )

      const script = container.querySelector('script[type="application/ld+json"]')
      const schema = JSON.parse(script?.textContent || '{}')

      expect(schema['@context']).toBe('https://schema.org')
      expect(schema['@type']).toBe('ItemList')
      expect(schema.name).toBe('Top Movies')
      expect(schema.description).toBe('Best movies ever')
      expect(schema.itemListElement).toHaveLength(2)
    })

    it('should format item list elements correctly', () => {
      const items = [
        { name: 'Test Item', url: '/items/test', position: 1 }
      ]

      const { container } = render(
        <ItemListSchema
          name="Test List"
          description="Test"
          items={items}
        />
      )

      const script = container.querySelector('script[type="application/ld+json"]')
      const schema = JSON.parse(script?.textContent || '{}')

      const firstItem = schema.itemListElement[0]
      expect(firstItem['@type']).toBe('ListItem')
      expect(firstItem.position).toBe(1)
      expect(firstItem.item['@type']).toBe('Thing')
      expect(firstItem.item.name).toBe('Test Item')
      expect(firstItem.item.url).toBe('https://mytops.io/items/test')
    })

    it('should handle empty items array', () => {
      const { container } = render(
        <ItemListSchema
          name="Empty List"
          description="No items"
          items={[]}
        />
      )

      const script = container.querySelector('script[type="application/ld+json"]')
      const schema = JSON.parse(script?.textContent || '{}')

      expect(schema.itemListElement).toHaveLength(0)
    })
  })
})
