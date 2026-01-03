import { supabase } from '../lib/supabase'
import type { UserTodoItem, Topic } from '../types'

/**
 * Service for managing user TODO lists (per-topic watchlists)
 */
export const todoService = {
  /**
   * Get all TODO items for a specific topic
   */
  async getTodosByTopic(topicId: string): Promise<{
    data: UserTodoItem[] | null
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: [], error: null }
      }

      const { data, error } = await supabase
        .from('user_todo_lists')
        .select(`
          *,
          item:items (*),
          topic:topics (*)
        `)
        .eq('user_id', user.id)
        .eq('topic_id', topicId)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data: data as UserTodoItem[], error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Get all TODO items for the current user, grouped by topic
   */
  async getAllTodos(): Promise<{
    data: Map<string, { topic: Topic; items: UserTodoItem[] }> | null
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: new Map(), error: null }
      }

      const { data, error } = await supabase
        .from('user_todo_lists')
        .select(`
          *,
          item:items (*),
          topic:topics (*)
        `)
        .eq('user_id', user.id)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error

      // Group by topic
      const byTopic = new Map<string, { topic: Topic; items: UserTodoItem[] }>()

      data?.forEach((todo) => {
        const todoItem = todo as UserTodoItem
        const topic = todoItem.topic
        if (!topic) return

        if (!byTopic.has(topic.id)) {
          byTopic.set(topic.id, { topic, items: [] })
        }
        byTopic.get(topic.id)!.items.push(todoItem)
      })

      return { data: byTopic, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Add an item to the user's TODO list
   */
  async addToTodo(itemId: string, topicId: string): Promise<{
    data: UserTodoItem | null
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: new Error('Not authenticated') }
      }

      const { data, error } = await supabase
        .from('user_todo_lists')
        .insert({
          user_id: user.id,
          item_id: itemId,
          topic_id: topicId
        })
        .select(`
          *,
          item:items (*),
          topic:topics (*)
        `)
        .single()

      if (error) throw error
      return { data: data as UserTodoItem, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Remove an item from the user's TODO list
   */
  async removeFromTodo(itemId: string): Promise<{ error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { error: new Error('Not authenticated') }
      }

      const { error } = await supabase
        .from('user_todo_lists')
        .delete()
        .eq('user_id', user.id)
        .eq('item_id', itemId)

      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  },

  /**
   * Check if an item is in the user's TODO list
   */
  async isInTodo(itemId: string): Promise<{
    data: boolean
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: false, error: null }
      }

      const { data, error } = await supabase
        .from('user_todo_lists')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_id', itemId)
        .maybeSingle()

      if (error) throw error
      return { data: !!data, error: null }
    } catch (error) {
      return { data: false, error: error as Error }
    }
  },

  /**
   * Batch check which items are in the user's TODO list
   */
  async getTodoStatusBatch(itemIds: string[]): Promise<{
    data: Set<string> | null
    error: Error | null
  }> {
    try {
      if (itemIds.length === 0) {
        return { data: new Set(), error: null }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: new Set(), error: null }
      }

      const { data, error } = await supabase
        .from('user_todo_lists')
        .select('item_id')
        .eq('user_id', user.id)
        .in('item_id', itemIds)

      if (error) throw error

      const todoSet = new Set<string>()
      data?.forEach((row) => todoSet.add(row.item_id))

      return { data: todoSet, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  /**
   * Update priority of a TODO item
   */
  async updatePriority(itemId: string, priority: number): Promise<{
    error: Error | null
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { error: new Error('Not authenticated') }
      }

      const { error } = await supabase
        .from('user_todo_lists')
        .update({ priority })
        .eq('user_id', user.id)
        .eq('item_id', itemId)

      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }
}
