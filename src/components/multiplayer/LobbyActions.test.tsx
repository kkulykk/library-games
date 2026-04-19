import { fireEvent, render, screen } from '@testing-library/react'
import { LobbyActions } from './LobbyActions'

describe('LobbyActions', () => {
  it('renders host controls and respects the disabled start state', () => {
    render(<LobbyActions isHost canStart={false} onLeave={() => {}} onStart={() => {}} />)

    expect(screen.getByText("You're the host")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start game →' })).toBeDisabled()
  })

  it('renders guest waiting copy and triggers leave', () => {
    const onLeave = jest.fn()

    render(<LobbyActions isHost={false} canStart onLeave={onLeave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))

    expect(screen.getByText('Waiting for host to start')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start game →' })).not.toBeInTheDocument()
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
