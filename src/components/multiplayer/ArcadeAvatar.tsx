interface ArcadeAvatarProps {
  index: number
  size?: number
}

export function ArcadeAvatar({ index, size = 28 }: ArcadeAvatarProps) {
  const hues = [130, 45, 200, 340, 95, 260, 20, 170]
  const hue = hues[index % hues.length]
  const mouthIndex = ((index % 4) + 4) % 4

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" fill={`oklch(0.82 0.18 ${hue})`} />
      {index % 4 === 0 && <rect x="4" y="2" width="16" height="4" fill="#1a1a1a" />}
      {index % 4 === 1 && <path d="M 3 8 Q 12 3 21 8 L 20 10 L 4 10 Z" fill="#1a1a1a" />}
      {index % 4 === 2 && <path d="M 6 6 L 18 6 L 16 3 L 8 3 Z" fill="#1a1a1a" />}
      <circle cx="8" cy="12" r="1.6" fill="#1a1a1a" />
      <circle cx="16" cy="12" r="1.6" fill="#1a1a1a" />
      {mouthIndex === 0 && (
        <path
          d="M 8 17 Q 12 20 16 17"
          stroke="#1a1a1a"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {mouthIndex === 1 && <path d="M 8 18 L 16 18" stroke="#1a1a1a" strokeWidth="1.4" />}
      {mouthIndex === 2 && (
        <path
          d="M 9 18 Q 12 16 15 18"
          stroke="#1a1a1a"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {mouthIndex === 3 && <circle cx="12" cy="18" r="1.4" fill="#1a1a1a" />}
    </svg>
  )
}
