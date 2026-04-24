import { render, screen } from '@testing-library/react'
import { UnoGame } from './UnoGame'

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
}))

jest.mock('@/hooks/useInviteCode', () => ({
  useInviteCode: () => null,
  getInviteLink: (slug: string, code: string) => `https://example.test/${slug}?room=${code}`,
}))

jest.mock('./useUnoRoom', () => ({
  useUnoRoom: () => ({
    gameState: null,
    playerId: null,
    roomCode: null,
    status: 'idle',
    error: null,
    savedSession: null,
    onlinePlayerIds: [],
    createRoom: jest.fn(),
    joinRoom: jest.fn(),
    restoreSession: jest.fn(),
    dispatch: jest.fn(),
    leaveRoom: jest.fn(),
  }),
}))

describe('UnoGame redesign shell', () => {
  it('uses the shared arcade shell and onboarding language from Skribbl redesign', () => {
    render(<UnoGame />)

    expect(screen.getByRole('link', { name: /library/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /uno\s*\/ play/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /match it\.\s*stack it\.\s*uno it\./i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play now/i })).toBeInTheDocument()
  })
})
