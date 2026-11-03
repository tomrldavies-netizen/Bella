import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeHousehold, renderWith } from '../test/fakes'
import { Setup } from './Setup'

describe('Setup', () => {
  it('creates the household with the due date worked out from gestation', async () => {
    const household = fakeHousehold({ state: { status: 'none' } })
    renderWith(<Setup />, { household })

    await userEvent.type(screen.getByLabelText(/Your name/), 'Dad')
    await userEvent.click(screen.getByLabelText('Sky'))
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2026-09-10' } })
    // 32+0 → 31+2
    await userEvent.click(screen.getByRole('button', { name: 'Less weeks' }))
    await userEvent.click(screen.getByRole('button', { name: 'More days' }))
    await userEvent.click(screen.getByRole('button', { name: 'More days' }))
    expect(screen.getByText('Tuesday 10 November 2026')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: "Start Bella's safari" }))
    expect(household.createHousehold).toHaveBeenCalledWith({
      displayName: 'Dad',
      colour: '#DCEBF2',
      babyName: 'Bella',
      birthDate: '2026-09-10',
      gestationWeeks: 31,
      gestationDays: 2,
      dueDate: '2026-11-10',
    })
  })

  it('needs a date of birth before saving', () => {
    renderWith(<Setup />, { household: fakeHousehold({ state: { status: 'none' } }) })
    expect(screen.getByRole('button', { name: "Start Bella's safari" })).toBeDisabled()
  })
})
