import { AnimalSvg, type AnimalProps } from './AnimalSvg'

/** Hippo: Nappies guide. */
export function Hippo(props: AnimalProps) {
  return (
    <AnimalSvg {...props}>
      <circle cx="14" cy="13" r="3" fill="#A994C4" />
      <circle cx="30" cy="13" r="3" fill="#A994C4" />
      <ellipse cx="22" cy="21" rx="11" ry="10" fill="#BBA8D6" />
      <ellipse cx="22" cy="28" rx="12" ry="7" fill="#C9B9E0" />
      <ellipse cx="18" cy="27" rx="1.2" ry="1.6" fill="#7E6A9B" />
      <ellipse cx="26" cy="27" rx="1.2" ry="1.6" fill="#7E6A9B" />
      <circle cx="17" cy="18" r="1.4" fill="#3B3127" />
      <circle cx="27" cy="18" r="1.4" fill="#3B3127" />
    </AnimalSvg>
  )
}
