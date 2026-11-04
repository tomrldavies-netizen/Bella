import { Hippo, Zebra } from '../animals'
import { ComingSoon } from '../components/ComingSoon'
import { ScreenHeader } from '../components/ScreenHeader'

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
