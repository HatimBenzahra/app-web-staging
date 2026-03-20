/**
 * @fileoverview Offline queue service for storing mutations when offline
 * Handles queueing and persistence of offline actions
 */

const MAX_QUEUE_SIZE = 50
const ACTION_TTL_MS = 24 * 60 * 60 * 1000 // 24h

export interface OfflineAction<T = any> {
  id: string
  type: string
  payload: T
  timestamp: number
  retryCount: number
}

class OfflineQueueService {
  private queue: OfflineAction[] = []
  private storageKey = 'offline_mutation_queue'

  constructor() {
    this.loadQueue()
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const parsed: OfflineAction[] = JSON.parse(stored)
        const now = Date.now()
        this.queue = parsed.filter(action => now - action.timestamp < ACTION_TTL_MS)

        if (this.queue.length !== parsed.length) {
          this.saveQueue()
        }
      }
    } catch (e) {
      console.error('Failed to load offline queue', e)
      this.queue = []
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue))
    } catch (e) {
      console.error('Failed to save offline queue', e)
    }
  }

  enqueue(type: string, payload: any) {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift()
    }

    const action: OfflineAction = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0
    }
    this.queue.push(action)
    this.saveQueue()
    console.log('[OfflineQueue] Enqueued action:', action)
  }

  dequeue(): OfflineAction | undefined {
    const action = this.queue.shift()
    this.saveQueue()
    return action
  }

  peek(): OfflineAction | undefined {
    return this.queue[0]
  }

  isEmpty(): boolean {
    return this.queue.length === 0
  }

  getQueue(): OfflineAction[] {
    const now = Date.now()
    const validActions = this.queue.filter(action => now - action.timestamp < ACTION_TTL_MS)

    if (validActions.length !== this.queue.length) {
      this.queue = validActions
      this.saveQueue()
    }

    return this.queue
  }

  clear() {
    this.queue = []
    this.saveQueue()
  }

  remove(id: string) {
    this.queue = this.queue.filter(a => a.id !== id)
    this.saveQueue()
  }
}

export const offlineQueue = new OfflineQueueService()
