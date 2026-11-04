import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../plan/api'
import { helperHousehold, renderRoutes } from '../../test/fakes'

vi.mock('../../plan/api', () => ({
  loadFeedPlans: vi.fn(),
  loadMedicines: vi.fn(),
  loadExercises: vi.fn(),
  loadRoutines: vi.fn(),
  loadRecentChanges: vi.fn(),
  saveFeedPlan: vi.fn(async () => {}),
  saveMedicine: vi.fn(async () => 'med-new'),
  saveExercise: vi.fn(async () => 'ex-new'),
  saveRoutines: vi.fn(async () => {}),
}))
const m = vi.mocked(api)

const plan: api.FeedPlanVersion = {
  id: 'p1',
  effective_from: '2026-10-01T00:00:00Z',
  note: null,
  created_by: 'm-dad',
  slots: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].map((time) => ({ time, milk: 'breast' as const, ml: 50 })),
}
const iron: api.Medicine = {
  id: 'med1',
  name: 'Iron',
  notes: null,
  active: true,
  sort_order: 1,
  versions: [
    { id: 'v1', dose: 1, unit: 'ml', route: 'mouth', times: ['05:00', '17:00'], effective_from: '2026-10-01T00:00:00Z', effective_to: '2026-10-19T21:00:00Z', reason: null },
    { id: 'v2', dose: 1.2, unit: 'ml', route: 'mouth', times: ['05:00', '17:00'], effective_from: '2026-10-19T21:00:00Z', effective_to: null, reason: 'after weigh-in' },
  ],
}
const routines: api.Routines = { obsIntervalMin: 240, tummyGoalMin: 30, tubeChangeDays: 7, tempMinC: null, tempMaxC: null, tasks: [] }

beforeEach(() => {
  vi.clearAllMocks()
  m.loadFeedPlans.mockResolvedValue([plan])
  m.loadMedicines.mockResolvedValue([iron])
  m.loadExercises.mockResolvedValue([
    { id: 'ex1', type: 'physio', name: 'Hip stretches', per_day: 3, timing_note: null, active: true, sort_order: 1, steps: ['On her back', 'Stop if unhappy'] },
  ])
  m.loadRoutines.mockResolvedValue(routines)
  m.loadRecentChanges.mockResolvedValue([
    { id: 'c1', area: 'medicines', summary: 'Iron 1 ml → 1.2 ml', changed_by: 'm-dad', created_at: '2026-10-19T20:00:00Z' },
  ])
})

describe("Bella's plan hub", () => {
  it('summarises each part of the plan and lists recent changes', async () => {
    renderRoutes('/bellas-plan')
    expect(await screen.findByText('8 feeds · 400 ml a day · 8 breast milk')).toBeInTheDocument()
    expect(screen.getByText('Iron')).toBeInTheDocument()
    expect(screen.getByText('1 exercise · tummy time goal 30 min')).toBeInTheDocument()
    expect(screen.getByText('Obs every 4 hrs · tube change every 7 days')).toBeInTheDocument()
    expect(screen.getByText('Iron 1 ml → 1.2 ml')).toBeInTheDocument()
  })
})

describe('feed plan editor', () => {
  it('cycles a milk type and saves a new version with an automatic summary', async () => {
    renderRoutes('/bellas-plan/feeds')
    await userEvent.click(await screen.findByRole('button', { name: /06:00 milk: Breast milk/ }))
    await userEvent.click(screen.getByRole('button', { name: /15:00 milk: Breast milk/ }))
    expect(screen.getByText('Change: 06:00 and 15:00 feeds now formula, 50 ml')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Save feed plan' }))
    await waitFor(() => expect(m.saveFeedPlan).toHaveBeenCalled())
    const args = m.saveFeedPlan.mock.calls[0][0]
    expect(args.summary).toBe('06:00 and 15:00 feeds now formula, 50 ml')
    expect(args.notify).toBe(true)
    expect(args.slots.filter((s) => s.milk === 'formula').map((s) => s.time)).toEqual(['06:00', '15:00'])
  })

  it('changes an amount in 5 ml steps', async () => {
    renderRoutes('/bellas-plan/feeds')
    const row = await screen.findByRole('group', { name: '12:00 feed amount' })
    await userEvent.click(within(row).getByRole('button', { name: /5 ml more/ }))
    expect(within(row).getByText('55 ml')).toBeInTheDocument()
    expect(screen.getByText('405 ml')).toBeInTheDocument()
  })

  it('can turn off "Tell everyone"', async () => {
    renderRoutes('/bellas-plan/feeds')
    await userEvent.click(await screen.findByRole('button', { name: 'Formula' }))
    await userEvent.click(screen.getByRole('switch', { name: 'Tell everyone about this change' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save feed plan' }))
    await waitFor(() => expect(m.saveFeedPlan).toHaveBeenCalled())
    expect(m.saveFeedPlan.mock.calls[0][0].notify).toBe(false)
  })

  it('fills an empty plan from values the parent chooses', async () => {
    m.loadFeedPlans.mockResolvedValue([])
    renderRoutes('/bellas-plan/feeds')
    const fill = await screen.findByRole('button', { name: 'Set an amount first' })
    expect(fill).toBeDisabled()
    const amount = screen.getByRole('group', { name: 'Amount for each feed' })
    for (let i = 0; i < 8; i++) await userEvent.click(within(amount).getByRole('button', { name: /5 ml more/ }))
    await userEvent.click(screen.getByRole('button', { name: /Fill in 8 feeds/ }))
    expect(screen.getByText('320 ml')).toBeInTheDocument()
    expect(screen.getByText('Change: New feed plan: 8 feeds · 320 ml a day · 8 breast milk')).toBeInTheDocument()
  })

  it('warns before leaving with unsaved changes', async () => {
    const { router } = renderRoutes('/bellas-plan/feeds')
    await userEvent.click(await screen.findByRole('button', { name: 'Formula' }))
    await userEvent.click(screen.getByRole('link', { name: "Bella's plan" }))
    expect(screen.getByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(router.state.location.pathname).toBe('/bellas-plan/feeds')
  })
})

describe('medicine editor', () => {
  it('shows the previous dose', async () => {
    renderRoutes('/bellas-plan/medicines')
    expect(await screen.findByText('was 1 ml until 19 Oct')).toBeInTheDocument()
  })

  it('creates a new dose version when the dose changes', async () => {
    renderRoutes('/bellas-plan/medicines')
    const dose = await screen.findByRole('group', { name: 'Dose' })
    await userEvent.click(within(dose).getByRole('button', { name: /1 ml more/ }))
    expect(within(dose).getByText('2.2 ml')).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText(/new weight/), 'agreed with nurse')
    await userEvent.click(screen.getByRole('button', { name: 'Save medicine' }))
    await waitFor(() => expect(m.saveMedicine).toHaveBeenCalled())
    const args = m.saveMedicine.mock.calls[0][0]
    expect(args.doseMode).toBe('new_version')
    expect(args.summary).toBe('Iron 1.2 ml → 2.2 ml')
    expect(args.dose).toMatchObject({ dose: 2.2, times: ['05:00', '17:00'], reason: 'agreed with nurse' })
  })

  it('renames without a new dose version', async () => {
    renderRoutes('/bellas-plan/medicines')
    const name = await screen.findByDisplayValue('Iron')
    await userEvent.clear(name)
    await userEvent.type(name, 'Sytron')
    await userEvent.click(screen.getByRole('button', { name: 'Save medicine' }))
    await waitFor(() => expect(m.saveMedicine).toHaveBeenCalled())
    expect(m.saveMedicine.mock.calls[0][0]).toMatchObject({ doseMode: 'none', summary: 'Iron renamed to Sytron' })
  })

  it('adds a new medicine', async () => {
    m.loadMedicines.mockResolvedValue([])
    renderRoutes('/bellas-plan/medicines')
    await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), 'Vitamin drops')
    await userEvent.click(within(screen.getByRole('group', { name: 'Dose' })).getByRole('button', { name: /1 ml more/ }))
    fireEvent.change(screen.getByLabelText('New dose time'), { target: { value: '09:00' } })
    await userEvent.click(screen.getByRole('button', { name: '+ Time' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add medicine' }))
    await waitFor(() => expect(m.saveMedicine).toHaveBeenCalled())
    expect(m.saveMedicine.mock.calls[0][0]).toMatchObject({
      medicineId: null,
      doseMode: 'new_version',
      summary: 'Added Vitamin drops 1 ml by mouth or tube at 09:00',
    })
  })
})

describe('exercise editor', () => {
  it('reorders steps and changes how often', async () => {
    renderRoutes('/bellas-plan/exercises?type=physio')
    await userEvent.click(await screen.findByRole('button', { name: 'Move step 2 up' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fewer times a day' }))
    expect(screen.getByText('Change: Hip stretches now 2 times a day; Updated how-to steps for Hip stretches')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save exercise' }))
    await waitFor(() => expect(m.saveExercise).toHaveBeenCalled())
    expect(m.saveExercise.mock.calls[0][0]).toMatchObject({ perDay: 2, steps: ['Stop if unhappy', 'On her back'] })
  })
})

describe('routines editor', () => {
  it('adds a weekly care task', async () => {
    renderRoutes('/bellas-plan/routines')
    await userEvent.click(await screen.findByRole('button', { name: '+ Add a care task' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Care task name' }), 'Bath')
    await userEvent.click(screen.getByRole('radio', { name: 'On set days' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mon' }))
    await userEvent.click(screen.getByRole('button', { name: 'Thu' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save routines' }))
    await waitFor(() => expect(m.saveRoutines).toHaveBeenCalled())
    expect(m.saveRoutines.mock.calls[0][0].summary).toBe('Added Bath (every Mon and Thu)')
  })
})

describe('helpers see the plan read-only', () => {
  it.each([
    ['/bellas-plan/feeds', 'Save feed plan'],
    ['/bellas-plan/medicines', 'Save medicine'],
    ['/bellas-plan/exercises?type=physio', 'Save exercise'],
    ['/bellas-plan/routines', 'Save routines'],
  ])('%s has no edit controls', async (path, save) => {
    renderRoutes(path, { household: helperHousehold() })
    expect(await screen.findByText(/Only Mum and Dad can change the plan/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: save })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /more/ })).not.toBeInTheDocument()
  })

  it('still shows the plan values', async () => {
    renderRoutes('/bellas-plan/feeds', { household: helperHousehold() })
    expect((await screen.findAllByText('50 ml')).length).toBe(8)
  })
})

describe('load errors', () => {
  it('explains when the plan cannot be loaded', async () => {
    m.loadExercises.mockRejectedValue(new Error('column exercises.timing_note does not exist'))
    renderRoutes('/bellas-plan')
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load Bella's plan: column exercises.timing_note does not exist")
  })
})
