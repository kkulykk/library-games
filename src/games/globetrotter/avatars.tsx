// Blocky player avatars from the Library Games design system (util.jsx).
// Deterministic by roster index so every client renders the same face.

export const AVATAR_HUES = [130, 45, 200, 340, 95, 260, 20, 170]

export function avatarHue(idx: number): number {
  return AVATAR_HUES[((idx % AVATAR_HUES.length) + AVATAR_HUES.length) % AVATAR_HUES.length]
}

export function AvatarSvg({ idx = 0, size = 28 }: { idx?: number; size?: number }) {
  const hue = avatarHue(idx)
  const mouths = [
    <path
      key="m0"
      d="M 8 17 Q 12 20 16 17"
      stroke="#1a1a1a"
      strokeWidth="1.4"
      fill="none"
      strokeLinecap="round"
    />,
    <path key="m1" d="M 8 18 L 16 18" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round" />,
    <path
      key="m2"
      d="M 9 18 Q 12 16 15 18"
      stroke="#1a1a1a"
      strokeWidth="1.4"
      fill="none"
      strokeLinecap="round"
    />,
    <circle key="m3" cx="12" cy="18" r="1.4" fill="#1a1a1a" />,
  ]
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect x="1" y="1" width="22" height="22" fill={`oklch(0.82 0.18 ${hue})`} />
      {idx % 4 === 0 && <rect x="4" y="2" width="16" height="4" fill="#1a1a1a" />}
      {idx % 4 === 1 && <path d="M 3 8 Q 12 3 21 8 L 20 10 L 4 10 Z" fill="#1a1a1a" />}
      {idx % 4 === 2 && <path d="M 6 6 L 18 6 L 16 3 L 8 3 Z" fill="#1a1a1a" />}
      <circle cx="8" cy="12" r="1.6" fill="#1a1a1a" />
      <circle cx="16" cy="12" r="1.6" fill="#1a1a1a" />
      {mouths[idx % mouths.length]}
    </svg>
  )
}
