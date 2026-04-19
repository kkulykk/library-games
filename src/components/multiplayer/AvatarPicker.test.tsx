import { fireEvent, render, screen } from '@testing-library/react'
import { AvatarPicker } from './AvatarPicker'

describe('AvatarPicker', () => {
  it('renders the requested avatar count and marks the selected avatar', () => {
    render(<AvatarPicker selectedIndex={2} onSelect={() => {}} count={4} />)

    expect(screen.getAllByRole('button')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Select avatar 3' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('calls onSelect with the clicked avatar index', () => {
    const onSelect = jest.fn()

    render(<AvatarPicker selectedIndex={0} onSelect={onSelect} count={4} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select avatar 4' }))

    expect(onSelect).toHaveBeenCalledWith(3)
  })
})
