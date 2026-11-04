import { describe, expect, it } from 'vitest'
import { shortDate } from '../lib/ukTime'
import { currentVersion, doseChanged, previousVersion, summariseMedicineChange, type DoseVersion, type MedicineState } from './medicines'

const iron: MedicineState = { name: 'Iron', active: true, dose: 1, unit: 'ml', route: 'mouth', times: ['05:00', '17:00'], endDate: null }

describe('summariseMedicineChange', () => {
  it('describes a new medicine', () => {
    expect(summariseMedicineChange(null, iron, shortDate)).toBe('Added Iron 1 ml by mouth at 05:00 and 17:00')
  })
  it('describes a dose change like the mockup', () => {
    expect(summariseMedicineChange(iron, { ...iron, dose: 1.2 }, shortDate)).toBe('Iron 1 ml → 1.2 ml')
  })
  it('describes route, times and end date', () => {
    expect(
      summariseMedicineChange(iron, { ...iron, route: 'tube', times: ['17:00', '11:00', '05:00'], endDate: '2026-11-30' }, shortDate),
    ).toBe('Iron now via tube; Iron times now 05:00, 11:00 and 17:00; Iron ends 30 Nov')
  })
  it('describes stopping and renaming', () => {
    expect(summariseMedicineChange(iron, { ...iron, active: false }, shortDate)).toBe('Stopped Iron')
    expect(summariseMedicineChange(iron, { ...iron, name: 'Sytron' }, shortDate)).toBe('Iron renamed to Sytron')
  })
  it('is empty when nothing changed', () => {
    expect(summariseMedicineChange(iron, { ...iron, times: ['17:00', '05:00'] }, shortDate)).toBe('')
  })
})

describe('dose versions', () => {
  const v = (id: string, dose: number, from: string, to: string | null): DoseVersion => ({
    id, dose, unit: 'ml', route: 'mouth', times: ['05:00'], effective_from: from, effective_to: to, reason: null,
  })
  const versions = [v('a', 1, '2026-10-01T00:00:00Z', '2026-10-19T23:00:00Z'), v('b', 1.2, '2026-10-19T23:00:00Z', null)]

  it('finds the version in force and the one before it', () => {
    const now = new Date('2026-11-01T00:00:00Z')
    expect(currentVersion(versions, now)?.id).toBe('b')
    expect(previousVersion(versions, versions[1])?.id).toBe('a')
    expect(currentVersion(versions, new Date('2026-10-05T00:00:00Z'))?.id).toBe('a')
  })

  it('knows when a new version is needed', () => {
    expect(doseChanged(iron, { ...iron, name: 'X' })).toBe(false)
    expect(doseChanged(iron, { ...iron, times: ['05:00'] })).toBe(true)
  })
})
