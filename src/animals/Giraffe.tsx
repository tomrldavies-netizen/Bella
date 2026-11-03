import { AnimalSvg, type AnimalProps } from './AnimalSvg'

/** Giraffe: Growth guide. */
export function Giraffe(props: AnimalProps) {
  return (
    <AnimalSvg {...props}>
      <path d="M17 14 L15.5 7 M27 14 L28.5 7" stroke="#C98F4E" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="15.5" cy="6.5" r="2.3" fill="#8A5A3B" />
      <circle cx="28.5" cy="6.5" r="2.3" fill="#8A5A3B" />
      <ellipse cx="11.5" cy="17" rx="4" ry="2.4" fill="#F2C46D" />
      <ellipse cx="32.5" cy="17" rx="4" ry="2.4" fill="#F2C46D" />
      <ellipse cx="22" cy="22" rx="10" ry="11" fill="#F2C46D" />
      <circle cx="16" cy="15" r="1.8" fill="#D99A4E" />
      <circle cx="27" cy="13.5" r="1.5" fill="#D99A4E" />
      <circle cx="29" cy="24" r="1.6" fill="#D99A4E" />
      <ellipse cx="22" cy="29" rx="7" ry="4.6" fill="#F7DDA4" />
      <circle cx="18" cy="20" r="1.4" fill="#3B3127" />
      <circle cx="26" cy="20" r="1.4" fill="#3B3127" />
      <circle cx="20" cy="29" r="0.9" fill="#8A5A3B" />
      <circle cx="24" cy="29" r="0.9" fill="#8A5A3B" />
    </AnimalSvg>
  )
}
