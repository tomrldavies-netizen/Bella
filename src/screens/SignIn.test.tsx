import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeAuth, renderWith } from '../test/fakes'
import { SignIn } from './SignIn'

describe('SignIn', () => {
  it('emails a code, then signs in with it', async () => {
    const auth = fakeAuth({ session: null })
    renderWith(<SignIn />, { auth })
    await userEvent.type(screen.getByLabelText(/Your email/), ' dad@example.com ')
    await userEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
    expect(auth.sendCode).toHaveBeenCalledWith('dad@example.com')

    await userEvent.type(screen.getByLabelText('Sign-in code'), '123 456')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(auth.verifyCode).toHaveBeenCalledWith('dad@example.com', '123456')
  })

  it('shows why an email was refused', async () => {
    const auth = fakeAuth({ session: null, sendCode: vi.fn(async () => "That email isn't on Bella's list yet.") })
    renderWith(<SignIn />, { auth })
    await userEvent.type(screen.getByLabelText(/Your email/), 'someone@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
    expect(screen.getByRole('alert')).toHaveTextContent("isn't on Bella's list")
    expect(screen.queryByLabelText('Sign-in code')).not.toBeInTheDocument()
  })
})
