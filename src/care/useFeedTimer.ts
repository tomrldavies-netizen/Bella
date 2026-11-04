import { useTimer } from './useTimer'

export { formatElapsed } from './useTimer'

/** Feed timer kept on this phone only (agreed: not shared between devices). */
export const useFeedTimer = () => useTimer('bella.feedTimer')
