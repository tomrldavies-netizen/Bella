import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, activeNavPath } from './navigation'

describe('navigation', () => {
  it('has the five phone tabs from SPEC §6, in order', () => {
    expect(NAV_ITEMS.filter((i) => i.inTabs).map((i) => i.label)).toEqual([
      'Today',
      'Feeds',
      'Meds',
      'Growth',
      'Care',
    ])
  })

  it('lists every section in the tablet rail', () => {
    expect(NAV_ITEMS.map((i) => i.railLabel)).toEqual([
      'Today',
      'Feeds',
      'Medicines',
      'Growth',
      'Care',
      'Plan',
      'Daily summary',
    ])
  })

  it('highlights the matching section', () => {
    expect(activeNavPath('/feeds', 'tabs')).toBe('/feeds')
    expect(activeNavPath('/meds', 'rail')).toBe('/meds')
    expect(activeNavPath('/', 'rail')).toBe('/')
  })

  it('keeps Today highlighted on phone for screens opened from Today', () => {
    expect(activeNavPath('/plan', 'tabs')).toBe('/')
    expect(activeNavPath('/summary', 'tabs')).toBe('/')
    expect(activeNavPath('/bellas-plan', 'tabs')).toBe('/')
  })

  it('highlights Plan and Daily summary in the tablet rail', () => {
    expect(activeNavPath('/plan', 'rail')).toBe('/plan')
    expect(activeNavPath('/summary', 'rail')).toBe('/summary')
    expect(activeNavPath('/bellas-plan', 'rail')).toBe('/')
  })
})
