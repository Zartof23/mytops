export interface Topic {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  image_url: string | null
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
  is_admin: boolean
  created_at: string
  updated_at: string
}

// Extended item type with computed stats from database function
export interface ItemWithStats extends Item {
  avg_rating: number
  rating_count: number
  user_rating?: number | null
}

// TODO list item for per-topic watchlists
export interface UserTodoItem {
  id: string
  user_id: string
  item_id: string
  topic_id: string
  priority: number
  notes: string | null
  created_at: string
  updated_at: string
  // Joined data
  item?: Item & { topic?: Topic }
  topic?: Topic
}

export type FlagStatus = 'open' | 'resolved' | 'rejected'

export interface ItemFlag {
  id: string
  item_id: string
  user_id: string
  reason: string
  status: FlagStatus
  resolution_note: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  // Joined data
  item?: Item & { topic?: Topic }
  reporter?: Pick<Profile, 'id' | 'username' | 'display_name'>
}

export interface ItemLinks {
  rating_count: number
  todo_count: number
  flag_count: number
  raters: string[]
}

export interface RescanPreview {
  // null when the scan found nothing worth changing — there is nothing to
  // apply, so the server doesn't persist a proposal row for it.
  proposal_id: string | null
  current: Item
  proposed: {
    name: string
    description: string
    metadata: Record<string, unknown>
    image_url: string | null
  }
  changed_fields: string[]
  confidence: number
  sources: string[]
}
