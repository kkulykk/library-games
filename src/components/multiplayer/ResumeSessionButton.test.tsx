import { fireEvent, render, screen } from '@testing-library/react'
import { ResumeSessionButton } from './ResumeSessionButton'

describe('ResumeSessionButton', () => {
  it('renders the default title and session summary', () => {
    render(
      <ResumeSessionButton session={{ playerName: 'Roman', roomCode: 'AB12' }} onClick={() => {}} />
    )

    expect(screen.getByText('Resume session')).toBeInTheDocument()
    expect(screen.getByText('Roman · Room AB12')).toBeInTheDocument()
  })

  it('uses custom title and html separator entities', () => {
    render(
      <ResumeSessionButton
        session={{ playerName: 'Roman', roomCode: 'AB12' }}
        onClick={() => {}}
        title="Continue game"
        separator=" &middot; "
      />
    )

    expect(screen.getByText('Continue game')).toBeInTheDocument()
    expect(screen.getByText('Roman · Room AB12')).toBeInTheDocument()
  })

  it('invokes onClick when tapped', () => {
    const onClick = jest.fn()

    render(
      <ResumeSessionButton session={{ playerName: 'Roman', roomCode: 'AB12' }} onClick={onClick} />
    )

    fireEvent.click(screen.getByRole('button', { name: /resume session/i }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
