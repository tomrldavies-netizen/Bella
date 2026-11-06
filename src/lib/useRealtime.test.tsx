import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Behaves like supabase-js: same name returns the same channel, and adding callbacks after subscribe() throws.
const channels = new Map<string, { subscribed: boolean }>()
vi.mock('./supabase', () => ({
  supabase: {
    channel(name: string) {
      const ch = channels.get(name) ?? { subscribed: false }
      channels.set(name, ch)
      const api = {
        on() {
          if (ch.subscribed) throw new Error(`cannot add \`postgres_changes\` callbacks for realtime:${name} after \`subscribe()\`.`)
          return api
        },
        subscribe() {
          ch.subscribed = true
          return api
        },
      }
      return api
    },
    removeChannel: vi.fn(),
  },
}))

import { useRealtime } from './useRealtime'

describe('useRealtime', () => {
  it('lets two parts of the app watch the same table at once', () => {
    renderHook(() => useRealtime('h1', ['medicine_given'], () => {}))
    expect(() => renderHook(() => useRealtime('h1', ['medicine_given'], () => {}))).not.toThrow()
  })
})
