/**
 * SEO Component using React 19's native Document Metadata
 *
 * React 19 automatically hoists <title>, <meta>, and <link> tags
 * from components to the document <head>
 */

interface SEOProps {
  title: string
  description: string
  image?: string
  url?: string
  type?: 'website' | 'profile' | 'article'
  noindex?: boolean
}

const BASE_URL = 'https://mytops.io'
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`

export function SEO({
  title,
  description,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noindex = false,
}: SEOProps) {
  const fullTitle = title.includes('mytops') ? title : `${title} | mytops`
  const canonicalUrl = url ? `${BASE_URL}${url}` : BASE_URL

  return (
    <>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="mytops" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
    </>
  )
}

/**
 * Structured Data Components (JSON-LD)
 */

interface WebSiteSchemaProps {
  name?: string
  description?: string
}

export function WebSiteSchema({
  name = 'mytops',
  description = 'Track your favorite movies, books, games, and more. Share your taste with the world.',
}: WebSiteSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    description,
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/topics/{search_term}`,
      },
      'query-input': 'required name=search_term',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

interface ProfileSchemaProps {
  username: string
  displayName?: string
  bio?: string
  url: string
}

export function ProfileSchema({
  username,
  displayName,
  bio,
  url,
}: ProfileSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: displayName || username,
    alternateName: username,
    description: bio,
    url: `${BASE_URL}${url}`,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

interface ItemListSchemaProps {
  name: string
  description: string
  items: Array<{
    name: string
    url: string
    position: number
  }>
}

export function ItemListSchema({ name, description, items }: ItemListSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    description,
    itemListElement: items.map((item) => ({
      '@type': 'ListItem',
      position: item.position,
      item: {
        '@type': 'Thing',
        name: item.name,
        url: `${BASE_URL}${item.url}`,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
