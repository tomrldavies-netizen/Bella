import type { ExpressingSession } from './types'

/** Frozen milk not yet used, in ml. */
export const freezerStock = (sessions: ExpressingSession[]) =>
  sessions.filter((s) => s.storage === 'freezer' && !s.used_at).reduce((sum, s) => sum + Number(s.left_ml) + Number(s.right_ml), 0)
