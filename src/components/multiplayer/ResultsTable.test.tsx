import { render, screen } from '@testing-library/react'
import { ResultsTable } from './ResultsTable'

describe('ResultsTable', () => {
  it('renders rows with rank, player, delta, and total', () => {
    render(
      <ResultsTable
        rows={[
          {
            id: 'roman',
            rankLabel: '1',
            name: 'Roman',
            avatar: 0,
            secondaryLabel: '+120',
            totalLabel: '450',
          },
        ]}
      />
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Roman')).toBeInTheDocument()
    expect(screen.getByText('+120')).toBeInTheDocument()
    expect(screen.getByText('450')).toBeInTheDocument()
  })

  it('marks winner rows with a dedicated data attribute', () => {
    const { container } = render(
      <ResultsTable
        rows={[
          {
            id: 'winner',
            rankLabel: '👑',
            name: 'Winner',
            avatar: 1,
            secondaryLabel: 'Winner',
            totalLabel: '999',
            isWinner: true,
          },
        ]}
      />
    )

    expect(container.querySelector('[data-winner="true"]')).toBeInTheDocument()
  })
})
