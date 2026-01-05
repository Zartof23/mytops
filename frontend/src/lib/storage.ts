/**
 * Supabase Storage URL helpers
 *
 * Provides utilities for generating public storage URLs for images.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * Generate a public storage URL for a file in a bucket
 */
export function getStorageUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
}

/**
 * Get the storage URL for a topic cover image
 * @param slug - Topic slug (e.g., 'movies', 'books')
 */
export function getTopicImageUrl(slug: string): string {
  return getStorageUrl('topic-images', `${slug}.webp`)
}

/**
 * Get the storage URL for an item image
 * @param topicSlug - Topic slug
 * @param itemSlug - Item slug
 */
export function getItemImageUrl(topicSlug: string, itemSlug: string): string {
  return getStorageUrl('item-images', `${topicSlug}/${itemSlug}.webp`)
}
