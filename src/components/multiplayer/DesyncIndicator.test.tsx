import { render, screen } from '@testing-library/react'
import { DesyncIndicator } from './DesyncIndicator'

describe('DesyncIndicator', () => {
  it('renders nothing when inactive', () => {
    render(<DesyncIndicator active={false} />)

    expect(screen.queryByTestId('desync-indicator')).toBeNull()
  })

  it('renders the default reconnecting pill when active', () => {
    render(<DesyncIndicator active />)

    const root = screen.getByTestId('desync-indicator')
    expect(root).toBeInTheDocument()
    expect(root).toHaveAttribute('role', 'status')
    expect(root).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument()
  })

  it('renders a custom message when provided', () => {
    render(<DesyncIndicator active message="Out of sync — recovering" />)

    expect(screen.getByText('Out of sync — recovering')).toBeInTheDocument()
  })

  it('merges a caller-provided className onto the root', () => {
    render(<DesyncIndicator active className="custom-class" />)

    expect(screen.getByTestId('desync-indicator')).toHaveClass('custom-class')
  })
})
