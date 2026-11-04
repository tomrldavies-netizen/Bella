import { afterEach, describe, expect, it } from 'vitest'
import { detectPlatform } from './install'
import { captureInviteToken, clearInviteToken } from './inviteToken'

describe('platform', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1', 5, 'ios'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 5, 'ios'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 0, 'other'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', 5, 'android'],
  ])('%s → %s', (ua, touch, expected) => expect(detectPlatform(ua, touch as number)).toBe(expected))
})

describe('invite token', () => {
  afterEach(() => {
    clearInviteToken()
    window.history.replaceState(null, '', '/')
  })

  it('keeps the token from an invite link and tidies the address', () => {
    window.history.replaceState(null, '', '/Bella/#/join/abcdef0123456789abcdef')
    expect(captureInviteToken()).toBe('abcdef0123456789abcdef')
    expect(window.location.hash).toBe('#/')
    // Still there after the page reloads (e.g. around sign-in).
    expect(captureInviteToken()).toBe('abcdef0123456789abcdef')
  })

  it('ignores ordinary addresses', () => {
    window.history.replaceState(null, '', '/Bella/#/feeds')
    expect(captureInviteToken()).toBeNull()
  })
})
