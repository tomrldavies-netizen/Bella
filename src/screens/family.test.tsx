import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Gate } from '../App'
import * as familyApi from '../family/api'
import { clearInviteToken } from '../family/inviteToken'
import { dad, fakeAuth, fakeHousehold, helper, helperHousehold, readyState, renderBare, renderRoutes } from '../test/fakes'

vi.mock('../family/api', async (orig) => {
  const real = await orig<typeof import('../family/api')>()
  return {
    inviteLink: real.inviteLink,
    inviteMessage: real.inviteMessage,
    loadPendingInvites: vi.fn(),
    createInvite: vi.fn(async () => ({ id: 'i-new', token: 'tok0123456789abcdef0123', expires_at: '2026-11-11T00:00:00Z' })),
    resendInvite: vi.fn(async () => ({ id: 'i1', token: 'fresh0123456789abcdef01', expires_at: '2026-11-12T00:00:00Z' })),
    cancelInvite: vi.fn(async () => {}),
    invitePreview: vi.fn(),
    acceptInvite: vi.fn(async () => {}),
    updateMyProfile: vi.fn(async () => {}),
    updateMember: vi.fn(async () => {}),
  }
})
const api = vi.mocked(familyApi)

const pending: familyApi.Invite = {
  id: 'i1', display_name: 'Grandad', role: 'helper', email: 'grandad@example.com', token: 'old0123456789abcdef0123', expires_at: '2099-01-01T00:00:00Z', accepted_at: null, created_at: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  api.loadPendingInvites.mockResolvedValue([pending])
  Object.assign(navigator, { share: undefined, clipboard: { writeText: vi.fn(async () => {}) } })
})
afterEach(() => {
  clearInviteToken()
  window.history.replaceState(null, '', '/')
})

const household = () => fakeHousehold({ state: { ...readyState, members: [dad, helper] } as typeof readyState })

describe('Family & sharing', () => {
  it('lists members and pending invites', async () => {
    renderRoutes('/bellas-plan/family', { household: household() })
    expect(await screen.findByText('Invited, not set up yet')).toBeInTheDocument()
    expect(screen.getByText('Dad (you)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Grandma, Helper/ })).toBeInTheDocument()
  })

  it('makes an invite for a named email and shares it', async () => {
    renderRoutes('/bellas-plan/family', { household: household() })
    await userEvent.click(await screen.findByRole('button', { name: '+ Invite someone (text or WhatsApp)' }))
    const sheet = screen.getByRole('dialog', { name: 'Invite someone' })
    const make = within(sheet).getByRole('button', { name: 'Make invite link' })
    await userEvent.type(within(sheet).getByLabelText(/Their name/), 'Grandad')
    expect(make).toBeDisabled()
    await userEvent.type(within(sheet).getByLabelText(/Their email/), 'Grandad@Example.com')
    await userEvent.click(make)
    await waitFor(() => expect(api.createInvite).toHaveBeenCalledWith('h1', 'Grandad', 'helper', 'Grandad@Example.com'))
    expect(await screen.findByText(/#\/join\/tok0123456789abcdef0123 and sign in with grandad@example.com/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Share invite' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })

  it('resends an invite with a new link', async () => {
    renderRoutes('/bellas-plan/family', { household: household() })
    await userEvent.click(await screen.findByRole('button', { name: /^Grandad, invited/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Resend (new link, 7 more days)' }))
    await waitFor(() => expect(api.resendInvite).toHaveBeenCalledWith('i1'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('fresh0123456789abcdef01'))
  })

  it('changes a role and removes someone', async () => {
    renderRoutes('/bellas-plan/family', { household: household() })
    await userEvent.click(await screen.findByRole('button', { name: /^Grandma, Helper/ }))
    await userEvent.click(screen.getByRole('radio', { name: 'Parent' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.updateMember).toHaveBeenCalledWith('m-gran', { role: 'parent' }))

    await userEvent.click(await screen.findByRole('button', { name: /^Grandma, Helper/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove Grandma' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(api.updateMember).toHaveBeenCalledWith('m-gran', { active: false }))
  })

  it('lets anyone change their own name and colour', async () => {
    renderRoutes('/bellas-plan/family', { household: helperHousehold() })
    await userEvent.click(await screen.findByRole('button', { name: /^Grandma \(you\), Helper/ }))
    const name = screen.getByLabelText('Your name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Granny')
    await userEvent.click(screen.getByRole('button', { name: 'Sand' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.updateMyProfile).toHaveBeenCalledWith('h1', 'Granny', '#FBF0CF'))
    expect(api.updateMember).not.toHaveBeenCalled()
  })

  it('helpers cannot invite, change roles or see invites', async () => {
    renderRoutes('/bellas-plan/family', { household: helperHousehold() })
    await screen.findByText('Grandma (you)')
    expect(screen.queryByRole('button', { name: /Invite someone/ })).not.toBeInTheDocument()
    expect(api.loadPendingInvites).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /^Dad, Parent/ }))
    expect(screen.queryByRole('radio', { name: 'Parent' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })
})

describe('joining from an invite link', () => {
  const preview: familyApi.InvitePreview = { display_name: 'Grandad', role: 'helper', baby_name: 'Bella', email_hint: 'g•••@example.com', status: 'ok' }

  it('shows the invite on the sign-in screen and lets them create an account', async () => {
    window.history.replaceState(null, '', '/Bella/#/join/abcdef0123456789abcdef')
    api.invitePreview.mockResolvedValue(preview)
    const auth = fakeAuth({ session: null })
    renderBare(<Gate />, { auth })
    expect(await screen.findByText("Grandad, you've been invited to help with Bella")).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Your email/), 'grandad@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
    expect(auth.sendCode).toHaveBeenCalledWith('grandad@example.com', { newAccount: true })
  })

  it('joins the household once signed in', async () => {
    window.history.replaceState(null, '', '/Bella/#/join/abcdef0123456789abcdef')
    api.invitePreview.mockResolvedValue(preview)
    const hh = fakeHousehold({ state: { status: 'none' } })
    renderBare(<Gate />, { auth: fakeAuth({ session: { user: { id: 'u-gd', email: 'grandad@example.com' } } as Session }), household: hh })
    await userEvent.click(await screen.findByRole('button', { name: "Join Bella's Safari" }))
    await waitFor(() => expect(api.acceptInvite).toHaveBeenCalledWith('abcdef0123456789abcdef'))
    expect(hh.reload).toHaveBeenCalled()
  })

  it('explains an expired invite', async () => {
    window.history.replaceState(null, '', '/Bella/#/join/abcdef0123456789abcdef')
    api.invitePreview.mockResolvedValue({ ...preview, status: 'expired' })
    renderBare(<Gate />, { auth: fakeAuth({ session: null }) })
    expect(await screen.findByRole('alert')).toHaveTextContent('This invite has expired. Ask a parent to send a new one.')
  })

  it('without an invite, a new sign-in cannot create an account', async () => {
    const auth = fakeAuth({ session: null })
    renderBare(<Gate />, { auth })
    await userEvent.type(screen.getByLabelText(/Your email/), 'someone@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
    expect(auth.sendCode).toHaveBeenCalledWith('someone@example.com', { newAccount: false })
  })
})
