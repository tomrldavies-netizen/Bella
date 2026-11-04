import { describe, expect, it } from 'vitest'
import { projectUrl } from './supabase'

describe('projectUrl', () => {
  it.each([
    'https://abcd.supabase.co',
    'https://abcd.supabase.co/',
    'https://abcd.supabase.co/rest/v1/',
    '  https://abcd.supabase.co/rest/v1  ',
  ])('turns %j into the bare project address', (raw) => {
    expect(projectUrl(raw)).toBe('https://abcd.supabase.co')
  })

  it('treats a missing value as not configured', () => {
    expect(projectUrl(undefined)).toBeUndefined()
    expect(projectUrl('   ')).toBeUndefined()
  })
})
