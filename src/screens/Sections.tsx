import { Giraffe, Hippo, Meerkat, Zebra } from '../animals'
import { ComingSoon } from '../components/ComingSoon'
import { ScreenHeader } from '../components/ScreenHeader'

export function Growth() {
  return (
    <>
      <ScreenHeader title="Growth" subtitle="Weigh-ins and corrected age" tint="bg-growth" guide={<Giraffe size={56} />} />
      <ComingSoon
        items={['Weigh-ins, length and head size', 'Actual and corrected age', 'Preterm growth chart', "Bella's firsts"]}
      />
    </>
  )
}

export function Care() {
  return (
    <>
      <ScreenHeader title="Care" subtitle="Obs, exercises and tummy time" tint="bg-obs" guide={<Meerkat size={56} />} />
      <ComingSoon
        items={['Obs checklist and obs due reminder', 'Physio and speech & language exercises', 'Tummy time timer']}
      />
    </>
  )
}

export function Plan() {
  return (
    <>
      <ScreenHeader
        title="Plan"
        subtitle="Appointments, questions and supplies"
        tint="bg-plan"
        guide={<Zebra size={56} />}
        back={{ to: '/', label: 'Today' }}
        backPhoneOnly
      />
      <ComingSoon
        items={['Appointments', 'Questions for the team', 'Supplies with low-stock alerts', 'Bath and skin care tasks']}
      />
    </>
  )
}

export function Summary() {
  return (
    <>
      <ScreenHeader
        title="Daily summary"
        subtitle="Midnight to midnight"
        tint="bg-bella-plan"
        guide={<Hippo size={56} />}
        back={{ to: '/', label: 'Today' }}
        backPhoneOnly
      />
      <ComingSoon
        items={[
          'Day picker',
          'Totals: milk, nappies, medicines, tummy time, sick, obs',
          'Feeds through the day chart',
          "The day's notes",
        ]}
      />
    </>
  )
}
