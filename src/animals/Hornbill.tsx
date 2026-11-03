import { AnimalSvg, type AnimalProps } from './AnimalSvg'

/** Hornbill: Speech & language guide. */
export function Hornbill(props: AnimalProps) {
  return (
    <AnimalSvg {...props}>
      <circle cx="19" cy="23" r="11" fill="#8CC5BC" />
      <ellipse cx="16" cy="29" rx="6" ry="3.5" fill="#B7DDD6" />
      <path d="M27 19 q12 0 13 8 q-6 -3 -13 0z" fill="#F2C46D" />
      <path d="M27 18 q6 -4 11 0 q-5 -1 -11 2z" fill="#E9A06B" />
      <circle cx="21" cy="20" r="1.6" fill="#3B3127" />
      <path d="M14 12 q2 -4 5 -1" stroke="#6FA89F" strokeWidth="2" fill="none" strokeLinecap="round" />
    </AnimalSvg>
  )
}
