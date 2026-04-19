import { fireEvent, render, screen } from '@testing-library/react'
import { PlayerRoster } from './PlayerRoster'

const players = [
  { id: 'host', name: 'Host', avatar: 0, isHost: true },
  { id: 'offline', name: 'Offline', avatar: 1, isHost: false },
]

describe('PlayerRoster', () => {
  it('renders player count and default status labels', () => {
    render(
      <PlayerRoster
        players={players}
        currentPlayerId="host"
        onlinePlayerIds={['host']}
        maxPlayers={8}
      />
    )

    expect(screen.getByText('Players')).toBeInTheDocument()
    expect(screen.getByText('2 / 8')).toBeInTheDocument()
    expect(screen.getByText('you')).toBeInTheDocument()
    expect(screen.getByText('offline')).toBeInTheDocument()
    expect(screen.getByText('host')).toBeInTheDocument()
    expect(screen.getByText('away')).toBeInTheDocument()
  })

  it('shows remove action only for removable players and calls onRemovePlayer', () => {
    const onRemovePlayer = jest.fn()

    render(
      <PlayerRoster
        players={players}
        currentPlayerId="host"
        onlinePlayerIds={['host']}
        maxPlayers={8}
        currentPlayerIsHost
        onRemovePlayer={onRemovePlayer}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove Offline' }))

    expect(onRemovePlayer).toHaveBeenCalledWith('offline')
    expect(screen.queryByRole('button', { name: 'Remove Host' })).not.toBeInTheDocument()
  })
})
