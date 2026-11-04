import type { Supply } from './types'

/** Shown in "Running low": flagged to order, or at/below its low-stock level. */
export const supplyLow = (s: Supply) => s.to_order || s.quantity <= s.low_threshold
