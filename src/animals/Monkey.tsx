import { AnimalSvg, type AnimalProps } from './AnimalSvg'

/** Monkey: Physio and tummy time guide. */
export function Monkey(props: AnimalProps) {
  return (
    <AnimalSvg {...props}>
      <circle cx="10" cy="22" r="5" fill="#A8775A" />
      <circle cx="34" cy="22" r="5" fill="#A8775A" />
      <circle cx="22" cy="22" r="11" fill="#A8775A" />
      <circle cx="18.5" cy="19.5" r="3.6" fill="#EBC9A8" />
      <circle cx="25.5" cy="19.5" r="3.6" fill="#EBC9A8" />
      <ellipse cx="22" cy="25.5" rx="7.5" ry="6" fill="#EBC9A8" />
      <circle cx="18.5" cy="19.5" r="1.3" fill="#3B3127" />
      <circle cx="25.5" cy="19.5" r="1.3" fill="#3B3127" />
      <path d="M19 27 q3 2.5 6 0" stroke="#3B3127" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </AnimalSvg>
  )
}
