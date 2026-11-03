import { AnimalSvg, type AnimalProps } from './AnimalSvg'

/** Zebra: Plan guide. `ears` adds the ears used in headers. */
export function Zebra({ ears = true, ...props }: AnimalProps & { ears?: boolean }) {
  return (
    <AnimalSvg {...props}>
      {ears && (
        <>
          <ellipse cx="14" cy="12" rx="2.6" ry="4.5" fill="#FFFFFF" stroke="#3B3127" strokeWidth="1.2" />
          <ellipse cx="30" cy="12" rx="2.6" ry="4.5" fill="#FFFFFF" stroke="#3B3127" strokeWidth="1.2" />
        </>
      )}
      <path d="M18 11 l4 -5 l4 5z" fill="#3B3127" />
      <ellipse cx="22" cy="22" rx="9" ry="12" fill="#FFFFFF" stroke="#3B3127" strokeWidth="1.2" />
      <path
        d="M15 16 q4 0 5 3 M29 16 q-4 0 -5 3 M14 22 q3 0 4 2 M30 22 q-3 0 -4 2"
        stroke="#3B3127"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="22" cy="30" rx="6.5" ry="4.5" fill="#6E6255" />
      <circle cx="18.5" cy="21" r="1.3" fill="#3B3127" />
      <circle cx="25.5" cy="21" r="1.3" fill="#3B3127" />
    </AnimalSvg>
  )
}
