import { AnimalSvg, type AnimalProps } from './AnimalSvg'

/** Lion cub: Medicines guide. `smile` adds the mouth used in headers. */
export function LionCub({ smile = false, ...props }: AnimalProps & { smile?: boolean }) {
  return (
    <AnimalSvg {...props}>
      <circle cx="22" cy="22" r="14" fill="#E9A06B" />
      <circle cx="13" cy="13" r="4" fill="#F5D2A0" />
      <circle cx="31" cy="13" r="4" fill="#F5D2A0" />
      <circle cx="22" cy="23" r="9.5" fill="#F5D2A0" />
      <circle cx="18.5" cy="21" r="1.3" fill="#3B3127" />
      <circle cx="25.5" cy="21" r="1.3" fill="#3B3127" />
      <path d="M20.5 25 h3 l-1.5 1.8z" fill="#8A5A3B" />
      {smile && (
        <path
          d="M22 26.8 q-2 2 -3.5 1 M22 26.8 q2 2 3.5 1"
          stroke="#8A5A3B"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </AnimalSvg>
  )
}
