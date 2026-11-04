import { describe, expect, it } from 'vitest'
import { friendly } from './friendly'

describe('friendly auth errors', () => {
  it('explains an email that has not been added', () => {
    expect(friendly('Signups not allowed for otp', 'send')).toMatch("isn't on Bella's list")
  })
  it('only talks about codes when checking a code', () => {
    expect(friendly('Token has expired or is invalid', 'verify')).toMatch("That code didn't work")
    expect(friendly('Unable to validate email address: invalid format', 'send')).toBe(
      "Couldn't send the code: Unable to validate email address: invalid format",
    )
  })
  it('points at the key when it is wrong', () => {
    expect(friendly('Invalid API key', 'send')).toMatch('VITE_SUPABASE_ANON_KEY')
  })
})
