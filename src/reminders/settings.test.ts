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

describe('reminder server errors', () => {
  it('explains the usual set-up problems', async () => {
    const { FunctionsFetchError, FunctionsHttpError } = await import('@supabase/supabase-js')
    const { explainFunctionError } = await import('./push')
    expect(await explainFunctionError(new FunctionsFetchError(new Error('x')))).toMatch('Enforce JWT verification')
    expect(await explainFunctionError(new FunctionsHttpError(new Response('{}', { status: 404 })))).toMatch('wasn’t found')
    expect(await explainFunctionError(new FunctionsHttpError(new Response(JSON.stringify({ msg: 'Missing authorization header' }), { status: 401 })))).toMatch(
      'Enforce JWT verification',
    )
    expect(await explainFunctionError(new FunctionsHttpError(new Response(JSON.stringify({ error: 'VAPID keys are not set in Edge Function secrets' }), { status: 500 })))).toBe(
      'The reminders server said: VAPID keys are not set in Edge Function secrets',
    )
  })
})
