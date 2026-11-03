import { AnimalSvg, type AnimalProps } from './AnimalSvg'

/** Baby elephant: Feeds guide. `cheeks` adds the pink blush used in headers. */
export function Elephant({ cheeks = false, ...props }: AnimalProps & { cheeks?: boolean }) {
  return (
    <AnimalSvg {...props}>
      <circle cx="11" cy="20" r="8" fill="#9DB8C9" />
      <circle cx="33" cy="20" r="8" fill="#9DB8C9" />
      <circle cx="22" cy="21" r="10" fill="#B7CEDB" />
      <path d="M22 26 q0 8 -5 10" stroke="#B7CEDB" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="18.5" cy="19" r="1.4" fill="#3B3127" />
      <circle cx="25.5" cy="19" r="1.4" fill="#3B3127" />
      {cheeks && (
        <>
          <circle cx="15.5" cy="24" r="1.7" fill="#F4C3B2" />
          <circle cx="28.5" cy="24" r="1.7" fill="#F4C3B2" />
        </>
      )}
    </AnimalSvg>
  )
}
