export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer hexagon */}
      <path
        d="M16 2L27.8564 9V23L16 30L4.14359 23V9L16 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Inner document icon */}
      <path d="M12 11H20M12 15H20M12 19H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

      {/* AI sparkle accent */}
      <circle cx="21" cy="10" r="2" fill="currentColor" opacity="0.8" />
      <circle cx="23" cy="8" r="1" fill="currentColor" opacity="0.6" />
    </svg>
  )
}
