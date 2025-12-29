export interface Topic {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  schema_template: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  topic_id: string
  name: string
  slug: string
  description: string | null
  metadata: Record<string, unknown> | null
  image_url: string | null
  source: 'seed' | 'ai_generated' | 'user_submitted'
  ai_confidence: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface UserRating {
  id: string
  user_id: string
  item_id: string
  rating: number
  notes: string | null
  created_at: string
  updated_at: string
  // Joined data
  item?: Item
}

export interface Profile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}
