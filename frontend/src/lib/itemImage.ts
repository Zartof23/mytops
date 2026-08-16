import type { Item } from '../types'

/**
 * First usable image on an item: `image_url`, then `metadata.poster_url`, then
 * `metadata.image`. Enrichment fills whichever the source happened to provide,
 * so every image-rendering surface needs the same chain.
 */
export function getItemImageUrl(item: Item): string | null {
  if (item.image_url) return item.image_url
  if (typeof item.metadata?.poster_url === 'string') return item.metadata.poster_url
  if (typeof item.metadata?.image === 'string') return item.metadata.image
  return null
}
