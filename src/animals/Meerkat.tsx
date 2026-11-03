import { AnimalSvg, type AnimalProps } from './AnimalSvg'

/** Meerkat: Obs guide. */
export function Meerkat(props: AnimalProps) {
  return (
    <AnimalSvg {...props}>
      <circle cx="13.5" cy="15" r="3" fill="#C4A57A" />
      <circle cx="30.5" cy="15" r="3" fill="#C4A57A" />
      <ellipse cx="22" cy="23" rx="9" ry="12" fill="#D6B98E" />
      <ellipse cx="18" cy="21" rx="2.6" ry="3" fill="#8A6A48" />
      <ellipse cx="26" cy="21" rx="2.6" ry="3" fill="#8A6A48" />
      <circle cx="18" cy="21" r="1.1" fill="#2A221B" />
      <circle cx="26" cy="21" r="1.1" fill="#2A221B" />
      <circle cx="22" cy="30" r="1.6" fill="#3B3127" />
    </AnimalSvg>
  )
}
