/**
 * Home header backdrop from the Today mockup: peach sky, sun, clouds,
 * rolling hills and an acacia tree, with the baby elephant standing on the hill.
 * Drawn at 390×180 and stretched to fill its container.
 */
export function SavannaScene({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <svg
        viewBox="0 0 390 180"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
      >
        <rect width="390" height="180" fill="#FCE9D6" />
        <circle cx="250" cy="58" r="30" fill="#F9D58C" />
        <g className="motion-safe:animate-drift">
          <ellipse cx="175" cy="40" rx="26" ry="8" fill="#FFFFFF" opacity="0.8" />
          <ellipse cx="195" cy="34" rx="18" ry="8" fill="#FFFFFF" opacity="0.8" />
        </g>
        <path d="M0 138 Q100 104 200 130 T390 116 V180 H0Z" fill="#DCE8C9" />
        <path d="M0 162 Q120 136 250 158 T390 150 V180 H0Z" fill="#C7DDB4" />
        <path
          d="M330 140 L333 104 M333 112 L318 100 M333 108 L348 98"
          stroke="#8A6A48"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx="334" cy="96" rx="32" ry="9" fill="#9CBF8A" />
        <ellipse cx="322" cy="91" rx="16" ry="6" fill="#B2CF9F" />
        {/* Elephant from the header, placed at (220, 96) and drawn 74 px wide. */}
        <g transform="translate(220 96) scale(1.6818)">
          {/* Gentle breathing and the odd blink (off with "Reduce motion"). */}
          <g className="svg-centre motion-safe:animate-breathe">
            <circle cx="11" cy="20" r="8" fill="#9DB8C9" />
            <circle cx="33" cy="20" r="8" fill="#9DB8C9" />
            <circle cx="22" cy="21" r="10.5" fill="#B7CEDB" />
            <path d="M22 27 q0 8 -5 10" stroke="#B7CEDB" strokeWidth="5" fill="none" strokeLinecap="round" />
            <g className="svg-centre motion-safe:animate-blink">
              <circle cx="18.5" cy="19" r="1.4" fill="#3B3127" />
              <circle cx="25.5" cy="19" r="1.4" fill="#3B3127" />
            </g>
            <circle cx="15.5" cy="24" r="1.7" fill="#F4C3B2" />
            <circle cx="28.5" cy="24" r="1.7" fill="#F4C3B2" />
          </g>
        </g>
      </svg>
    </div>
  )
}
