import { cn } from '@/lib/utils'
import { ArcadeAvatar } from './ArcadeAvatar'

interface AvatarPickerProps {
  selectedIndex: number
  onSelect: (index: number) => void
  count?: number
  size?: number
  className?: string
  buttonClassName?: string
  selectedButtonClassName?: string
}

export function AvatarPicker({
  selectedIndex,
  onSelect,
  count = 8,
  size = 42,
  className,
  buttonClassName,
  selectedButtonClassName,
}: AvatarPickerProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          aria-label={`Select avatar ${index + 1}`}
          aria-pressed={selectedIndex === index}
          onClick={() => onSelect(index)}
          className={cn(buttonClassName, selectedIndex === index && selectedButtonClassName)}
        >
          <ArcadeAvatar index={index} size={size} />
        </button>
      ))}
    </div>
  )
}
