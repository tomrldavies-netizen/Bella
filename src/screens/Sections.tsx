import { Elephant, Giraffe, Hippo, LionCub, Meerkat, Zebra } from '../animals'
import { ComingSoon } from '../components/ComingSoon'
import { ClipboardIcon } from '../components/Icons'
import { ScreenHeader } from '../components/ScreenHeader'

export function Feeds() {
  return (
    <>
      <ScreenHeader title="Feeds" subtitle="NG tube feeds and expressing" tint="bg-feeds" guide={<Elephant size={56} cheeks />} />
      <ComingSoon
        items={[
          'Feed timer with by-mouth and via-tube volumes',
          "The next planned feed from Bella's plan",
          'NG tube card and tube change reminders',
          'Expressing log and freezer stock',
        ]}
      />
    </>
  )
}

export function Meds() {
  return (
    <>
      <ScreenHeader title="Medicines" subtitle="Today's doses" tint="bg-meds" guide={<LionCub size={56} smile />} />
      <ComingSoon
        items={[
          "Today's schedule from Bella's plan: given, due or missed",
          'Mark given, with a check so a dose is never logged twice',
          'Dose history',
          'Prescriptions and reorder reminders',
        ]}
      />
    </>
  )
}

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

export function BellasPlan() {
  return (
    <>
      <ScreenHeader
        title="Bella's plan"
        subtitle="What she needs, and when"
        tint="bg-bella-plan"
        back={{ to: '/', label: 'Today' }}
        guide={
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-card text-ink">
            <ClipboardIcon size={28} strokeWidth={1.8} />
          </span>
        }
      />
      <ComingSoon
        items={[
          'Feed plan: times, milk type and amounts',
          'Medicines and dose changes',
          'Physio and speech & language exercises',
          'Obs and routines',
          'Family & sharing',
          'Recent changes',
        ]}
      />
    </>
  )
}
