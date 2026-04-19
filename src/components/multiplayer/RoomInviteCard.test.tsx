import { fireEvent, render, screen } from '@testing-library/react'
import { RoomInviteCard } from './RoomInviteCard'

describe('RoomInviteCard', () => {
  it('renders the room code and default meta copy', () => {
    render(
      <RoomInviteCard
        roomCode="AB12"
        inviteLink="https://example.com/invite"
        copied={null}
        onCopy={() => {}}
      />
    )

    expect(screen.getByText('AB12')).toBeInTheDocument()
    expect(screen.getByText('/ lobby · waiting for players')).toBeInTheDocument()
  })

  it('routes copy actions through the provided callback', () => {
    const onCopy = jest.fn()

    render(
      <RoomInviteCard
        roomCode="AB12"
        inviteLink="https://example.com/invite"
        copied={null}
        onCopy={onCopy}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /copy code/i }))
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }))

    expect(onCopy).toHaveBeenNthCalledWith(1, 'AB12', 'code')
    expect(onCopy).toHaveBeenNthCalledWith(2, 'https://example.com/invite', 'link')
  })
})
