import { describe, expect, it } from 'vitest'
import { isOn, leadOf } from './settings'

describe('reminder defaults (match the database)', () => {
  it('parents get everything, helpers only plan changes, until they choose', () => {
    expect(isOn({}, 'parent', 'medicine')).toBe(true)
    expect(isOn({}, 'helper', 'medicine')).toBe(false)
    expect(isOn({}, 'helper', 'plan_change')).toBe(true)
    expect(isOn({ types: { medicine: true } }, 'helper', 'medicine')).toBe(true)
    expect(isOn({ types: { feed: false } }, 'parent', 'feed')).toBe(false)
  })
  it('defaults to 10 minutes before', () => {
    expect(leadOf({}, 'feed')).toBe(10)
    expect(leadOf({ lead: { medicine: 30 } }, 'medicine')).toBe(30)
  })
})
