import { fireEvent, render, screen } from '@testing-library/react'
import { ResumeSessionCard } from './ResumeSessionCard'

describe('ResumeSessionCard', () => {
  it('renders default copy from the saved session', () => {
    render(
      <ResumeSessionCard session={{ playerName: 'Roman', roomCode: 'AB12' }} onResume={() => {}} />
    )

    expect(screen.getByText('Resume your last room')).toBeInTheDocument()
    expect(screen.getByText('Room AB12 as Roman')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume →' })).toBeInTheDocument()
  })

  it('invokes onResume when the action button is clicked', () => {
    const onResume = jest.fn()

    render(
      <ResumeSessionCard
        session={{ playerName: 'Roman', roomCode: 'AB12' }}
        onResume={onResume}
        actionLabel="Continue"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(onResume).toHaveBeenCalledTimes(1)
  })
})
